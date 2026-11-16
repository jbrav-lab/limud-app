# Stage 1 runbook: the database goes live

For the owner, in order. Part of [go-live-plan.md](go-live-plan.md). The children's phones are not affected by anything here. Run the commands in PowerShell, in the project folder, on the `claude/sync-step2` branch (or `main` once it is merged).

**Secrets:** you type the database password and the connection string yourself, into the CLI or a hidden prompt. Don't paste them into a chat, a file or a commit.

## 1. Pre-flight
1. **Dashboard → your project → Project Settings → General.** Note the **project ref** and the **region**, ideally an EU region such as Frankfurt.
2. **Ask for the DPA:** request Supabase's data-processing agreement (in the dashboard's legal documents, or from support). Keep the signed copy.
3. **Check that `public` is empty.** SQL Editor → New query:
   ```sql
   select (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r','p','v','m','S')) as tables,
          (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public') as functions,
          (select count(*) from pg_namespace where nspname = 'private') as private_schema,
          current_setting('server_version') as postgres;
   ```
   Expect `0, 0, 0`. Note the Postgres major version. If anything is there, stop and tell Claude.
4. **Install `pg_dump`** with the same major version (go-live-plan.md, Tooling). Check with `pg_dump --version`. It isn't needed until real data exists, but have it ready.
5. **Download the CA certificate:** Project Settings → Database → SSL Configuration → **Download certificate**. Save it outside the project folder, for example `C:\Users\User\supabase-ca.crt`.

## 2. Lock the sign-in settings first
Do this before the database is filled, so nobody can sign up in between.
1. **Authentication → Sign In / Providers:**
   - **Email:** off (no email provider, no magic links).
   - **Google:** leave off until Stage 3 (it needs a Google Cloud OAuth client).
   - **Allow anonymous sign-ins:** on (child devices).
   - **Allow new users to sign up:** leave **on**. Google's first sign-in and anonymous sign-in both need it. The hook in step 5.3 makes it invite-only.
2. **Authentication → Rate Limits:** set anonymous sign-ins to about 10 per hour per IP address.
3. **Authentication → URL Configuration:**
   - **Site URL:** `https://jbrav-lab.github.io/limud-app/`.
   - **Redirect URLs:** add `https://jbrav-lab.github.io/limud-app/**` and `http://localhost:5173/**`.
4. **Project Settings → Data API:** set **Exposed schemas** to `public` only (remove `graphql_public`). Leave the extra search path as it is.

## 3. Push the migrations
```powershell
npx supabase login
```
Opens the browser to sign in to Supabase; the CLI keeps an access token.

```powershell
npx supabase link --project-ref <project-ref>
```
Asks for the **database password**, which you type. It links this folder to the project; it writes only to `supabase/.temp/`, which git ignores.

```powershell
npx supabase db push --dry-run
```
Lists the migrations it would apply: the seven files `20261116000100` to `20261116000700`. Nothing changes yet.

```powershell
npx supabase db push
```
Applies them, after asking you to confirm. **From now on these files are frozen.**

## 4. Run the setup snippet yourself
1. **Database → Extensions** (or Integrations → Cron): enable **pg_cron**. Vault (`supabase_vault`) is on by default; check that it is.
2. **SQL Editor → New query.** Paste, run once, then close the tab without saving:
   ```sql
   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'limud_hmac_key');
   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'limud_name_key');
   select cron.schedule('limud-maintenance', '30 20 * * *', 'select private.daily_maintenance()');
   ```
   - The first two create the two keys inside Vault. Nobody, you included, needs to see them.
   - The third schedules the daily job at 20:30 UTC (22:30 or 23:30 in Israel).
   - **Never run the key lines twice.** New keys would make existing data unreadable.

## 5. Hook and checks
1. **Authentication → Hooks → Before User Created:** add a hook of type **Postgres**, function `public.auth_before_user_created`, and enable it. If the screen lists only some schemas, choose `public`.
2. **Advisors → Security Advisor:** run it. Expect no errors. Note any warnings for Claude.
3. **Run the live check.** In PowerShell:
   ```powershell
   $s = Read-Host -AsSecureString "Session pooler connection string"
   $env:LIVE_DB_URL = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
   $env:LIVE_DB_CA = "C:\Users\User\supabase-ca.crt"
   $env:SUPABASE_URL = "https://<project-ref>.supabase.co"
   $env:SUPABASE_ANON_KEY = "<the anon public key, from Project Settings → API Keys>"
   node scripts/live-check.mjs
   ```
   - Take the connection string from **Connect → Session pooler**, with your password in it. The direct connection is IPv6-only on the free plan.
   - The hidden prompt keeps the password out of the screen and the shell history.
   - Every line should say **PASS**. Nothing is left in the database.
   - "keep_alive answers" passes even though the answer is `false` until the first nightly run.
4. Close PowerShell afterwards; that forgets the variables.

## 6. The real deletion flow
In a PowerShell window with the same variables set (step 5.3):
```powershell
node scripts/live-test-family.mjs create
node scripts/live-test-family.mjs delete
```
- **`create`** builds `TEST-A` and `TEST-B` through the real API: invites, two parents each, a child, a paired test device, progress.
- **`delete`** has both parents of each family request and approve the family's deletion, as in the app. Note the date it prints (day D).

On **D+3** (after the nightly run on D+2):
```powershell
node scripts/live-test-family.mjs status
```
- Expect `Test families: 0`, `Late erasures in the job log: 0`, and "Erased".
- Then remove the anonymous test devices: Authentication → Users, filter anonymous, delete them.

## 7. Gate
- Send Claude the output of `live-check.mjs` and `status`, and the advisor's findings. Claude records them in `docs/security-privacy.md` (evidence index and §13).
- Then add the keep-alive settings in GitHub (go-live-plan.md, Tooling). The workflow starts once the branch is merged.

## Way back (only if Stage 1 must be undone; there is no real data yet)
In the SQL editor:
```sql
select cron.unschedule('limud-maintenance');
drop schema private cascade;
-- `public` was empty before Stage 1 (step 1.3), so everything in it is ours. The schema itself and
-- Supabase's default grants on it stay.
do $$ declare r record; begin
  for r in select format('drop table if exists public.%I cascade', tablename) as s from pg_tables where schemaname = 'public' loop
    execute r.s; end loop;
  for r in select format('drop function if exists public.%I(%s) cascade', p.proname, pg_get_function_identity_arguments(p.oid)) as s
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    execute r.s; end loop;
end $$;
delete from supabase_migrations.schema_migrations where version like '20261116%';
delete from vault.secrets where name in ('limud_hmac_key', 'limud_name_key');
```
Turn the hook off first (Authentication → Hooks): it points to a function this removes.
