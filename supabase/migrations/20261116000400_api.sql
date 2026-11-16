-- Sync step 2: the API for parents, the admin and child devices.
-- Every function is security definer, sets search_path to '' (all names fully qualified),
-- checks the caller's role itself, and validates every input. Errors are generic.

-- ---------------------------------------------------------------------------
-- Input checks
-- ---------------------------------------------------------------------------
create function private.clean_name(p_value text, p_max int default 40) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := btrim(p_value);
begin
  if v is null or length(v) < 1 or length(v) > p_max or v ~ '[[:cntrl:]]' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  return v;
end $$;

create function private.email_hmac(p_email text) returns bytea
language plpgsql stable security definer set search_path = '' as $$
declare v text := lower(btrim(p_email));
begin
  if v is null or length(v) > 254 or v !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  return private.hmac('email:' || v);
end $$;

create function private.caller_email_hmac() returns bytea
language plpgsql stable security definer set search_path = '' as $$
declare e text := auth.jwt() ->> 'email';
begin
  if private.is_anonymous_caller() or e is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return private.email_hmac(e);
end $$;

create function private.require_member(p_family uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare m uuid;
begin
  if p_family is null or private.is_anonymous_caller() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  m := private.my_member_id(p_family);
  if m is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return m;
end $$;

create function private.require_primary(p_family uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare m uuid := private.require_member(p_family);
begin
  if not private.is_primary(p_family) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return m;
end $$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
-- Run by the owner in the SQL editor (service role), never from the app.
create function private.add_admin(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then raise exception 'invalid input' using errcode = '22023'; end if;
  insert into public.app_admins (auth_hmac) values (private.hmac('uid:' || p_user::text))
  on conflict do nothing;
end $$;

-- Invite a primary user (who may then create a family). The admin, or any primary user.
create function public.invite_primary(p_email text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare h bytea := private.email_hmac(p_email);
begin
  if private.is_anonymous_caller()
     or not (private.is_admin() or exists (
       select 1 from public.family_members m join public.families f on f.id = m.family_id
       where m.auth_hmac = private.my_hmac() and m.role = 'primary' and f.deleted_at is null)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.invites (kind, family_id, email_hmac, expires_at)
  values ('primary', null, h, private.round_hour(now()) + interval '7 days')
  on conflict (kind, family_id, email_hmac) do update set expires_at = excluded.expires_at;
  perform private.audit('invite.primary', null);
end $$;

-- ---------------------------------------------------------------------------
-- Families and parents
-- ---------------------------------------------------------------------------
-- Create a family. Needs a valid primary-user invite for the caller's email; the invite is consumed.
create function public.create_family(p_name text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  n text := private.clean_name(p_name);
  h bytea := private.caller_email_hmac();
  fam uuid;
  mem uuid;
begin
  delete from public.invites
  where id = (select id from public.invites
              where kind = 'primary' and email_hmac = h and expires_at > now() limit 1);
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.families (name_enc, created_at)
  values (private.encrypt_text(n), private.round_hour(now())) returning id into fam;
  insert into public.family_members (family_id, auth_hmac, role, joined_at)
  values (fam, private.my_hmac(), 'primary', private.round_hour(now())) returning member_id into mem;
  perform private.audit('family.created', mem);
  return fam;
end $$;

-- The primary user invites another parent by email. Only an HMAC of the email is stored.
create function public.invite_parent(p_family uuid, p_email text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare mem uuid := private.require_primary(p_family);
begin
  insert into public.invites (kind, family_id, email_hmac, expires_at)
  values ('parent', p_family, private.email_hmac(p_email), private.round_hour(now()) + interval '7 days')
  on conflict (kind, family_id, email_hmac) do update set expires_at = excluded.expires_at;
  perform private.audit('invite.parent', mem);
end $$;

-- Accept every pending parent invite for the caller's email. The invite rows are deleted.
create function public.accept_invites() returns setof uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  h bytea := private.caller_email_hmac();
  me bytea := private.my_hmac();
  inv record;
  mem uuid;
begin
  delete from public.invites where email_hmac = h and expires_at <= now();
  for inv in
    delete from public.invites i using public.families f
    where i.kind = 'parent' and i.email_hmac = h and f.id = i.family_id and f.deleted_at is null
    returning i.family_id
  loop
    insert into public.family_members (family_id, auth_hmac, role, joined_at)
    values (inv.family_id, me, 'parent', private.round_hour(now()))
    on conflict (family_id, auth_hmac) do nothing
    returning member_id into mem;
    if mem is not null then
      perform private.audit('member.joined', mem);
    end if;
    return next inv.family_id;
  end loop;
end $$;

-- The caller's families, with decrypted names.
create function public.my_families()
returns table (family_id uuid, name text, role text, member_id uuid)
language sql stable security definer set search_path = '' as $$
  select f.id, private.decrypt_text(f.name_enc), m.role, m.member_id
  from public.family_members m join public.families f on f.id = m.family_id
  where m.auth_hmac = private.my_hmac() and f.deleted_at is null
    and not private.is_anonymous_caller()
$$;

create function public.rename_family(p_family uuid, p_name text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare mem uuid := private.require_member(p_family);
begin
  update public.families set name_enc = private.encrypt_text(private.clean_name(p_name)) where id = p_family;
  perform private.audit('family.renamed', mem);
end $$;

create function public.record_consent(p_family uuid, p_notice_version text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare mem uuid := private.require_member(p_family);
begin
  if p_notice_version is null or p_notice_version !~ '^[0-9A-Za-z.-]{1,16}$' then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  insert into public.consent_records (family_id, member_id, notice_version, agreed_on)
  values (p_family, mem, p_notice_version, current_date);
end $$;

-- Hand the primary role to another parent of the same family (it can be handed over, never dropped).
create function public.hand_over_primary(p_family uuid, p_member uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := private.require_primary(p_family);
begin
  if p_member is null or p_member = me
     or not exists (select 1 from public.family_members where member_id = p_member and family_id = p_family)
     or exists (select 1 from public.deletion_requests where target_member_id = p_member) then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  update public.family_members set role = 'parent' where member_id = me;
  update public.family_members set role = 'primary' where member_id = p_member;
  perform private.audit('primary.handed_over', me);
end $$;

-- ---------------------------------------------------------------------------
-- Children
-- ---------------------------------------------------------------------------
-- Create or update a child profile (last writer wins by updated_at). A parent of the family can
-- create and update; a child device can update only its own children.
create function public.upsert_child(
  p_id uuid, p_family uuid, p_name text, p_avatar text, p_grade int, p_theme text, p_updated_at timestamptz
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  n text := private.clean_name(p_name);
  at timestamptz := least(p_updated_at, now());   -- a device clock in the future can't win forever
  existing public.children;
  is_parent boolean;
begin
  if p_id is null or p_family is null or p_updated_at is null
     or p_avatar is null or length(p_avatar) not between 1 and 16 or p_avatar ~ '[[:cntrl:]]'
     or p_grade is null or p_grade not between 1 and 12
     or (p_theme is not null and p_theme !~ '^[a-z0-9-]{1,32}$') then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  is_parent := not private.is_anonymous_caller() and private.my_member_id(p_family) is not null;
  select * into existing from public.children where id = p_id;

  if existing.id is null then
    if not is_parent then raise exception 'not allowed' using errcode = '42501'; end if;
    insert into public.children (id, family_id, name_enc, avatar, grade, theme, updated_at)
    values (p_id, p_family, private.encrypt_text(n), p_avatar, p_grade, p_theme, at);
    return;
  end if;

  if existing.family_id <> p_family or existing.deleted_at is not null
     or not (is_parent or p_id in (select private.my_child_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if at > existing.updated_at then
    update public.children
    set name_enc = private.encrypt_text(n), avatar = p_avatar, grade = p_grade, theme = p_theme, updated_at = at
    where id = p_id;
  end if;
end $$;

-- A parent's list of the family's children, names decrypted. Soft-deleted children are listed
-- (with deleted_at) while they can still be restored.
create function public.family_children(p_family uuid)
returns table (id uuid, name text, avatar text, grade int, theme text, updated_at timestamptz, deleted_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_member(p_family);
  return query
    select c.id, private.decrypt_text(c.name_enc), c.avatar, c.grade, c.theme, c.updated_at, c.deleted_at
    from public.children c where c.family_id = p_family
    order by c.id;
end $$;

-- A child device's "who's learning today?" list: only its own children.
create function public.device_children_list()
returns table (id uuid, name text, avatar text, grade int, theme text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, private.decrypt_text(c.name_enc), c.avatar, c.grade, c.theme, c.updated_at
  from public.children c where c.id in (select private.my_child_ids())
  order by c.id
$$;

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------
create function private.check_family_children(p_family uuid, p_children uuid[]) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_children is null or cardinality(p_children) > 20 or exists (
    select 1 from unnest(p_children) c(id)
    where c.id is null or not exists (
      select 1 from public.children ch where ch.id = c.id and ch.family_id = p_family and ch.deleted_at is null)
  ) then
    raise exception 'invalid input' using errcode = '22023';
  end if;
end $$;

-- A parent makes a one-time pairing code for a child's phone (valid 15 minutes).
-- Returns the code; only its HMAC is stored.
create function public.create_device_pairing(p_family uuid, p_label text, p_children uuid[]) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  mem uuid := private.require_member(p_family);
  code text := private.random_code();
begin
  perform private.check_family_children(p_family, p_children);
  delete from public.device_pairings where expires_at <= now();
  insert into public.device_pairings (code_hmac, family_id, label_enc, child_ids, expires_at)
  values (private.hmac('pair:' || code), p_family,
          case when p_label is null then null else private.encrypt_text(private.clean_name(p_label)) end,
          p_children, now() + interval '15 minutes');
  perform private.audit('device.pairing_created', mem);
  return code;
end $$;

-- The child's phone (signed in anonymously) redeems the code once. Returns the family id,
-- or null for a wrong or expired code. Failed attempts are counted; after 30 in an hour, all
-- pairing is refused until the next hour.
create function public.redeem_device_pairing(p_code text, p_device uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  me bytea := private.my_hmac();
  p public.device_pairings;
  c text := upper(btrim(p_code));
begin
  if not private.is_anonymous_caller() or p_device is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.audit_log
      where action = 'device.pairing_failed' and at = private.round_hour(now())) >= 30 then
    raise exception 'try again later' using errcode = '54000';
  end if;
  if c is null or c !~ '^[A-Z2-9]{10}$' then
    perform private.audit('device.pairing_failed', null);
    return null;
  end if;
  delete from public.device_pairings
  where code_hmac = private.hmac('pair:' || c) and expires_at > now()
  returning * into p;
  if p.code_hmac is null then
    perform private.audit('device.pairing_failed', null);
    return null;
  end if;
  if exists (select 1 from public.devices where auth_hmac = me or id = p_device) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.devices (id, family_id, auth_hmac, label_enc, linked_at)
  values (p_device, p.family_id, me, p.label_enc, private.round_hour(now()));
  insert into public.device_children (device_id, child_id, family_id)
  select p_device, ch.id, p.family_id from public.children ch
  where ch.id = any (p.child_ids) and ch.family_id = p.family_id and ch.deleted_at is null;
  perform private.audit('device.paired', null);
  return p.family_id;
end $$;

-- A parent sets which children a device may practise as.
create function public.set_device_children(p_device uuid, p_children uuid[]) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  fam uuid := (select family_id from public.devices where id = p_device and revoked_at is null);
  mem uuid := private.require_member(fam);
begin
  perform private.check_family_children(fam, p_children);
  delete from public.device_children where device_id = p_device and child_id <> all (p_children);
  insert into public.device_children (device_id, child_id, family_id)
  select p_device, c, fam from unnest(p_children) c
  on conflict do nothing;
  perform private.audit('device.children_set', mem);
end $$;

-- Revoke a lost or old phone: it loses all access at once; the progress it recorded stays.
create function public.revoke_device(p_device uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  fam uuid := (select family_id from public.devices where id = p_device);
  mem uuid := private.require_member(fam);
begin
  update public.devices set revoked_at = private.round_hour(now()) where id = p_device and revoked_at is null;
  delete from public.device_children where device_id = p_device;
  perform private.audit('device.revoked', mem);
end $$;

create function public.rename_device(p_device uuid, p_label text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  fam uuid := (select family_id from public.devices where id = p_device);
  mem uuid := private.require_member(fam);
begin
  update public.devices set label_enc = private.encrypt_text(private.clean_name(p_label)) where id = p_device;
  perform private.audit('device.renamed', mem);
end $$;

create function public.family_devices(p_family uuid)
returns table (id uuid, label text, linked_at timestamptz, last_seen_on date, revoked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_member(p_family);
  return query
    select d.id, private.decrypt_text(d.label_enc), d.linked_at, d.last_seen_on, d.revoked_at
    from public.devices d where d.family_id = p_family order by d.linked_at, d.id;
end $$;

-- ---------------------------------------------------------------------------
-- Test results and parent-made tests
-- ---------------------------------------------------------------------------
-- A parent marks a practice-test result as seen (for the "new result" badge).
create function public.mark_exam_seen(p_exam uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  fam uuid := (select family_id from public.exam_results where id = p_exam);
begin
  perform private.require_member(fam);
  update public.exam_results set seen_by_parent_at = private.round_hour(now())
  where id = p_exam and seen_by_parent_at is null;
end $$;

-- A child device's tests: the questions, never the answer key; the score and the parent's note
-- only after an adult releases the results.
create function public.device_tests()
returns table (assignment_id uuid, test_id uuid, child_id uuid, questions jsonb,
               submitted_at timestamptz, released boolean, score int, note text)
language sql stable security definer set search_path = '' as $$
  select a.id, t.id, a.child_id, t.questions, a.submitted_at,
         a.released_at is not null,
         case when a.released_at is not null then a.score end,
         case when a.released_at is not null then a.note end
  from public.test_assignments a join public.tests t on t.id = a.test_id
  where a.child_id in (select private.my_child_ids())
  order by t.created_at, a.id
$$;

-- The child's device uploads its answers once. Scoring on the server comes in a later step.
create function public.submit_test_answers(p_assignment uuid, p_answers jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_assignment is null or p_answers is null or jsonb_typeof(p_answers) <> 'array'
     or pg_column_size(p_answers) > 100000 then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  update public.test_assignments set answers = p_answers, submitted_at = now()
  where id = p_assignment and submitted_at is null
    and child_id in (select private.my_child_ids());
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end $$;

-- A parent releases a submitted test's results to the child, with an optional short note.
create function public.release_test(p_assignment uuid, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  fam uuid := (select family_id from public.test_assignments where id = p_assignment);
  mem uuid := private.require_member(fam);
begin
  if p_note is not null and (length(p_note) > 500 or p_note ~ '[[:cntrl:]]') then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  update public.test_assignments
  set note = p_note, reviewed_by = mem, released_by = mem, released_at = private.round_hour(now())
  where id = p_assignment and submitted_at is not null and released_at is null;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform private.audit('test.released', mem);
end $$;
