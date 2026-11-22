-- The family's parents, with their Google addresses (owner, 2026-11-22): every parent of a family can
-- see which addresses belong to the family, and when each last used the app signed in.
--
-- Emails still never come from auth.users (no function in public or private reads it; leak.test.ts).
-- A parent's own app hands in the caller's own address from the sign-in token (auth.jwt()), and it is
-- stored encrypted with the Vault name key, like children's nicknames. So a dump without the keys
-- still can't link an email to a family (family-view-design.md, "a database leak must not link an
-- email to a child"); with the keys that link was already possible through auth.users and the HMAC.
-- "Last seen" is a day only (parent action times are never stored exactly).

alter table public.family_members
  add column email_enc bytea,                         -- the parent's Google address, encrypted (Vault name key)
  add column last_seen_on date;                       -- last day this parent used the app signed in
-- The column grants (20261116000600_grants.sql) list readable columns, so neither column is readable
-- directly; the family reads them only through public.family_parents().

-- A signed-in parent's app calls this when it opens the family data: records the caller's own address
-- (from the sign-in token, never an argument) and today's date, in every family they belong to.
create function public.parent_seen() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare e text := lower(btrim(auth.jwt() ->> 'email'));
begin
  if private.is_anonymous_caller() or e is null or length(e) > 254
     or e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.family_members m
  set email_enc = case when m.email_enc is null or private.decrypt_text(m.email_enc) <> e
                       then private.encrypt_text(e) else m.email_enc end,
      last_seen_on = current_date
  where m.auth_hmac = private.my_hmac()
    and (m.last_seen_on is distinct from current_date or m.email_enc is null
         or private.decrypt_text(m.email_enc) <> e);
end $$;

-- The family's parents, for any parent of that family. `email` is null until that parent opens the
-- app once after this change.
create function public.family_parents(p_family uuid)
returns table (member_id uuid, role text, email text, joined_at timestamptz, last_seen_on date, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare me bytea;
begin
  perform private.require_member(p_family);
  me := private.my_hmac();
  return query
    select m.member_id, m.role, private.decrypt_text(m.email_enc), m.joined_at, m.last_seen_on, m.auth_hmac = me
    from public.family_members m
    where m.family_id = p_family
    order by m.role = 'primary' desc, m.joined_at, m.member_id;
end $$;

revoke execute on function public.parent_seen() from public, anon;
grant execute on function public.parent_seen() to authenticated;
revoke execute on function public.family_parents(uuid) from public, anon;
grant execute on function public.family_parents(uuid) to authenticated;
