-- Stage 3: let the app show that admin actions worked, without revealing anything new.
-- The admin sees that they are the admin and when their pending primary-user invites expire; never an
-- address (invites hold only an HMAC). Parents already read their own family's pending invites
-- (public.invites, RLS policy parent_read). Owner request 2026-11-19: "no indication it worked".
create function public.my_admin_status()
returns table (is_admin boolean, primary_invites_expiring timestamptz[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_anonymous_caller() or not private.is_admin() then
    return query select false, '{}'::timestamptz[];
    return;
  end if;
  return query
    select true, coalesce(array_agg(i.expires_at order by i.expires_at), '{}')
    from public.invites i where i.kind = 'primary' and i.expires_at > now();
end $$;

revoke execute on function public.my_admin_status() from public, anon;
grant execute on function public.my_admin_status() to authenticated;
