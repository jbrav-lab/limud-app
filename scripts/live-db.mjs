// Connecting to the live database for scripts/live-check.mjs and scripts/live-test-family.mjs.
// LIVE_DB_URL (the connection string, password included) is read from the environment of this
// one shell, and is never printed, logged or written to disk. LIVE_DB_CA is the project's CA
// certificate, so the server's certificate is verified.
import { readFileSync } from 'node:fs';
import pg from 'pg';

export function fail(msg) {
  console.error(`live: ${msg}`);
  process.exit(2);
}

export async function connect() {
  const conn = process.env.LIVE_DB_URL;
  const caPath = process.env.LIVE_DB_CA;
  if (!conn) fail('set LIVE_DB_URL in this shell first (see docs/go-live-runbook-stage1.md).');
  if (!caPath) fail('set LIVE_DB_CA to the project CA certificate, so the server is verified.');
  const client = new pg.Client({
    connectionString: conn.replace(/[?&]sslmode=[^&]*/g, ''),
    ssl: { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    application_name: 'limud-live',
  });
  try {
    await client.connect();
  } catch (e) {
    fail(`could not connect (${e.code ?? 'error'}). Check the connection string and the certificate.`);
  }
  const q = async (sql, params) => (await client.query(sql, params)).rows;
  return { q, end: () => client.end() };
}
