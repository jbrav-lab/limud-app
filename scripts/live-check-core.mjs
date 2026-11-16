// The §9 re-check list (docs/sync-supabase-plan.md), as code, for a real database.
// Driver-independent: `q(sql, params)` returns rows. Used by scripts/live-check.mjs (node-postgres,
// the live database) and by src/server-tests/live-check.test.ts (PGlite, to test these checks).
//
// Nothing here prints a connection string, a key or a row. Results hold names of checks, tables
// and functions, and counts only.
//
// The functional part (test families, cross-family isolation, leak scan) runs inside ONE
// transaction that is always rolled back, so it leaves nothing behind: no users, no families,
// no audit entries, no proofs of deletion.

export const TEST_PREFIX = 'TEST-';
const ROLES = ['anon', 'authenticated'];
const TABLE_PRIVS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];

/** Every privilege anon/authenticated (and the auth server, on functions) hold in public/private. */
export async function privilegeMatrix(q) {
  const tables = await q(`
    select r.rolname || ' ' || p.priv || ' ' || n.nspname || '.' || c.relname as k
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (select unnest($1::text[]) as rolname) r
    cross join (select unnest($2::text[]) as priv) p
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v', 'm')
      and has_table_privilege(r.rolname, c.oid, p.priv)`, [ROLES, TABLE_PRIVS]);
  const columns = await q(`
    select r.rolname || ' ' || p.priv || ' ' || n.nspname || '.' || c.relname || '.' || a.attname as k
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    cross join (select unnest($1::text[]) as rolname) r
    cross join (select unnest(array['SELECT', 'INSERT', 'UPDATE']) as priv) p
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v', 'm') and a.attnum > 0 and not a.attisdropped
      and has_column_privilege(r.rolname, c.oid, a.attnum, p.priv)
      and not has_table_privilege(r.rolname, c.oid, p.priv)`, [ROLES]);
  const functions = await q(`
    select r.rolname || ' EXECUTE ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as k
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join (select unnest($1::text[]) as rolname) r
    where n.nspname in ('public', 'private') and has_function_privilege(r.rolname, p.oid, 'EXECUTE')`,
  [[...ROLES, 'supabase_auth_admin']]);
  const schemas = await q(`
    select r.rolname || ' USAGE ' || n.nspname as k from pg_namespace n
    cross join (select unnest($1::text[]) as rolname) r
    where n.nspname in ('private', 'vault', 'cron') and has_schema_privilege(r.rolname, n.oid, 'USAGE')`, [ROLES]);
  return [...tables, ...columns, ...functions, ...schemas].map((r) => r.k).sort();
}

const diff = (live, ref) => ({
  extra: live.filter((k) => !ref.includes(k)),
  missing: ref.filter((k) => !live.includes(k)),
});

/**
 * Refuses (throws) when the database holds a family that isn't a test family, unless allowed.
 * Test families are named with TEST_PREFIX; names are decrypted inside the database and only
 * a count leaves it.
 */
export async function guardRealData(q, { allowRealData = false } = {}) {
  const [{ n }] = await q(`select count(*)::int as n from public.families
    where coalesce(private.decrypt_text(name_enc), '') not like $1 || '%'`, [TEST_PREFIX]);
  if (n > 0 && !allowRealData) {
    throw new Error(`refusing to run: ${n} family(ies) that are not test families exist. ` +
      'Pass --allow-real-data only if you mean to run against real data.');
  }
  return n;
}

/**
 * @param q        query function on the database owner's connection
 * @param options  { reference: string[] (privilegeMatrix of the migrations in PGlite),
 *                   expectedMigrations: string[] (file versions), expectCron, expectMigrationTable,
 *                   expectSupabaseRoles }
 * @returns        [{ name, ok, detail }]
 */
export async function runLiveChecks(q, options) {
  const results = [];
  // Each check runs in its own savepoint, so a failing one doesn't stop the others.
  const check = async (name, fn) => {
    await q('savepoint live_check');
    try {
      const r = await fn();
      results.push({ name, ok: r === true || r?.ok === true, detail: r === true ? '' : r?.detail ?? '' });
      await q('release savepoint live_check');
    } catch (e) {
      await q('rollback to savepoint live_check');
      results.push({ name, ok: false, detail: `error ${e.code ?? ''}: ${String(e.message).slice(0, 200)}` });
    }
  };

  // Everything runs in one transaction that is always rolled back.
  await q('begin');
  try {
    await checks(q, options, check);
  } finally {
    await q('rollback');
  }
  return results;
}

async function checks(q, options, check) {

  await check('server version and the Asia/Jerusalem time zone', async () => {
    const [r] = await q(`select current_setting('server_version_num')::int / 10000 as major,
      exists (select 1 from pg_timezone_names where name = 'Asia/Jerusalem') as tz,
      private.israel_date('2026-11-16 22:30+00') = date '2026-11-17' as israel`);
    return { ok: r.tz && r.israel, detail: `Postgres ${r.major}; use pg_dump ${r.major} (the same major)` };
  });

  if (options.expectMigrationTable) {
    await check('every migration file is applied, and nothing else', async () => {
      const rows = await q(`select version from supabase_migrations.schema_migrations order by 1`);
      const d = diff(rows.map((r) => r.version), options.expectedMigrations);
      return { ok: !d.extra.length && !d.missing.length, detail: JSON.stringify(d) };
    });
  }

  await check('row level security is on for every table in public', async () => {
    const rows = await q(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`);
    return { ok: rows.length === 0, detail: rows.map((r) => r.relname).join(', ') };
  });

  await check('privileges of anon and authenticated match the migrations exactly', async () => {
    const d = diff(await privilegeMatrix(q), options.reference);
    return { ok: !d.extra.length && !d.missing.length, detail: d.extra.length || d.missing.length ? JSON.stringify(d) : '' };
  });

  await check('every security definer function sets search_path', async () => {
    const rows = await q(`select n.nspname || '.' || p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.prosecdef and n.nspname in ('public', 'private')
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    return { ok: rows.length === 0, detail: rows.map((r) => r.f).join(', ') };
  });

  await check('Vault: both keys readable by the functions (length only)', async () => {
    const [r] = await q(`select length(private.vault_key('limud_hmac_key')) >= 32 as h,
                                length(private.vault_key('limud_name_key')) >= 32 as n`);
    return r.h && r.n;
  });

  await check('Vault: not readable by authenticated or anon', async () => {
    const refused = [];
    for (const role of ROLES) {
      for (const sql of [`select count(*) from vault.decrypted_secrets`, `select private.vault_key('limud_hmac_key')`]) {
        refused.push(await refusedAs(q, role, null, sql));
      }
    }
    return refused.every(Boolean);
  });

  if (options.expectCron) {
    await check('the daily job is scheduled at 20:30 UTC, as postgres', async () => {
      const rows = await q(`select schedule, command, username, active from cron.job where jobname = 'limud-maintenance'`);
      const j = rows[0];
      const ok = rows.length === 1 && j.schedule === '30 20 * * *' && j.active &&
        /private\.daily_maintenance\(\)/.test(j.command) && j.username === 'postgres';
      return { ok, detail: rows.length ? `${j.schedule} | ${j.command} | ${j.username} | active=${j.active}` : 'not scheduled' };
    });
  }

  await check('the auth hook exists and only the auth server may run it', async () => {
    const [r] = await q(`select
      has_function_privilege('supabase_auth_admin', 'public.auth_before_user_created(jsonb)', 'EXECUTE') as a,
      has_function_privilege('anon', 'public.auth_before_user_created(jsonb)', 'EXECUTE') as b,
      has_function_privilege('authenticated', 'public.auth_before_user_created(jsonb)', 'EXECUTE') as c`);
    return { ok: r.a && !r.b && !r.c, detail: 'Also check in the dashboard that the hook is switched on.' };
  });

  // The functional part, with two test families (rolled back with everything else).
  let w = null;
  await check('two test families built through the API (Google-style mixed-case email claims)', async () => {
    w = await buildTestWorld(q);
    const rows = await as(q, w.A.parent, `select family_id from public.my_families()`);
    return rows.length === 1 && rows[0].family_id === w.A.id;
  });
  if (!w) return;
  await check('cross-family isolation: family A (parents and device) sees and changes nothing of family B', async () =>
    isolation(q, w));
  await check('a primary user can no longer invite a primary user', async () =>
    refusedAs(q, 'authenticated', w.A.primary, `select public.invite_primary('live-check.x@example.invalid')`));
  await check('leak scan: no test email, sign-in id or plain name anywhere in public', async () => leakScan(q, w));
}

// ---------------------------------------------------------------------------
// Acting as a caller (same as Supabase: JWT claims in a setting, then set role)
// ---------------------------------------------------------------------------
export async function as(q, caller, sql, params = []) {
  await q('savepoint caller');
  try {
    if (caller) {
      await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({
        sub: caller.id, email: caller.email, role: 'authenticated', is_anonymous: caller.anonymous,
        app_metadata: { provider: caller.anonymous ? 'anonymous' : 'google' },
      })]);
      await q('set local role authenticated');
    } else {
      await q(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
      await q('set local role anon');
    }
    const rows = await q(sql, params);
    await q('reset role');
    await q('release savepoint caller');
    return rows;
  } catch (e) {
    await q('rollback to savepoint caller');
    await q('reset role');
    throw e;
  }
}

/** True if the statement is refused with a privilege or rule error (it never takes effect). */
async function refusedAs(q, role, caller, sql) {
  const c = caller ?? (role === 'anon' ? null : { id: crypto.randomUUID(), email: 'nobody@example.invalid', anonymous: false });
  try {
    await as(q, c, sql);
    return false;
  } catch (e) {
    return ['42501', '22023', '55006', '23514', '23505', '55000'].includes(e.code);
  }
}

async function newUser(q, email, anonymous) {
  const cols = (await q(`select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users'`))
    .map((r) => r.column_name);
  const id = crypto.randomUUID();
  const values = { id, email, is_anonymous: anonymous };
  if (cols.includes('aud')) values.aud = 'authenticated';
  if (cols.includes('role')) values.role = 'authenticated';
  if (cols.includes('instance_id')) values.instance_id = '00000000-0000-0000-0000-000000000000';
  const keys = Object.keys(values);
  await q(`insert into auth.users (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
    keys.map((k) => values[k]));
  return { id, email, anonymous };
}

export async function buildTestWorld(q) {
  const admin = await newUser(q, 'limud-live-check.admin@example.invalid', false);
  await q(`select private.add_admin($1)`, [admin.id]);
  const fam = async (key) => {
    const primary = await newUser(q, `Limud-Live-Check.${key}.Primary@Example.invalid`, false);
    const parent = await newUser(q, `limud-live-check.${key}.parent@example.invalid`, false);
    const name = `${TEST_PREFIX}${key}-family`;
    const kid = `${TEST_PREFIX}${key}-child`;
    await as(q, admin, `select public.invite_primary($1)`, [primary.email.toLowerCase()]);
    const [{ id }] = await as(q, primary, `select public.create_family($1) as id`, [name]);
    await as(q, primary, `select public.invite_parent($1, $2)`, [id, parent.email.toUpperCase()]);
    await as(q, parent, `select * from public.accept_invites()`);
    const child = crypto.randomUUID();
    await as(q, primary, `select public.upsert_child($1, $2, $3, '🦊', 5, null, now())`, [child, id, kid]);
    const [{ code }] = await as(q, primary, `select public.create_device_pairing($1, $2, $3::uuid[]) as code`,
      [id, `${TEST_PREFIX}${key}-phone`, [child]]);
    const device = await newUser(q, null, true);
    const deviceId = crypto.randomUUID();
    await as(q, device, `select public.redeem_device_pairing($1, $2)`, [code, deviceId]);
    await as(q, device, `insert into public.exam_results (id, child_id, family_id, pack_id, topic_ids, difficulty, questions, correct, score, taken_at)
      values ($1, $2, $3, 'g5.math', '{}', 'easy', 5, 5, 100, now())`, [crypto.randomUUID(), child, id]);
    await as(q, device, `insert into public.mistakes (id, child_id, family_id, topic_id, prompt, given, correct, at)
      values ($1, $2, $3, 'g5.math.fractions', 'p', 'g', 'c', now())`, [crypto.randomUUID(), child, id]);
    return { id, primary, parent, device, child, plain: [name, kid, `${TEST_PREFIX}${key}-phone`] };
  };
  return { admin, A: await fam('A'), B: await fam('B') };
}

async function isolation(q, w) {
  const tables = (await q(`select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'family_id' order by 1`)).map((r) => r.table_name);
  const leaks = [];
  for (const t of tables) {
    for (const who of [w.A.primary, w.A.parent, w.A.device]) {
      let seen = 0;
      try {
        seen = (await as(q, who, `select count(*)::int as n from public.${t} where family_id = $1`, [w.B.id]))[0].n;
      } catch (e) {
        if (e.code !== '42501') throw e;
      }
      if (seen) leaks.push(`${t} (read)`);
      try {
        const [{ n }] = await as(q, who, `with x as (update public.${t} set family_id = family_id where family_id = $1 returning 1)
          select count(*)::int as n from x`, [w.B.id]);
        if (n) leaks.push(`${t} (write)`);
      } catch (e) {
        if (e.code !== '42501') throw e;
      }
    }
  }
  const [{ n }] = await as(q, w.A.primary, `select count(*)::int as n from public.families where id = $1`, [w.B.id]);
  if (n) leaks.push('families (read)');
  return { ok: leaks.length === 0, detail: `${tables.length} tables checked; ${leaks.join(', ')}` };
}

async function leakScan(q, w) {
  const users = [w.admin, w.A.primary, w.A.parent, w.A.device, w.B.primary, w.B.parent, w.B.device];
  const needles = [
    ...users.map((u) => u.id),
    ...users.filter((u) => u.email).map((u) => u.email.toLowerCase()),
    ...w.A.plain, ...w.B.plain,
  ];
  const tables = (await q(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public') and c.relkind in ('r', 'p') order by 1`)).map((r) => r.relname);
  const hits = [];
  for (const t of tables) {
    const [{ n }] = await q(`select count(*)::int as n from public.${t} x
      where exists (select 1 from unnest($1::text[]) s where lower(x::text) like '%' || lower(s) || '%')`, [needles]);
    if (n) hits.push(`${t}: ${n}`);
  }
  return { ok: hits.length === 0, detail: `${tables.length} tables scanned; ${hits.join(', ')}` };
}

// ---------------------------------------------------------------------------
// Kept test families for the Stage 1 deletion run (scripts/live-test-family.mjs).
// Call inside a transaction; the caller commits.
// ---------------------------------------------------------------------------
const TEST_EMAIL = 'limud-live-check.%@example.invalid';

async function testUser(q, email) {
  const [u] = await q(`select id::text from auth.users where lower(email) = lower($1)`, [email]);
  if (!u) throw new Error('test user not found; run "create" first');
  return { id: u.id, email, anonymous: false };
}

/** @returns lines to print */
export async function testFamilyCommand(q, cmd) {
  const out = [];
  if (cmd === 'create') {
    await guardRealData(q); // refuses if any real family exists
    const [{ n }] = await q(`select count(*)::int as n from auth.users where lower(email) like $1`, [TEST_EMAIL]);
    if (n) throw new Error('test users already exist; run "delete", then "status" after the nightly cleanup');
    const w = await buildTestWorld(q);
    // The test admin was only needed to send the invites.
    await q(`delete from public.app_admins where auth_hmac = private.hmac('uid:' || $1)`, [w.admin.id]);
    await q(`delete from auth.users where id = $1`, [w.admin.id]);
    out.push('Created TEST-A and TEST-B (two parents, a child and a paired test device each).');
  } else if (cmd === 'delete') {
    for (const key of ['A', 'B']) {
      const primary = await testUser(q, `limud-live-check.${key}.primary@example.invalid`);
      const parent = await testUser(q, `limud-live-check.${key}.parent@example.invalid`);
      const [{ family_id: fam }] = await as(q, primary, `select family_id from public.my_families()`);
      const [{ req }] = await as(q, primary, `select public.request_family_deletion($1) as req`, [fam]);
      const [{ done }] = await as(q, parent, `select public.approve_deletion($1) as done`, [req]);
      out.push(`${TEST_PREFIX}${key}: deletion requested and approved by both parents; soft-deleted: ${done}.`);
    }
    const [{ today }] = await q(`select private.israel_date(now())::text as today`);
    out.push(`Confirmed on ${today} (Israel date). The run on D+2 erases them; check with "status" on D+3.`);
  } else if (cmd === 'status') {
    const [r] = await q(`select count(*)::int as total, count(*) filter (where deleted_at is not null)::int as soft
      from public.families where coalesce(private.decrypt_text(name_enc), '') like $1 || '%'`, [TEST_PREFIX]);
    out.push(`Test families: ${r.total} (soft-deleted, waiting for the nightly run: ${r.soft}).`);
    const [{ late }] = await q(`select coalesce(sum(erased_late), 0)::int as late from private.retention_runs`);
    out.push(`Late erasures in the job log: ${late}.`);
    if (r.total === 0) {
      const gone = await q(`delete from auth.users where lower(email) like $1 returning 1`, [TEST_EMAIL]);
      out.push(`Erased. Removed ${gone.length} test parent sign-in rows. Remove the anonymous test devices in the dashboard (Authentication → Users, anonymous).`);
    }
  } else {
    throw new Error(`unknown command ${cmd}`);
  }
  return out;
}
