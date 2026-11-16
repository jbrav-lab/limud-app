#!/usr/bin/env node
// Runs the §9 re-check list (docs/sync-supabase-plan.md) against the live Supabase database.
// Steps: docs/go-live-runbook-stage1.md.
//
//   LIVE_DB_URL      the session-pooler connection string, password included. Set it in the
//                    shell for this one run; it is never printed, logged or written to disk.
//   LIVE_DB_CA       path to the project's CA certificate (Dashboard → Database → SSL
//                    configuration → Download certificate). The server certificate is verified.
//   SUPABASE_URL, SUPABASE_ANON_KEY   (optional) to check the exposed schemas over the API.
//
//   node scripts/live-check.mjs [--allow-real-data]
//
// It refuses to run if the database holds any family that isn't a test family ("TEST-…"),
// unless --allow-real-data is given. Everything it creates is rolled back.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { guardRealData, privilegeMatrix, runLiveChecks } from './live-check-core.mjs';
import { connect, fail } from './live-db.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'supabase', 'migrations');
const migFiles = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();

/** What the privileges should be: the migrations, applied in PGlite on the test shim. */
async function referenceMatrix() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(readFileSync(join(root, 'src', 'server-tests', 'shims', 'supabase-shim.sql'), 'utf8'));
  for (const f of migFiles) await db.exec(readFileSync(join(migDir, f), 'utf8'));
  const m = await privilegeMatrix(async (sql, params) => (await db.query(sql, params)).rows);
  await db.close();
  return m;
}

/** The exposed schemas, over the API: `public` answers; `private`, `vault`, `auth` must not. */
async function apiChecks() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return [{ name: 'exposed schemas over the API', ok: false, detail: 'skipped: set SUPABASE_URL and SUPABASE_ANON_KEY' }];
  const call = (profile) => fetch(`${url}/rest/v1/rpc/keep_alive`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json',
      ...(profile ? { 'content-profile': profile } : {}) },
    body: '{}',
  });
  const out = [];
  const pub = await call(null);
  out.push({ name: 'API: public.keep_alive() answers (false until the first nightly run)', ok: pub.ok,
    detail: `HTTP ${pub.status}: ${(await pub.text()).slice(0, 80)}` });
  for (const s of ['private', 'vault', 'auth', 'graphql_public']) {
    const r = await call(s);
    const body = await r.text();
    out.push({ name: `API: schema ${s} is not exposed`, ok: !r.ok && /PGRST106|schema/i.test(body), detail: `HTTP ${r.status}` });
  }
  return out;
}

async function main() {
  const allowRealData = process.argv.includes('--allow-real-data');
  if (!process.env.LIVE_DB_URL) fail('set LIVE_DB_URL in this shell first (see docs/go-live-runbook-stage1.md).');
  console.log('Building the reference from the migrations (PGlite)…');
  const reference = await referenceMatrix();
  const db = await connect();
  let results;
  try {
    const realFamilies = await guardRealData(db.q, { allowRealData });
    if (realFamilies) console.log(`Note: ${realFamilies} non-test family(ies) present (--allow-real-data).`);
    results = await runLiveChecks(db.q, {
      reference,
      expectedMigrations: migFiles.map((f) => f.split('_')[0]),
      expectCron: true,
      expectMigrationTable: true,
    });
  } catch (e) {
    await db.end();
    fail(e.message);
  }
  await db.end();
  results.push(...(await apiChecks()));

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `\n      ${r.detail}` : ''}`);
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed. Nothing was left in the database (rolled back).`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => fail(e.message));
