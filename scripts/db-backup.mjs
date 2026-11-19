// Back up the live database before a change (go-live plan: "a pg_dump before every database change").
//   node scripts/db-backup.mjs
// Asks for the Session pooler connection string with hidden input, so the password never shows on screen,
// in shell history or in a process list. Dumps the app's schemas (public, private) with pg_dump 17,
// verifying the server certificate, into a folder outside the project and Dropbox, then checks the file.
// The Vault keys are never in the file: they stay in Supabase.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const BIN = process.env.PG_BIN ?? 'C:\\Program Files\\PostgreSQL\\17\\bin';
const OUT_DIR = resolve(process.env.BACKUP_DIR ?? join(homedir(), 'limud-backups'));
const CA = process.env.LIVE_DB_CA ?? join(homedir(), 'supabase-ca.crt');

const stop = (msg) => {
  console.error(`backup: ${msg}`);
  process.exit(1);
};

if (/dropbox/i.test(OUT_DIR) || OUT_DIR.startsWith(resolve('.'))) stop(`${OUT_DIR} is inside Dropbox or the project; choose another folder (BACKUP_DIR).`);
for (const f of ['pg_dump.exe', 'pg_restore.exe']) if (!existsSync(join(BIN, f))) stop(`${f} not found in ${BIN} (set PG_BIN).`);
if (!existsSync(CA)) stop(`the CA certificate is missing: ${CA} (runbook step 1.5).`);

function hiddenPrompt(question) {
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? question : '*'.repeat(s.length ? 1 : 0));
    rl.question(question, (answer) => {
      rl.output.write('\n');
      rl.close();
      done(answer.trim());
    });
  });
}

const conn = await hiddenPrompt('Session pooler connection string: ');
let url;
try {
  url = new URL(conn);
} catch {
  stop('that is not a connection string (it should start with postgresql://).');
}
if (!/^postgres(ql)?:$/.test(url.protocol) || !url.password || !url.username) stop('the connection string needs a user name and password.');
if (!url.hostname.endsWith('.pooler.supabase.com') || (url.port || '5432') !== '5432') {
  stop(`expected the Session pooler (…pooler.supabase.com, port 5432); got ${url.hostname}:${url.port || '5432'}.`);
}

// The password goes to pg_dump only through its environment, never on a command line.
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.replace(/^\//, '') || 'postgres',
  PGSSLMODE: 'verify-full',
  PGSSLROOTCERT: CA,
};

mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const file = join(OUT_DIR, `limud-${stamp}.dump`);
console.log(`backup: dumping public and private to ${file} …`);
const dump = spawnSync(join(BIN, 'pg_dump.exe'), ['--format=custom', '--schema=public', '--schema=private', `--file=${file}`], { env, stdio: ['ignore', 'inherit', 'inherit'] });
const size = existsSync(file) ? statSync(file).size : 0;
if (dump.status !== 0 || size === 0) {
  if (existsSync(file)) unlinkSync(file);
  stop('pg_dump failed (its message is above); no backup was kept.');
}

const list = spawnSync(join(BIN, 'pg_restore.exe'), ['--list', file], { encoding: 'utf8' });
const tables = (list.stdout.match(/ TABLE DATA /g) ?? []).length;
if (list.status !== 0 || tables < 20) stop(`the file doesn't look complete (${tables} tables with data; expected about 22). Keep it, but don't rely on it.`);
console.log(`backup: OK  ${file}  ${(size / 1024).toFixed(0)} KB, ${tables} tables with data.`);
