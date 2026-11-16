// Test harness for the database migrations in supabase/migrations/.
// Runs them in PGlite (Postgres compiled to WebAssembly) on top of a small shim for the
// Supabase-only pieces (shims/supabase-shim.sql). See docs/sync-supabase-plan.md §9 for what the
// shim stands in for and what must be re-checked on a real Supabase stack.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import shim from './shims/supabase-shim.sql?raw';

const migrationFiles = import.meta.glob('/supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Migrations in the order the Supabase CLI applies them (by file name). */
export const MIGRATIONS = Object.keys(migrationFiles)
  .sort()
  .map((path) => ({ path, sql: migrationFiles[path] }));

export const BOOT_TIMEOUT = 180_000;

/** A signed-in caller: a parent (email sign-in) or a child device (anonymous sign-in). */
export interface Caller {
  id: string;
  email?: string;
  anonymous: boolean;
  label: string;
}

type Row = Record<string, unknown>;

export class TestDb {
  private constructor(readonly pg: PGlite) {}

  static async create(): Promise<TestDb> {
    const pg = await PGlite.create({ extensions: { pgcrypto } });
    await pg.exec(shim);
    for (const m of MIGRATIONS) {
      try {
        await pg.exec(m.sql);
      } catch (e) {
        throw new Error(`migration ${m.path} failed: ${(e as Error).message}`);
      }
    }
    // The owner's one-time key setup (supabase/migrations/…_foundation.sql, header).
    await pg.exec(`
      select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'limud_hmac_key');
      select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'limud_name_key');
    `);
    return new TestDb(pg);
  }

  /** As the database owner (migrations, maintenance job, test setup). Bypasses RLS. */
  async owner<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec('reset role');
    return (await this.pg.query<T>(sql, params)).rows;
  }

  /** As an API caller. `null` = not signed in (the `anon` role). */
  async as<T extends Row = Row>(caller: Caller | null, sql: string, params: unknown[] = []): Promise<T[]> {
    const claims = caller
      ? JSON.stringify({ sub: caller.id, email: caller.email, role: 'authenticated', is_anonymous: caller.anonymous })
      : JSON.stringify({ role: 'anon' });
    await this.pg.exec('reset role');
    await this.pg.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
    await this.pg.exec(caller ? 'set role authenticated' : 'set role anon');
    try {
      return (await this.pg.query<T>(sql, params)).rows;
    } finally {
      await this.pg.exec('reset role');
      await this.pg.query(`select set_config('request.jwt.claims', '', false)`);
    }
  }

  /** Number of rows an UPDATE or DELETE touched, as a caller. */
  async affected(caller: Caller | null, sql: string, params: unknown[] = []): Promise<number> {
    const rows = await this.as<{ n: number }>(caller, `with x as (${sql} returning 1) select count(*)::int as n from x`, params);
    return rows[0].n;
  }

  async newParent(label: string, email: string): Promise<Caller> {
    const [u] = await this.owner<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
    return { id: u.id, email, anonymous: false, label };
  }

  async newDeviceUser(label: string): Promise<Caller> {
    const [u] = await this.owner<{ id: string }>(`insert into auth.users (is_anonymous) values (true) returning id`);
    return { id: u.id, anonymous: true, label };
  }

  /** Move a row's time back (to test the 48-hour, 7-day and 7-year rules). */
  async ageBy(table: string, column: string, where: string, interval: string, params: unknown[] = []) {
    await this.owner(`update public.${table} set ${column} = ${column} - interval '${interval}' where ${where}`, params);
  }
}

/**
 * Error codes that mean "refused": no privilege or RLS (42501), invalid input (22023),
 * blocked by a deletion rule (55006), a rule check (23514), already requested (23505).
 * Anything else (a typo in the test's SQL, a missing column) fails the test instead of passing it.
 */
export const REFUSED = ['42501', '22023', '55006', '23514', '23505'];

/** The promise must fail with a refusal (not just return zero rows, and not a broken query). */
export async function denied(p: Promise<unknown>, codes: string[] = REFUSED): Promise<string> {
  try {
    await p;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (!codes.includes(code)) {
      throw new Error(`refused for the wrong reason (${code}): ${(e as Error).message}`);
    }
    return (e as Error).message;
  }
  throw new Error('expected the call to be refused, but it succeeded');
}

export const uuid = (): string => crypto.randomUUID();
