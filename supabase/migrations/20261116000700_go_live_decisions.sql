-- Go-live decisions (owner, 2026-11-16; docs/go-live-plan.md, Stage 0).
-- From here on, migrations are frozen once pushed: every change is a new file.
--   * Only an admin can invite a primary user (a primary user no longer can).
--   * Sign-in is Google only (no email provider, no magic links). Supabase needs "allow new
--     users to sign up" on for Google's first sign-in and for anonymous child devices, so the
--     invite-only rule moves into a "before user created" auth hook: a Google account is created
--     only if its email has a pending invite. An anonymous device can do nothing without a
--     parent's one-time code.
--   * The maintenance job runs once a day and logs whether it ran and whether any erasure was
--     late; a daily keep-alive request (GitHub Actions) reads one yes/no answer from it.

-- Supabase's default privileges grant every new function in `public` to anon and authenticated.
-- Each function below gets its grants set explicitly at the end of this file.

-- ---------------------------------------------------------------------------
-- 1. Only an admin invites a primary user.
-- ---------------------------------------------------------------------------
create or replace function public.invite_primary(p_email text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare h bytea := private.email_hmac(p_email);
begin
  if private.is_anonymous_caller() or not private.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.invites (kind, family_id, email_hmac, expires_at)
  values ('primary', null, h, private.round_hour(now()) + interval '7 days')
  on conflict (kind, family_id, email_hmac) do update set expires_at = excluded.expires_at;
  perform private.audit('invite.primary', null);
end $$;

-- The owner's own first invite (SQL editor only): before the owner has signed in, there is no
-- admin to invite them. Their first Google sign-in passes the hook; then private.add_admin().
create function private.owner_invite_primary(p_email text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into public.invites (kind, family_id, email_hmac, expires_at)
  values ('primary', null, private.email_hmac(p_email), private.round_hour(now()) + interval '7 days')
  on conflict (kind, family_id, email_hmac) do update set expires_at = excluded.expires_at;
  perform private.audit('invite.primary', null);
end $$;

-- ---------------------------------------------------------------------------
-- 2. Invite-only Google sign-in: the "before user created" auth hook.
--    Dashboard: Authentication → Hooks → Before User Created → Postgres → this function.
--    Supabase calls it as `supabase_auth_admin` with the new user in event->'user'.
--    Returns {} to allow, or an error object to refuse. It never logs the email.
-- ---------------------------------------------------------------------------
create function public.auth_before_user_created(event jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  u jsonb := event -> 'user';
  e text := u ->> 'email';
  provider text := coalesce(u -> 'app_metadata' ->> 'provider', '');
  h bytea;
begin
  if coalesce((u ->> 'is_anonymous')::boolean, false) then
    return '{}'::jsonb;   -- a child device; it can do nothing until it redeems a parent's code
  end if;
  if provider = 'google' and e is not null then
    begin
      h := private.email_hmac(e);
    exception when others then
      h := null;
    end;
    if h is not null and exists (select 1 from public.invites where email_hmac = h and expires_at > now()) then
      return '{}'::jsonb;
    end if;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', 'This app is by invitation only.'));
end $$;

-- ---------------------------------------------------------------------------
-- 3. The daily job, its log, and the keep-alive answer.
-- ---------------------------------------------------------------------------
-- One row per run: when (rounded to the hour) and how many erasures were late. No ids.
create table private.retention_runs (
  ran_at timestamptz primary key check (ran_at = date_trunc('hour', ran_at, 'UTC')),
  erased_late int not null check (erased_late >= 0)
);

-- What pg_cron calls once a day (20:30 UTC). Runs the maintenance, then logs it; keeps 90 days.
create function private.daily_maintenance() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare r jsonb := private.run_retention();
begin
  insert into private.retention_runs (ran_at, erased_late)
  values (private.round_hour(now()), (r ->> 'erased_late')::int)
  on conflict (ran_at) do update set erased_late = private.retention_runs.erased_late + excluded.erased_late;
  delete from private.retention_runs where ran_at < now() - interval '90 days';
  return r;
end $$;

-- The keep-alive request (GitHub Actions, daily, with the public anon key). Touches the database
-- so the free-tier project doesn't pause, and answers one yes/no: did the daily job run in the
-- last 26 hours, with no late erasure in the last 30 days? A "no" fails the workflow, and
-- GitHub emails the owner. Nothing else is readable.
create function public.keep_alive() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.retention_runs where ran_at > now() - interval '26 hours')
     and not exists (select 1 from private.retention_runs
                     where ran_at > now() - interval '30 days' and erased_late > 0)
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on private.retention_runs from public, anon, authenticated;
revoke execute on function private.owner_invite_primary(text), private.daily_maintenance()
  from public, anon, authenticated;
revoke execute on function public.auth_before_user_created(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.auth_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.keep_alive() from public, authenticated;
grant execute on function public.keep_alive() to anon;
-- invite_primary keeps its grant to authenticated (create or replace keeps the privileges).
