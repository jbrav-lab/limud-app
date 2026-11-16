-- ============================================================================
-- TEST SHIM ONLY. NEVER RUN THIS ON A REAL SUPABASE PROJECT.
--
-- Stands in, inside PGlite, for the pieces a real Supabase project already has,
-- so the migrations in supabase/migrations/ run unchanged. Each piece below
-- names what it replaces. What must be re-checked on real Supabase is listed in
-- docs/sync-supabase-plan.md, section 9.
-- ============================================================================

-- Supabase API roles. On Supabase: created by the platform; `service_role`
-- has BYPASSRLS; PostgREST switches to `anon` or `authenticated` per request.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
-- On Supabase: the role the Auth server uses; it calls auth hooks such as "before user created".
create role supabase_auth_admin nologin noinherit;

-- Supabase keeps extensions in their own schema.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Supabase's default privileges: everything created in `public` is granted to
-- the API roles. The migrations must revoke what they don't want; the shim
-- copies this default so the tests check that they do.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- auth schema. On Supabase: GoTrue's schema. Only the parts the migrations use.
-- ---------------------------------------------------------------------------
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  is_anonymous boolean not null default false,
  last_sign_in_at timestamptz default now()
);

-- Same body as Supabase's auth.uid() / auth.jwt() / auth.role(): they read the
-- JWT claims PostgREST puts in the `request.jwt.claims` setting.
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;
grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- vault schema. On Supabase: the supabase_vault extension, which keeps secrets
-- encrypted with a master key held outside the database and decrypts them in
-- the `vault.decrypted_secrets` view. Here: plain text in a table, so the
-- tests can remove a key to simulate "a dump without the key".
-- ---------------------------------------------------------------------------
create schema vault;
create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  secret text not null
);
create view vault.decrypted_secrets as
  select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(new_secret text, new_name text) returns uuid
language sql as $$
  insert into vault.secrets (name, secret) values (new_name, new_secret) returning id
$$;
-- On Supabase, only privileged roles (postgres, service_role) can read Vault.
revoke all on schema vault from public;
revoke all on all tables in schema vault from public;
