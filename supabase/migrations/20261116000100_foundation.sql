-- Sync step 2: foundation. Schemas, extensions, keys, HMAC and name encryption.
-- Rules: docs/family-view-design.md ("a database leak must not link an email to a child"),
-- docs/security-privacy.md §9.
--
-- Keys live in Supabase Vault and are NOT created by migrations. Before first use, the
-- owner runs once, in the SQL editor:
--   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'limud_hmac_key');
--   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'limud_name_key');
-- Without them every function fails closed (raises), and nothing is readable or writable.

create extension if not exists pgcrypto with schema extensions;

-- Internal functions and helpers. Not exposed through the API (only `public` is).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;  -- only for the RLS helpers granted below

-- Nothing is executable by default: each function gets its grant explicitly.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;
-- Tables in public are not granted by default either; each table gets its grants explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Keys (Vault)
-- ---------------------------------------------------------------------------
create function private.vault_key(p_name text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare k text;
begin
  if p_name not in ('limud_hmac_key', 'limud_name_key') then
    raise exception 'unknown key' using errcode = '22023';
  end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = p_name;
  if k is null or length(k) < 32 then
    raise exception 'server key unavailable' using errcode = '55000';  -- fail closed
  end if;
  return k;
end $$;

-- HMAC-SHA256 with the Vault key. Used for sign-in ids, invite emails and one-time codes.
create function private.hmac(p_value text) returns bytea
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_value is null or length(p_value) = 0 or length(p_value) > 512 then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  return extensions.hmac(convert_to(p_value, 'UTF8'), convert_to(private.vault_key('limud_hmac_key'), 'UTF8'), 'sha256');
end $$;

-- The caller's sign-in id, as an HMAC. The only form in which a sign-in id ever touches family data.
create function private.my_hmac() returns bytea
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return private.hmac('uid:' || uid::text);
end $$;

create function private.is_anonymous_caller() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

-- Names and device labels: encrypted with the Vault name key (AES-256 through pgp_sym_encrypt).
create function private.encrypt_text(p_value text) returns bytea
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_value is null then return null; end if;
  return extensions.pgp_sym_encrypt(p_value, private.vault_key('limud_name_key'), 'cipher-algo=aes256');
end $$;

create function private.decrypt_text(p_value bytea) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_value is null then return null; end if;
  return extensions.pgp_sym_decrypt(p_value, private.vault_key('limud_name_key'));
end $$;

-- Parent action times are rounded down to the hour, so they can't be matched to
-- auth.users.last_sign_in_at. Children's activity keeps exact times.
create function private.round_hour(p_at timestamptz) returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('hour', p_at, 'UTC')
$$;

-- A random one-time code: 10 characters from a 31-letter alphabet without look-alikes (about 49 bits).
create function private.random_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 letters; no I, L, O, 0, 1
  b bytea := extensions.gen_random_bytes(10);
  out text := '';
begin
  for i in 0..9 loop
    out := out || substr(alphabet, 1 + (get_byte(b, i) % length(alphabet)), 1);
  end loop;
  return out;
end $$;
