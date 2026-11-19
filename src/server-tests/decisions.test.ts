// Go-live decisions (supabase/migrations/…0700_go_live_decisions.sql, docs/go-live-plan.md Stage 0):
// admin-only primary invites, Google-only invite-only sign-in (the "before user created" hook),
// and the daily job's log with the keep-alive answer.
import { beforeAll, describe, expect, it } from 'vitest';
import { BOOT_TIMEOUT, TestDb, denied, type Caller } from './db';

let db: TestDb;
let admin: Caller;

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.newParent('admin', 'owner@example.org');
  await db.owner(`select private.add_admin($1)`, [admin.id]);
}, BOOT_TIMEOUT);

/** The event Supabase Auth passes to the hook (only the fields the hook reads). */
const hook = async (user: Record<string, unknown>) =>
  (await db.owner<{ r: Record<string, unknown> }>(`select public.auth_before_user_created($1::jsonb) as r`, [JSON.stringify({ user })]))[0].r;
const refused = { error: { http_code: 403, message: 'This app is by invitation only.' } };

describe('Google-only, invite-only sign-in', () => {
  it('the hook lets a Google account in only with a pending invite (any letter case)', async () => {
    const google = (email: string) => ({ email, is_anonymous: false, app_metadata: { provider: 'google' } });
    expect(await hook(google('Invited.Parent@Gmail.com'))).toEqual(refused);
    await db.as(admin, `select public.invite_primary('invited.parent@gmail.com')`);
    expect(await hook(google('Invited.Parent@Gmail.com'))).toEqual({});
    // Another provider, a missing or broken email: refused.
    expect(await hook({ email: 'invited.parent@gmail.com', is_anonymous: false, app_metadata: { provider: 'email' } })).toEqual(refused);
    expect(await hook({ is_anonymous: false, app_metadata: { provider: 'google' } })).toEqual(refused);
    expect(await hook(google('not an email'))).toEqual(refused);
    // An expired invite no longer counts.
    await db.owner(`update public.invites set expires_at = expires_at - interval '8 days'`);
    expect(await hook(google('invited.parent@gmail.com'))).toEqual(refused);
  });

  it('anonymous child devices are allowed (they need a parent code for anything)', async () => {
    expect(await hook({ is_anonymous: true, app_metadata: { provider: 'anonymous' } })).toEqual({});
  });

  it('only the auth server role runs the hook', async () => {
    const [r] = await db.owner<{ auth: boolean; anon: boolean; user: boolean }>(`select
      has_function_privilege('supabase_auth_admin', 'public.auth_before_user_created(jsonb)', 'execute') as auth,
      has_function_privilege('anon', 'public.auth_before_user_created(jsonb)', 'execute') as anon,
      has_function_privilege('authenticated', 'public.auth_before_user_created(jsonb)', 'execute') as user`);
    expect(r).toEqual({ auth: true, anon: false, user: false });
  });

  it('a Google token (mixed-case email claim) can create a family and accept a parent invite', async () => {
    const primary = await db.newParent('g1', 'Dana.Cohen@Gmail.com');
    await db.as(admin, `select public.invite_primary('dana.cohen@gmail.com')`);
    const [{ id }] = await db.as<{ id: string }>(primary, `select public.create_family('משפחה') as id`);
    const parent = await db.newParent('g2', 'Second.Parent@GMAIL.com');
    await db.as(primary, `select public.invite_parent($1, 'second.parent@gmail.com')`, [id]);
    expect(await db.as(parent, `select * from public.accept_invites() as f`)).toEqual([{ f: id }]);
  });

  it('the owner bootstraps their own invite from the SQL editor; nobody else can call it', async () => {
    await db.owner(`select private.owner_invite_primary('the.owner@gmail.com')`);
    expect(await hook({ email: 'The.Owner@gmail.com', is_anonymous: false, app_metadata: { provider: 'google' } })).toEqual({});
    await denied(db.as(admin, `select private.owner_invite_primary('x@gmail.com')`));
  });
});

describe('the daily job log and the keep-alive answer', () => {
  it('keep_alive is false before any run, true after a clean run, false after a late erasure', async () => {
    const keepAlive = async () => (await db.as<{ ok: boolean }>(null, `select public.keep_alive() as ok`))[0].ok;
    expect(await keepAlive()).toBe(false);
    await db.owner(`select private.daily_maintenance()`);
    expect(await keepAlive()).toBe(true);
    // A run 27 hours ago only: the job stopped running.
    await db.owner(`update private.retention_runs set ran_at = ran_at - interval '27 hours'`);
    expect(await keepAlive()).toBe(false);
    await db.owner(`select private.daily_maintenance()`);
    expect(await keepAlive()).toBe(true);
    await db.owner(`insert into private.retention_runs (ran_at, erased_late) values (date_trunc('hour', now(), 'UTC') - interval '3 days', 1)`);
    expect(await keepAlive()).toBe(false);
  });

  it('the log holds no ids and is unreadable from the API', async () => {
    const cols = await db.owner<{ c: string }>(`select column_name as c from information_schema.columns
      where table_schema = 'private' and table_name = 'retention_runs' order by 1`);
    expect(cols.map((r) => r.c)).toEqual(['erased_late', 'ran_at']);
    await denied(db.as(admin, `select * from private.retention_runs`));
    await denied(db.as(null, `select * from private.retention_runs`));
    await denied(db.as(admin, `select private.daily_maintenance()`));
  });
});

describe('admin status (shows that admin actions worked)', () => {
  it('the admin sees their status and when pending primary invites expire; others see only false', async () => {
    await db.as(admin, `select public.invite_primary('status.check@gmail.com')`);
    const [a] = await db.as<{ is_admin: boolean; n: number }>(admin, `select is_admin, cardinality(primary_invites_expiring) as n from public.my_admin_status()`);
    expect(a.is_admin).toBe(true);
    expect(a.n).toBeGreaterThanOrEqual(1);
    const other = await db.newParent('not-admin', 'someone.else@gmail.com');
    expect(await db.as(other, `select is_admin, cardinality(primary_invites_expiring) as n from public.my_admin_status()`)).toEqual([{ is_admin: false, n: 0 }]);
    const [{ anon }] = await db.owner<{ anon: boolean }>(`select has_function_privilege('anon', 'public.my_admin_status()', 'execute') as anon`);
    expect(anon).toBe(false);
  });
});
