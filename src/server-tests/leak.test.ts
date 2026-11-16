// The leak test (docs/family-view-design.md, "Requirement: a database leak must not link an
// email to a child", point 7). Builds two families through the API, then takes a "dump" of every
// public table with the Vault keys gone, and checks that nothing in it links a sign-in (id or
// email) to a family or child, that accepted invites leave no trace, and that names are unreadable.
import { beforeAll, describe, expect, it } from 'vitest';
import { BOOT_TIMEOUT, denied, type TestDb } from './db';
import { buildWorld, type World } from './fixtures';

let w: World;
let db: TestDb;
let dump = '';
let users: { id: string; email: string | null }[] = [];
let acceptedEmailHmacs: string[] = [];
let pendingInviteCount = 0;

const hex = (s: string) => s.toLowerCase();
const textHex = (s: string) => Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');

beforeAll(async () => {
  w = await buildWorld();
  db = w.db;
  // One invite that is never accepted, to show that expiry removes it too.
  await db.as(w.A.primary, `select public.invite_parent($1, 'never.accepts@example.org')`, [w.A.id]);
  pendingInviteCount = (await db.owner(`select 1 from public.invites`)).length;

  users = await db.owner<{ id: string; email: string | null }>(`select id::text, email from auth.users`);
  // While the key still exists: the HMACs that accepted invites had (to prove they are gone).
  const accepted = [w.A.parent, w.B.parent, w.A.primary, w.B.primary].map((c) => c.email!);
  acceptedEmailHmacs = (await db.owner<{ h: string }>(
    `select encode(private.hmac('email:' || lower(e)), 'hex') as h from unnest($1::text[]) e`, [accepted])).map((r) => r.h);

  // The attacker's copy: every public table, with the Vault keys unavailable.
  await db.owner(`delete from vault.secrets`);
  const tables = await db.owner<{ t: string }>(`select tablename as t from pg_tables where schemaname = 'public' order by 1`);
  const parts: string[] = [];
  for (const { t } of tables) {
    const rows = await db.owner<{ j: string }>(`select row_to_json(x)::text as j from public.${t} x`);
    parts.push(`${t}: ${rows.map((r) => r.j).join('\n')}`);
  }
  dump = parts.join('\n').toLowerCase();
}, BOOT_TIMEOUT);

describe('leak test: a dump without the Vault keys', () => {
  it('has data in it (the test is not vacuous)', () => {
    for (const t of ['families', 'family_members', 'children', 'devices', 'exam_results', 'mistakes', 'tests']) {
      expect(dump).toMatch(new RegExp(`^${t}: \\{`, 'm'));
    }
    expect(users.length).toBeGreaterThanOrEqual(8);
  });

  it('contains no auth.users id, in any form', () => {
    for (const u of users) {
      expect(dump).not.toContain(u.id);
      expect(dump).not.toContain(u.id.replace(/-/g, '')); // as raw bytes (hex)
      expect(dump).not.toContain(textHex(u.id)); // as text bytes in a bytea column
    }
  });

  it('contains no email address and no unkeyed hash of an id or email', async () => {
    const values: string[] = [];
    for (const u of users) {
      values.push(u.id, `uid:${u.id}`);
      if (u.email) values.push(u.email, u.email.toLowerCase(), `email:${u.email.toLowerCase()}`);
    }
    for (const u of users) if (u.email) expect(dump).not.toContain(u.email.toLowerCase());
    const hashes = await db.owner<{ h: string }>(
      `select encode(extensions.digest(v, a), 'hex') as h from unnest($1::text[]) v, unnest(array['md5', 'sha1', 'sha256', 'sha512']) a`,
      [values]);
    expect(hashes.length).toBe(values.length * 4);
    for (const { h } of hashes) expect(dump).not.toContain(hex(h));
    // An HMAC with an empty or guessable key doesn't match either.
    const weak = await db.owner<{ h: string }>(
      `select encode(extensions.hmac(v, k, 'sha256'), 'hex') as h from unnest($1::text[]) v, unnest(array['', 'secret', 'limud', 'limud_hmac_key']) k`,
      [values]);
    for (const { h } of weak) expect(dump).not.toContain(hex(h));
  });

  it('leaves no trace of an accepted invite', async () => {
    for (const h of acceptedEmailHmacs) expect(dump).not.toContain(h);
    // Only the one never-accepted invite is left, and the expiry job removes it.
    expect(pendingInviteCount).toBe(1);
    expect((await db.owner(`select 1 from public.invites`)).length).toBe(1);
    await db.owner(`update public.invites set expires_at = expires_at - interval '7 days'`);
    await db.owner(`select private.run_retention()`);
    expect(await db.owner(`select 1 from public.invites`)).toEqual([]);
  });

  it('shows no name, family name or device label in plain text', () => {
    for (const f of [w.A, w.B]) {
      for (const n of [f.name, ...f.childNames, f.deviceLabel]) expect(dump).not.toContain(n.toLowerCase());
    }
  });

  it('contains no IP address', () => {
    expect(dump).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  });

  it('parent action times are on the hour, so they never equal a sign-in time', async () => {
    const times = await db.owner(`
      select t from (
        select created_at as t from public.families union all
        select joined_at from public.family_members union all
        select linked_at from public.devices union all
        select created_at from public.tests union all
        select released_at from public.test_assignments where released_at is not null union all
        select at from public.audit_log
      ) x where t <> date_trunc('hour', t, 'UTC') or t in (select last_sign_in_at from auth.users)`);
    expect(times).toEqual([]);
  });
});

describe('leak test: no query can join an email to a child', () => {
  it('no public column references the auth schema, and no column holds a sign-in id, email or IP', async () => {
    const fks = await db.owner(`select conname from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      join pg_class r on r.oid = c.confrelid join pg_namespace rn on rn.oid = r.relnamespace
      where n.nspname = 'public' and c.contype = 'f' and rn.nspname = 'auth'`);
    expect(fks).toEqual([]);
    const cols = await db.owner(`select table_name, column_name, data_type from information_schema.columns
      where table_schema = 'public' and (column_name ~ '(email|user_id|ip_|^ip$|address|phone)' or data_type in ('inet', 'cidr'))
        and column_name not in ('email_hmac')`);
    expect(cols).toEqual([]);
  });

  it('no view or function in public reads auth.users', async () => {
    const views = await db.owner(`select viewname from pg_views where schemaname = 'public'`);
    expect(views).toEqual([]);
    const fns = await db.owner(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosrc ~* 'auth\\.users'`);
    expect(fns).toEqual([]);
  });

  it('joining auth.users to every uuid, text or bytea column finds nothing', async () => {
    const cols = await db.owner<{ table_name: string; column_name: string; data_type: string }>(
      `select table_name, column_name, data_type from information_schema.columns
       where table_schema = 'public' and data_type in ('uuid', 'text', 'bytea', 'ARRAY', 'jsonb')`);
    expect(cols.length).toBeGreaterThan(30);
    for (const c of cols) {
      const v = `x.${c.column_name}`;
      const match =
        c.data_type === 'uuid' ? `${v} = u.id` :
        c.data_type === 'bytea' ? `${v} in (extensions.digest(u.id::text, 'sha256'), extensions.digest('uid:' || u.id::text, 'sha256'),
                                      extensions.digest(coalesce(lower(u.email), '-'), 'sha256'), decode(replace(u.id::text, '-', ''), 'hex'),
                                      convert_to(u.id::text, 'UTF8'), convert_to(coalesce(lower(u.email), '-'), 'UTF8'))` :
        `${v}::text ilike '%' || u.id::text || '%' or (u.email is not null and ${v}::text ilike '%' || u.email || '%')`;
      const [{ n }] = await db.owner<{ n: number }>(
        `select count(*)::int as n from public.${c.table_name} x join auth.users u on ${match}`);
      expect(n, `${c.table_name}.${c.column_name}`).toBe(0);
    }
  });

  it('without the key, the server fails closed: nothing resolves a sign-in to a family', async () => {
    const msg = await denied(db.as(w.A.primary, `select * from public.my_families()`), ['55000']);
    expect(msg).toMatch(/key unavailable/);
    await denied(db.as(w.A.primary, `select family_id from public.children`), ['55000']);
    await denied(db.as(w.A.device, `select * from public.device_children_list()`), ['55000']);
  });
});
