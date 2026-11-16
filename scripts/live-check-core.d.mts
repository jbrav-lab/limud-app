// Types for live-check-core.mjs (used by src/server-tests/live-check.test.ts).
export type Query = (sql: string, params?: unknown[]) => Promise<Record<string, any>[]>;

export interface LiveCheckOptions {
  /** privilegeMatrix() of a database built from the migrations (PGlite). */
  reference: string[];
  /** Migration versions (file-name prefixes) expected in supabase_migrations.schema_migrations. */
  expectedMigrations: string[];
  expectCron: boolean;
  expectMigrationTable: boolean;
}

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export const TEST_PREFIX: string;
export function privilegeMatrix(q: Query): Promise<string[]>;
export function guardRealData(q: Query, options?: { allowRealData?: boolean }): Promise<number>;
export function runLiveChecks(q: Query, options: LiveCheckOptions): Promise<CheckResult[]>;
export function testFamilyCommand(q: Query, cmd: 'create' | 'delete' | 'status'): Promise<string[]>;
