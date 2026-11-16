// Access control for the sync database (docs/security-privacy.md §7 and OWASP A01 / API1).
// Every "can't" is tested as strictly as every "can".
import { beforeAll, describe, expect, it } from 'vitest';
import { BOOT_TIMEOUT, REFUSED, denied, uuid, type Caller, type TestDb } from './db';
import { buildWorld, type World } from './fixtures';

let w: World;
let db: TestDb;
let bSnapshot: string;

/** Every table in `public`, with the column that ties a row to a family (null: not family data). */
const TABLES: Record<string, string | null> = {
  families: 'id',
  family_members: 'family_id',
  app_admins: null,
  devices: 'family_id',
  children: 'family_id',
  device_children: 'family_id',
  device_pairings: 'family_id',
  child_device_totals: 'family_id',
  daily_activity: 'family_id',
  topic_progress: 'family_id',
  exam_results: 'family_id',
  mistakes: 'family_id',
  tests: 'family_id',
  test_answer_keys: 'family_id',
  test_assignments: 'family_id',
  invites: 'family_id',
  deletion_requests: 'family_id',
  audit_log: null,
  deletion_proofs: null,
  consent_records: 'family_id',
  ref_schools: null,
  ref_grades: null,
};
const FAMILY_TABLES = Object.entries(TABLES).filter(([, c]) => c) as [string, string][];

/** All of family B's rows, as the owner sees them. */
async function snapshotB(): Promise<string> {
  const parts: string[] = [];
  for (const [t, col] of FAMILY_TABLES) {
    const rows = await db.owner(`select row_to_json(x)::text as j from public.${t} x where ${col} = $1 order by 1`, [w.B.id]);
    parts.push(t + ':' + rows.map((r) => r.j).join('|'));
  }
  return parts.join('\n');
}

const isRefusal = (e: unknown) => REFUSED.includes((e as { code?: string }).code ?? '');

/** A "no privilege" error counts as seeing nothing; any other error is a broken test. */
function noPrivilege(e: unknown): Record<string, unknown>[] {
  if (isRefusal(e)) return [];
  throw e;
}

/** Refused: either a refusal error, or the statement touched no row. */
async function blocked(caller: Caller | null, sql: string, params: unknown[] = []): Promise<boolean> {
  try {
    return (await db.affected(caller, sql, params)) === 0;
  } catch (e) {
    if (isRefusal(e)) return true;
    throw e;
  }
}

async function visible(caller: Caller | null, table: string, col: string, family: string): Promise<number> {
  try {
    const rows = await db.as(caller, `select ${col} from public.${table} where ${col} = $1`, [family]);
    return rows.length;
  } catch (e) {
    if (isRefusal(e)) return -1; // no privilege at all
    throw e;
  }
}

beforeAll(async () => {
  w = await buildWorld();
  db = w.db;
  // Give family B one of every kind of pending row, so every table has something to protect.
  await db.as(w.B.primary, `select public.invite_parent($1, 'pending.b@example.org')`, [w.B.id]);
  await db.as(w.B.primary, `select public.create_device_pairing($1, null, $2::uuid[])`, [w.B.id, [w.B.child2]]);
  await db.as(w.B.parent, `select public.request_child_deletion($1)`, [w.B.child2]);
  bSnapshot = await snapshotB();
}, BOOT_TIMEOUT);

describe('schema guarantees', () => {
  it('every table in public has Row Level Security on', async () => {
    const off = await db.owner(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`);
    expect(off).toEqual([]);
  });

  it('this test file covers every table (a new table needs a cross-family test)', async () => {
    const rows = await db.owner<{ relname: string }>(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`);
    expect(rows.map((r) => r.relname).sort()).toEqual(Object.keys(TABLES).sort());
  });

  it('the anon role (not signed in) has no privilege on any table, and runs only the keep-alive function', async () => {
    const tables = await db.owner(`select table_name, privilege_type from information_schema.role_table_grants
      where grantee in ('anon', 'PUBLIC') and table_schema in ('public', 'private')`);
    expect(tables).toEqual([]);
    const cols = await db.owner(`select table_name from information_schema.column_privileges
      where grantee in ('anon', 'PUBLIC') and table_schema in ('public', 'private')`);
    expect(cols).toEqual([]);
    const fns = await db.owner(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')`);
    expect(fns).toEqual([{ proname: 'keep_alive' }]);
  });

  it('every security definer function sets search_path', async () => {
    const bad = await db.owner(`select n.nspname || '.' || p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.prosecdef and n.nspname in ('public', 'private')
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    expect(bad).toEqual([]);
  });

  it('signed-in callers can execute only the API and the RLS helpers', async () => {
    const fns = await db.owner<{ f: string }>(`select n.nspname || '.' || p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'execute') order by 1`);
    expect(fns.map((r) => r.f)).toEqual([
      'private.is_admin', 'private.is_anonymous_caller', 'private.my_child_ids', 'private.my_device_family',
      'private.my_device_id', 'private.my_family_ids', 'private.my_hmac', 'private.my_test_ids',
    ]);
    const owner = await db.owner(`select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where ((n.nspname = 'private' and p.proname in ('run_retention', 'daily_maintenance', 'owner_invite_primary', 'add_admin', 'erase_family', 'hmac', 'decrypt_text'))
          or (n.nspname = 'public' and p.proname = 'auth_before_user_created'))
        and has_function_privilege('authenticated', p.oid, 'execute')`);
    expect(owner).toEqual([]);
  });

  it('nobody signed in can read a sign-in fingerprint (auth_hmac)', async () => {
    await denied(db.as(w.A.primary, `select auth_hmac from public.family_members`));
    await denied(db.as(w.A.device, `select auth_hmac from public.devices`));
    await denied(db.as(w.A.primary, `select email_hmac from public.invites`));
  });
});

describe('not signed in (anon)', () => {
  it.each(Object.keys(TABLES))('can read nothing from %s', async (t) => {
    await denied(db.as(null, `select * from public.${t}`));
  });

  it('can call no function', async () => {
    await denied(db.as(null, `select * from public.my_families()`));
    await denied(db.as(null, `select public.redeem_device_pairing('ABCDEFGHJK', $1)`, [uuid()]));
  });
});

describe('family A can never read family B', () => {
  const callers = ['primary', 'parent', 'device'] as const;
  for (const who of callers) {
    it.each(FAMILY_TABLES)(`A's ${who}: no rows of B in %s`, async (t, col) => {
      const n = await visible(w.A[who], t, col, w.B.id);
      expect(n === 0 || n === -1).toBe(true);
    });
  }

  it('a stranger (signed in, no family) sees no family rows at all', async () => {
    for (const [t, col] of FAMILY_TABLES) {
      const rows = await db.as(w.stranger, `select ${col} from public.${t}`).catch(noPrivilege);
      expect(rows, t).toEqual([]);
    }
  });

  it("A's API calls on B's ids are refused", async () => {
    const p = w.A.primary;
    const B = w.B;
    const [req] = await db.owner<{ id: string }>(`select id from public.deletion_requests where family_id = $1`, [B.id]);
    const calls: [string, unknown[]][] = [
      [`select * from public.family_children($1)`, [B.id]],
      [`select * from public.family_devices($1)`, [B.id]],
      [`select public.invite_parent($1, 'x@example.org')`, [B.id]],
      [`select public.rename_family($1, 'x')`, [B.id]],
      [`select public.record_consent($1, '1')`, [B.id]],
      [`select public.hand_over_primary($1, $2)`, [B.id, B.parentMember]],
      [`select public.create_device_pairing($1, null, '{}')`, [B.id]],
      [`select public.upsert_child($1, $2, 'x', '🐶', 5, null, now())`, [B.child1, B.id]],
      [`select public.upsert_child($1, $2, 'x', '🐶', 5, null, now())`, [uuid(), B.id]],
      [`select public.upsert_child($1, $2, 'x', '🐶', 5, null, now())`, [B.child1, w.A.id]],
      [`select public.set_device_children($1, $2::uuid[])`, [B.deviceId, [B.child1]]],
      [`select public.set_device_children($1, $2::uuid[])`, [w.A.deviceId, [B.child1]]],
      [`select public.revoke_device($1)`, [B.deviceId]],
      [`select public.rename_device($1, 'x')`, [B.deviceId]],
      [`select public.mark_exam_seen($1)`, [B.examId]],
      [`select public.release_test($1)`, [B.assignmentId]],
      [`select public.request_child_deletion($1)`, [B.child1]],
      [`select public.request_family_deletion($1)`, [B.id]],
      [`select public.approve_deletion($1)`, [req.id]],
      [`select public.cancel_deletion_request($1)`, [req.id]],
      [`select public.request_member_removal($1, $2)`, [B.id, B.parentMember]],
      [`select public.restore_child($1)`, [B.child1]],
      [`select public.restore_family($1)`, [B.id]],
    ];
    for (const [sql, params] of calls) {
      await denied(db.as(p, sql, params));
    }
  });

  it("A's device can't write B's progress or answer B's test", async () => {
    const d = w.A.device;
    const B = w.B;
    const writes: [string, unknown[]][] = [
      [`insert into public.child_device_totals (child_id, device_id, family_id, stars, sessions, updated_at) values ($1, $2, $3, 1, 1, now())`, [B.child1, w.A.deviceId, B.id]],
      [`insert into public.child_device_totals (child_id, device_id, family_id, stars, sessions, updated_at) values ($1, $2, $3, 1, 1, now())`, [B.child1, B.deviceId, B.id]],
      [`insert into public.child_device_totals (child_id, device_id, family_id, stars, sessions, updated_at) values ($1, $2, $3, 1, 1, now())`, [B.child1, w.A.deviceId, w.A.id]],
      [`insert into public.daily_activity (child_id, device_id, family_id, day, answered) values ($1, $2, $3, current_date, 1)`, [B.child1, w.A.deviceId, B.id]],
      [`insert into public.topic_progress (child_id, topic_id, family_id, level, run_correct, run_wrong, attempts, first_try, second_try, by_level, last_at, updated_at) values ($1, 'g5.math.x', $2, 1, 0, 0, 0, 0, 0, '{0,0,0}', now(), now())`, [B.child1, B.id]],
      [`insert into public.exam_results (id, child_id, family_id, pack_id, topic_ids, difficulty, questions, correct, score, taken_at) values ($1, $2, $3, 'g5.math', '{}', 'easy', 1, 1, 100, now())`, [uuid(), B.child1, B.id]],
      [`insert into public.mistakes (id, child_id, family_id, topic_id, prompt, given, correct, at) values ($1, $2, $3, 't', 'p', 'g', 'c', now())`, [uuid(), B.child1, B.id]],
      [`select public.submit_test_answers($1, '[]')`, [B.assignmentId]],
    ];
    for (const [sql, params] of writes) {
      await denied(db.as(d, sql, params));
    }
  });

  it("A's parents can't create B's tests or assignments", async () => {
    await denied(db.as(w.A.parent, `insert into public.tests (family_id, grade, pack_id, topic_ids, questions) values ($1, 5, 'g5.math', '{}', '[]')`, [w.B.id]));
    await denied(db.as(w.A.parent, `insert into public.test_answer_keys (test_id, family_id, answers) values ($1, $2, '[]')`, [w.B.testId, w.B.id]));
    await denied(db.as(w.A.parent, `insert into public.test_assignments (test_id, child_id, family_id) values ($1, $2, $3)`, [w.B.testId, w.B.child2, w.B.id]));
    // Mixing: A's family id with B's test or child.
    await denied(db.as(w.A.parent, `insert into public.test_answer_keys (test_id, family_id, answers) values ($1, $2, '[]')`, [w.B.testId, w.A.id]));
    await denied(db.as(w.A.parent, `insert into public.test_assignments (test_id, child_id, family_id) values ($1, $2, $3)`, [w.A.testId, w.B.child2, w.A.id]));
  });

  it.each(FAMILY_TABLES)("A can't update or delete B's rows in %s", async (t, col) => {
    for (const who of ['primary', 'parent', 'device'] as const) {
      expect(await blocked(w.A[who], `update public.${t} set ${col} = ${col} where ${col} = $1`, [w.B.id])).toBe(true);
      expect(await blocked(w.A[who], `delete from public.${t} where ${col} = $1`, [w.B.id])).toBe(true);
    }
  });

  it("family B's data is exactly as before all of the above", async () => {
    expect(await snapshotB()).toEqual(bSnapshot);
  });
});

describe('access-control matrix (§7)', () => {
  it('invite a primary user: the admin only (owner decision 2026-11-16)', async () => {
    await db.as(w.admin, `select public.invite_primary('new1@example.org')`);
    await denied(db.as(w.A.primary, `select public.invite_primary('new2@example.org')`));
    await denied(db.as(w.A.parent, `select public.invite_primary('new3@example.org')`));
    await denied(db.as(w.A.device, `select public.invite_primary('new4@example.org')`));
    await denied(db.as(w.stranger, `select public.invite_primary('new5@example.org')`));
  });

  it('create a family: only with a primary-user invite for the caller’s own email, used once', async () => {
    await denied(db.as(w.stranger, `select public.create_family('x')`));
    await denied(db.as(w.admin, `select public.create_family('x')`));
    await denied(db.as(w.A.parent, `select public.create_family('x')`));
    await denied(db.as(w.A.device, `select public.create_family('x')`));
    const p = await db.newParent('new1', 'NEW1@example.org');
    await db.as(p, `select public.create_family('משפחה חדשה')`);
    await denied(db.as(p, `select public.create_family('שוב')`)); // the invite is gone
  });

  it('invite a parent and hand over the primary role: the primary user only', async () => {
    await denied(db.as(w.A.parent, `select public.invite_parent($1, 'z@example.org')`, [w.A.id]));
    await denied(db.as(w.A.device, `select public.invite_parent($1, 'z@example.org')`, [w.A.id]));
    await denied(db.as(w.admin, `select public.invite_parent($1, 'z@example.org')`, [w.A.id]));
    await denied(db.as(w.A.parent, `select public.hand_over_primary($1, $2)`, [w.A.id, w.A.parentMember]));
    await denied(db.as(w.A.parent, `select public.request_member_removal($1, $2)`, [w.A.id, w.A.primaryMember]));
    await denied(db.as(w.A.device, `select public.request_member_removal($1, $2)`, [w.A.id, w.A.parentMember]));
    // The primary can hand over, and the new primary can hand it back.
    await db.as(w.A.primary, `select public.hand_over_primary($1, $2)`, [w.A.id, w.A.parentMember]);
    await denied(db.as(w.A.primary, `select public.invite_parent($1, 'z@example.org')`, [w.A.id]));
    await db.as(w.A.parent, `select public.hand_over_primary($1, $2)`, [w.A.id, w.A.primaryMember]);
    const roles = await db.as<{ member_id: string; role: string }>(w.A.primary,
      `select member_id, role from public.family_members where family_id = $1 order by role`, [w.A.id]);
    expect(roles).toEqual([
      { member_id: w.A.parentMember, role: 'parent' },
      { member_id: w.A.primaryMember, role: 'primary' },
    ]);
  });

  it("read the family's children and progress: parents yes, the admin no", async () => {
    for (const p of [w.A.primary, w.A.parent]) {
      const kids = await db.as<{ name: string }>(p, `select name from public.family_children($1)`, [w.A.id]);
      expect(kids.map((k) => k.name).sort()).toEqual([...w.A.childNames].sort());
      expect(await db.as(p, `select stars from public.child_device_totals where child_id = $1`, [w.A.child1])).toEqual([{ stars: 12 }]);
      expect((await db.as(p, `select id from public.exam_results where family_id = $1`, [w.A.id])).length).toBe(1);
      expect((await db.as(p, `select id from public.tests where family_id = $1`, [w.A.id])).length).toBe(1);
    }
    await denied(db.as(w.admin, `select * from public.family_children($1)`, [w.A.id]));
    for (const [t, col] of FAMILY_TABLES) {
      const rows = await db.as(w.admin, `select ${col} from public.${t}`).catch(noPrivilege);
      expect(rows, t).toEqual([]);
    }
  });

  it('a child device sees only its own children', async () => {
    const kids = await db.as<{ id: string; name: string }>(w.A.device, `select id, name from public.device_children_list()`);
    expect(kids).toEqual([{ id: w.A.child1, name: w.A.childNames[0] }]);
    expect(await db.as(w.A.device, `select id from public.children`)).toEqual([{ id: w.A.child1 }]);
    await denied(db.as(w.A.device, `select * from public.family_children($1)`, [w.A.id]));
    expect(await db.as(w.A.device, `select * from public.my_families()`)).toEqual([]);
    expect(await db.as(w.A.device, `select family_id from public.family_members`)).toEqual([]);
  });

  it('a child device writes only its own children, under its own device id', async () => {
    const d = w.A.device;
    await denied(db.as(d, `insert into public.daily_activity (child_id, device_id, family_id, day, answered) values ($1, $2, $3, current_date, 5)`, [w.A.child2, w.A.deviceId, w.A.id]));
    // Its own child is fine; a counter never goes down (grow-only).
    await db.as(d, `update public.child_device_totals set stars = 3 where child_id = $1`, [w.A.child1]);
    expect(await db.owner(`select stars from public.child_device_totals where child_id = $1`, [w.A.child1])).toEqual([{ stars: 12 }]);
    await db.as(d, `insert into public.child_device_totals (child_id, device_id, family_id, stars, sessions, updated_at) values ($1, $2, $3, 15, 4, now())
                    on conflict (child_id, device_id) do update set stars = excluded.stars, sessions = excluded.sessions, updated_at = excluded.updated_at`,
      [w.A.child1, w.A.deviceId, w.A.id]);
    expect(await db.owner(`select stars, sessions from public.child_device_totals where child_id = $1`, [w.A.child1])).toEqual([{ stars: 15, sessions: 4 }]);
    // Results are immutable.
    await denied(db.as(d, `update public.exam_results set score = 100 where id = $1`, [w.A.examId]));
    await denied(db.as(d, `delete from public.mistakes where id = $1`, [w.A.mistakeId]));
    await denied(db.as(d, `insert into public.exam_results (id, child_id, family_id, pack_id, topic_ids, difficulty, questions, correct, score, taken_at, seen_by_parent_at) values ($1, $2, $3, 'g5.math', '{}', 'easy', 1, 1, 100, now(), now())`, [uuid(), w.A.child1, w.A.id]));
  });

  it('parents can’t write practice progress', async () => {
    await denied(db.as(w.A.parent, `insert into public.daily_activity (child_id, device_id, family_id, day, answered) values ($1, $2, $3, current_date - 3, 5)`, [w.A.child1, w.A.deviceId, w.A.id]));
    await denied(db.as(w.A.primary, `insert into public.mistakes (id, child_id, family_id, topic_id, prompt, given, correct, at) values ($1, $2, $3, 't', 'p', 'g', 'c', now())`, [uuid(), w.A.child1, w.A.id]));
    expect(await blocked(w.A.parent, `update public.child_device_totals set stars = 99 where child_id = $1`, [w.A.child1])).toBe(true);
  });

  it('tests: a device reads assigned questions only, never the answer key, and no score before release', async () => {
    const d = w.A.device;
    expect(await db.as(d, `select id from public.tests`)).toEqual([{ id: w.A.testId }]);
    expect(await db.as(d, `select test_id from public.test_answer_keys`)).toEqual([]);
    expect(await db.as(d, `select id from public.test_assignments`)).toEqual([]);
    await denied(db.as(d, `insert into public.tests (family_id, grade, pack_id, topic_ids, questions) values ($1, 5, 'g5.math', '{}', '[]')`, [w.A.id]));
    await denied(db.as(d, `select public.release_test($1)`, [w.A.assignmentId]));
    await denied(db.as(d, `select public.submit_test_answers($1, '["1"]')`, [w.A.assignmentId])); // already submitted
    await db.owner(`update public.test_assignments set score = 100 where id = $1`, [w.A.assignmentId]);
    let [t] = await db.as<{ released: boolean; score: number | null; note: string | null }>(d, `select released, score, note from public.device_tests()`);
    expect(t).toEqual({ released: false, score: null, note: null });
    await db.as(w.A.parent, `select public.release_test($1, 'כל הכבוד')`, [w.A.assignmentId]);
    [t] = await db.as(d, `select released, score, note from public.device_tests()`);
    expect(t).toEqual({ released: true, score: 100, note: 'כל הכבוד' });
    // The parent action is stamped with the family-only member id and a rounded time.
    const [a] = await db.owner<{ released_by: string; on_the_hour: boolean }>(
      `select released_by, released_at = date_trunc('hour', released_at, 'UTC') as on_the_hour from public.test_assignments where id = $1`, [w.A.assignmentId]);
    expect(a).toEqual({ released_by: w.A.parentMember, on_the_hour: true });
    // Tests are frozen, and ownership is set by the server.
    await denied(db.as(w.A.parent, `update public.tests set questions = '[]' where id = $1`, [w.A.testId]));
    const [own] = await db.owner(`select created_by, owner_scope from public.tests where id = $1`, [w.A.testId]);
    expect(own).toEqual({ created_by: w.A.parentMember, owner_scope: 'family' });
  });

  it('revoke a device: parents yes, devices and the admin no; a revoked device loses all access', async () => {
    await denied(db.as(w.A.device, `select public.revoke_device($1)`, [w.A.deviceId]));
    await denied(db.as(w.admin, `select public.revoke_device($1)`, [w.A.deviceId]));
    const devices = await db.as<{ label: string }>(w.A.parent, `select label from public.family_devices($1)`, [w.A.id]);
    expect(devices).toEqual([{ label: w.A.deviceLabel }]);
    await db.as(w.A.parent, `select public.revoke_device($1)`, [w.A.deviceId]);
    expect(await db.as(w.A.device, `select * from public.device_children_list()`)).toEqual([]);
    expect(await db.as(w.A.device, `select id from public.children`)).toEqual([]);
    await denied(db.as(w.A.device, `insert into public.daily_activity (child_id, device_id, family_id, day, answered) values ($1, $2, $3, current_date - 1, 5)`, [w.A.child1, w.A.deviceId, w.A.id]));
    // Its progress stays with the child.
    expect(await db.as(w.A.parent, `select stars from public.child_device_totals where child_id = $1`, [w.A.child1])).toEqual([{ stars: 15 }]);
  });

  it('reference lists (schools, grades): the admin manages them, nobody else', async () => {
    await db.as(w.admin, `insert into public.ref_grades (grade, label) values (5, 'כיתה ה׳')`);
    await db.as(w.admin, `insert into public.ref_schools (name) values ('בית ספר לדוגמה')`);
    for (const c of [w.A.primary, w.A.parent, w.A.device]) {
      await denied(db.as(c, `insert into public.ref_schools (name) values ('x')`));
      expect(await blocked(c, `update public.ref_grades set label = 'x'`)).toBe(true);
      expect(await blocked(c, `delete from public.ref_schools`)).toBe(true);
    }
    expect(await db.as(w.A.parent, `select label from public.ref_grades`)).toEqual([{ label: 'כיתה ה׳' }]);
    expect(await db.as(w.A.device, `select label from public.ref_grades`)).toEqual([]);
    await db.owner(`delete from public.ref_grades`);
    await db.owner(`delete from public.ref_schools`);
  });

  it('read names: own family only; the admin reads none', async () => {
    expect(await db.as(w.A.primary, `select name from public.my_families()`)).toEqual([{ name: w.A.name }]);
    expect(await db.as(w.admin, `select name from public.my_families()`)).toEqual([]);
    // Directly, names are only ciphertext.
    const [row] = await db.as<{ name_enc: Uint8Array }>(w.A.primary, `select name_enc from public.children where id = $1`, [w.A.child1]);
    expect(new TextDecoder().decode(row.name_enc)).not.toContain(w.A.childNames[0]);
  });

  it('pairing codes are single-use, and wrong codes are refused quietly', async () => {
    const [{ code }] = await db.as<{ code: string }>(w.B.primary, `select public.create_device_pairing($1, null, $2::uuid[]) as code`, [w.B.id, [w.B.child2]]);
    expect(code).toMatch(/^[A-Z2-9]{10}$/);
    const phone = await db.newDeviceUser('B.phone2');
    // A parent account can't pose as a device.
    await denied(db.as(w.B.parent, `select public.redeem_device_pairing($1, $2)`, [code, uuid()]));
    expect(await db.as(phone, `select public.redeem_device_pairing('WRONGCODE2', $1) as f`, [uuid()])).toEqual([{ f: null }]);
    expect(await db.as(phone, `select public.redeem_device_pairing($1, $2) as f`, [code, uuid()])).toEqual([{ f: w.B.id }]);
    const other = await db.newDeviceUser('B.phone3');
    expect(await db.as(other, `select public.redeem_device_pairing($1, $2) as f`, [code, uuid()])).toEqual([{ f: null }]);
    expect(await db.as<{ id: string }>(phone, `select id from public.device_children_list()`)).toEqual([{ id: w.B.child2 }]);
  });
});
