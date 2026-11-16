// Tests the live-check script (scripts/live-check-core.mjs) on PGlite: on a correct database
// every check passes, and it catches a wrong grant, a missing policy and real data.
import { beforeAll, describe, expect, it } from 'vitest';
import { BOOT_TIMEOUT, MIGRATIONS, TestDb } from './db';
import { guardRealData, privilegeMatrix, runLiveChecks, testFamilyCommand, type Query } from '../../scripts/live-check-core.mjs';

let reference: string[];
const query = (db: TestDb): Query => async (sql, params) => (await db.pg.query<Record<string, unknown>>(sql, params)).rows;
const options = (ref: string[]) => ({
  reference: ref,
  expectedMigrations: MIGRATIONS.map((m) => m.path.split('/').pop()!.split('_')[0]),
  expectCron: false, // no pg_cron in PGlite
  expectMigrationTable: false, // no CLI history table in PGlite
});

beforeAll(async () => {
  reference = await privilegeMatrix(query(await TestDb.create()));
}, BOOT_TIMEOUT);

describe('live check (run against PGlite)', () => {
  it('passes every check on a database built from the migrations, and leaves nothing behind', async () => {
    const db = await TestDb.create();
    const q = query(db);
    const before = await q(`select (select count(*) from auth.users)::int as u, (select count(*) from public.audit_log)::int as a`);
    const results = await runLiveChecks(q, options(reference));
    expect(results.filter((r) => !r.ok)).toEqual([]);
    expect(results.length).toBeGreaterThanOrEqual(10);
    expect(await q(`select (select count(*) from auth.users)::int as u, (select count(*) from public.audit_log)::int as a`)).toEqual(before);
    expect(await q(`select count(*)::int as n from public.families`)).toEqual([{ n: 0 }]);
  }, BOOT_TIMEOUT);

  it('fails on a wrong grant, a table without RLS and a readable key', async () => {
    const db = await TestDb.create();
    await db.owner(`grant select on public.audit_log to anon`);
    await db.owner(`alter table public.mistakes disable row level security`);
    await db.owner(`grant execute on function private.vault_key(text) to authenticated`);
    const failed = (await runLiveChecks(query(db), options(reference))).filter((r) => !r.ok).map((r) => r.name);
    expect(failed).toContain('privileges of anon and authenticated match the migrations exactly');
    expect(failed).toContain('row level security is on for every table in public');
    expect(failed).toContain('Vault: not readable by authenticated or anon');
    expect(failed.some((n) => n.startsWith('cross-family isolation'))).toBe(true);
  }, BOOT_TIMEOUT);

  it('refuses to run when a non-test family exists, unless allowed', async () => {
    const db = await TestDb.create();
    const q = query(db);
    expect(await guardRealData(q)).toBe(0);
    await db.owner(`insert into public.families (name_enc, created_at) values (private.encrypt_text('משפחה אמיתית'), date_trunc('hour', now(), 'UTC'))`);
    await expect(guardRealData(q)).rejects.toThrow(/refusing to run/);
    expect(await guardRealData(q, { allowRealData: true })).toBe(1);
  }, BOOT_TIMEOUT);

  it('kept test families: create, delete through the API, erased by the run on D+2, then cleaned up', async () => {
    const db = await TestDb.create();
    const q = query(db);
    const step = async (cmd: 'create' | 'delete' | 'status') => {
      await q('begin');
      const lines = await testFamilyCommand(q, cmd);
      await q('commit');
      return lines.join('\n');
    };
    await step('create');
    expect(await q(`select count(*)::int as n from public.families where deleted_at is null`)).toEqual([{ n: 2 }]);
    expect(await q(`select count(*)::int as n from public.app_admins`)).toEqual([{ n: 0 }]); // test admin removed
    await q('begin');
    await expect(testFamilyCommand(q, 'create')).rejects.toThrow(/already exist/);
    await q('rollback');
    expect(await step('delete')).toMatch(/soft-deleted: true/);
    expect(await step('status')).toMatch(/Test families: 2 \(soft-deleted, waiting for the nightly run: 2\)/);
    await q(`select private.run_retention(now() + interval '1 day')`); // D+1: nothing
    expect(await step('status')).toMatch(/Test families: 2 /);
    await q(`select private.run_retention(now() + interval '2 days')`); // D+2: erased
    expect(await step('status')).toMatch(/Test families: 0 .*\n.*\nErased\. Removed 4 test parent/s);
    expect(await q(`select count(*)::int as n from auth.users where email is not null`)).toEqual([{ n: 0 }]);
  }, BOOT_TIMEOUT);
});
