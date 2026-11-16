-- Sync step 2: who may see what. Row Level Security on every table, deny by default:
-- a table with RLS on and no matching policy returns nothing and accepts nothing.
-- Access matrix: docs/security-privacy.md §7.

-- ---------------------------------------------------------------------------
-- Scope helpers (security definer: they read membership without RLS, and only
-- ever return the caller's own scope)
-- ---------------------------------------------------------------------------

-- Families in which the caller is a parent (not soft-deleted ones).
create function private.my_family_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.family_id
  from public.family_members m join public.families f on f.id = m.family_id
  where m.auth_hmac = private.my_hmac() and f.deleted_at is null
$$;

-- The caller's family-only member id in a family, or null.
create function private.my_member_id(p_family uuid, p_include_deleted boolean default false) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.member_id
  from public.family_members m join public.families f on f.id = m.family_id
  where m.family_id = p_family and m.auth_hmac = private.my_hmac()
    and (p_include_deleted or f.deleted_at is null)
$$;

create function private.is_primary(p_family uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members m join public.families f on f.id = m.family_id
    where m.family_id = p_family and m.auth_hmac = private.my_hmac() and m.role = 'primary'
      and f.deleted_at is null
  )
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select not private.is_anonymous_caller()
     and exists (select 1 from public.app_admins where auth_hmac = private.my_hmac())
$$;

-- The caller as a child device: its id (if linked, not revoked, family not deleted).
create function private.my_device_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select d.id from public.devices d join public.families f on f.id = d.family_id
  where d.auth_hmac = private.my_hmac() and d.revoked_at is null and f.deleted_at is null
$$;

create function private.my_device_family() returns uuid
language sql stable security definer set search_path = '' as $$
  select d.family_id from public.devices d join public.families f on f.id = d.family_id
  where d.auth_hmac = private.my_hmac() and d.revoked_at is null and f.deleted_at is null
$$;

-- Children the calling device may practise as (assigned by a parent, not soft-deleted).
create function private.my_child_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select dc.child_id
  from public.device_children dc join public.children c on c.id = dc.child_id
  where dc.device_id = private.my_device_id() and c.deleted_at is null
$$;

-- Tests assigned to the calling device's children.
create function private.my_test_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select a.test_id from public.test_assignments a
  where a.child_id in (select private.my_child_ids())
$$;

create function private.audit(p_action text, p_member uuid) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.audit_log (at, action, member_id) values (private.round_hour(now()), p_action, p_member)
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers (server-set fields, grow-only counters, the parent rules)
-- ---------------------------------------------------------------------------

-- A family can never have zero parents, and always has exactly one primary user.
-- Checked at commit, so a primary-role handover can demote and promote in one transaction.
-- When the family itself is erased (cascade), the family row is gone and the check is skipped.
create function private.check_family_parents() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.families where id = old.family_id) then
    if not exists (select 1 from public.family_members where family_id = old.family_id) then
      raise exception 'a family must keep at least one parent' using errcode = '23514';
    end if;
    if not exists (select 1 from public.family_members where family_id = old.family_id and role = 'primary') then
      raise exception 'a family must keep a primary user' using errcode = '23514';
    end if;
  end if;
  return null;
end $$;
create constraint trigger family_keeps_parents
  after delete or update on public.family_members
  deferrable initially deferred
  for each row execute function private.check_family_parents();

-- The 7-year retention clock: any write about a family's children counts as activity.
create function private.touch_family() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.families set last_activity_on = current_date
  where id = new.family_id and last_activity_on < current_date;
  return null;
end $$;
create trigger touch_family after insert or update on public.children
  for each row execute function private.touch_family();
create trigger touch_family after insert or update on public.child_device_totals
  for each row execute function private.touch_family();
create trigger touch_family after insert or update on public.daily_activity
  for each row execute function private.touch_family();
create trigger touch_family after insert or update on public.topic_progress
  for each row execute function private.touch_family();
create trigger touch_family after insert on public.exam_results
  for each row execute function private.touch_family();
create trigger touch_family after insert on public.mistakes
  for each row execute function private.touch_family();
create trigger touch_family after insert or update on public.test_assignments
  for each row execute function private.touch_family();
create trigger touch_family after insert on public.family_members
  for each row execute function private.touch_family();

-- Keys of a synced row never change.
create function private.keep_keys() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.child_id is distinct from old.child_id or new.family_id is distinct from old.family_id then
    raise exception 'row keys are immutable' using errcode = '42501';
  end if;
  return new;
end $$;

-- Grow-only per-device counters (sync plan §4): an upload never lowers them.
create function private.grow_totals() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.stars := greatest(old.stars, new.stars);
  new.sessions := greatest(old.sessions, new.sessions);
  new.updated_at := greatest(old.updated_at, new.updated_at);
  return new;
end $$;
create trigger keep_keys before update on public.child_device_totals
  for each row execute function private.keep_keys();
create trigger grow_totals before update on public.child_device_totals
  for each row execute function private.grow_totals();

create function private.grow_daily() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.answered := greatest(old.answered, new.answered);
  return new;
end $$;
create trigger keep_keys before update on public.daily_activity
  for each row execute function private.keep_keys();
create trigger grow_daily before update on public.daily_activity
  for each row execute function private.grow_daily();

-- Topic progress (sync plan §4): counters take the max; level and runs come from the newer last_at.
create function private.merge_topic() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.attempts := greatest(old.attempts, new.attempts);
  new.first_try := greatest(old.first_try, new.first_try);
  new.second_try := greatest(old.second_try, new.second_try);
  new.by_level := array[greatest(old.by_level[1], new.by_level[1]),
                        greatest(old.by_level[2], new.by_level[2]),
                        greatest(old.by_level[3], new.by_level[3])];
  if new.last_at < old.last_at then
    new.level := old.level; new.run_correct := old.run_correct; new.run_wrong := old.run_wrong;
    new.last_at := old.last_at;
  end if;
  new.updated_at := greatest(old.updated_at, new.updated_at);
  return new;
end $$;
create trigger keep_keys before update on public.topic_progress
  for each row execute function private.keep_keys();
create trigger merge_topic before update on public.topic_progress
  for each row execute function private.merge_topic();

-- Tests: ownership, scope and time are set by the server, never by the client.
create function private.stamp_test() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.owner_scope := 'family';
  new.created_at := private.round_hour(now());
  new.created_by := case when auth.uid() is null then null else private.my_member_id(new.family_id) end;
  return new;
end $$;
create trigger stamp_test before insert on public.tests
  for each row execute function private.stamp_test();

create function private.check_answer_key() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.tests where id = new.test_id and family_id = new.family_id) then
    raise exception 'test not in this family' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger check_answer_key before insert on public.test_answer_keys
  for each row execute function private.check_answer_key();

-- A new assignment: the test and the child belong to the same family; results start empty.
create function private.check_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.tests where id = new.test_id and family_id = new.family_id)
     or not exists (select 1 from public.children where id = new.child_id and family_id = new.family_id and deleted_at is null) then
    raise exception 'test and child must be in this family' using errcode = '23514';
  end if;
  new.answers := null; new.submitted_at := null; new.score := null; new.note := null;
  new.reviewed_by := null; new.released_by := null; new.released_at := null;
  return new;
end $$;
create trigger check_assignment before insert on public.test_assignments
  for each row execute function private.check_assignment();

-- ---------------------------------------------------------------------------
-- RLS: on for every table, deny by default
-- ---------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;

-- Parents: their own families only.
create policy parent_read on public.families for select to authenticated
  using (id in (select private.my_family_ids()));
create policy parent_read on public.family_members for select to authenticated
  using (family_id in (select private.my_family_ids()));
create policy parent_read on public.invites for select to authenticated
  using (family_id in (select private.my_family_ids()));
create policy parent_read on public.deletion_requests for select to authenticated
  using (family_id in (select private.my_family_ids()));
create policy parent_read on public.consent_records for select to authenticated
  using (family_id in (select private.my_family_ids()));

-- Devices: parents see the family's devices; a device sees itself.
create policy parent_or_self_read on public.devices for select to authenticated
  using (family_id in (select private.my_family_ids()) or id = (select private.my_device_id()));
create policy parent_or_device_read on public.device_children for select to authenticated
  using (family_id in (select private.my_family_ids()) or device_id = (select private.my_device_id()));

-- Children: parents see the family's children; a device sees only its own children.
create policy parent_or_device_read on public.children for select to authenticated
  using (family_id in (select private.my_family_ids()) or id in (select private.my_child_ids()));

-- Progress: read by the family's parents and by the child's own device; written by the device only.
create policy parent_or_device_read on public.child_device_totals for select to authenticated
  using (family_id in (select private.my_family_ids()) or child_id in (select private.my_child_ids()));
create policy device_insert on public.child_device_totals for insert to authenticated
  with check (device_id = (select private.my_device_id()) and child_id in (select private.my_child_ids())
              and family_id = (select private.my_device_family()));
create policy device_update on public.child_device_totals for update to authenticated
  using (device_id = (select private.my_device_id()) and child_id in (select private.my_child_ids()))
  with check (device_id = (select private.my_device_id()) and child_id in (select private.my_child_ids())
              and family_id = (select private.my_device_family()));

create policy parent_or_device_read on public.daily_activity for select to authenticated
  using (family_id in (select private.my_family_ids()) or child_id in (select private.my_child_ids()));
create policy device_insert on public.daily_activity for insert to authenticated
  with check (device_id = (select private.my_device_id()) and child_id in (select private.my_child_ids())
              and family_id = (select private.my_device_family()));
create policy device_update on public.daily_activity for update to authenticated
  using (device_id = (select private.my_device_id()) and child_id in (select private.my_child_ids()))
  with check (device_id = (select private.my_device_id()) and child_id in (select private.my_child_ids())
              and family_id = (select private.my_device_family()));

create policy parent_or_device_read on public.topic_progress for select to authenticated
  using (family_id in (select private.my_family_ids()) or child_id in (select private.my_child_ids()));
create policy device_insert on public.topic_progress for insert to authenticated
  with check (child_id in (select private.my_child_ids()) and family_id = (select private.my_device_family()));
create policy device_update on public.topic_progress for update to authenticated
  using (child_id in (select private.my_child_ids()))
  with check (child_id in (select private.my_child_ids()) and family_id = (select private.my_device_family()));

create policy parent_or_device_read on public.exam_results for select to authenticated
  using (family_id in (select private.my_family_ids()) or child_id in (select private.my_child_ids()));
create policy device_insert on public.exam_results for insert to authenticated
  with check (child_id in (select private.my_child_ids()) and family_id = (select private.my_device_family())
              and seen_by_parent_at is null);

create policy parent_or_device_read on public.mistakes for select to authenticated
  using (family_id in (select private.my_family_ids()) or child_id in (select private.my_child_ids()));
create policy device_insert on public.mistakes for insert to authenticated
  with check (child_id in (select private.my_child_ids()) and family_id = (select private.my_device_family()));

-- Tests: parents create, read and delete; a device reads only tests assigned to its children.
-- Tests are frozen: no update policy.
create policy parent_or_assigned_read on public.tests for select to authenticated
  using (family_id in (select private.my_family_ids()) or id in (select private.my_test_ids()));
create policy parent_insert on public.tests for insert to authenticated
  with check (family_id in (select private.my_family_ids()));
create policy parent_delete on public.tests for delete to authenticated
  using (family_id in (select private.my_family_ids()));

-- The answer key: parents only.
create policy parent_read on public.test_answer_keys for select to authenticated
  using (family_id in (select private.my_family_ids()));
create policy parent_insert on public.test_answer_keys for insert to authenticated
  with check (family_id in (select private.my_family_ids()));

-- Assignments: parents only (a device gets its view through public.device_tests(), which hides
-- the score and note until release).
create policy parent_read on public.test_assignments for select to authenticated
  using (family_id in (select private.my_family_ids()));
create policy parent_insert on public.test_assignments for insert to authenticated
  with check (family_id in (select private.my_family_ids()));
create policy parent_delete on public.test_assignments for delete to authenticated
  using (family_id in (select private.my_family_ids()));

-- Reference lists: readable by signed-in parents, managed by the admin only.
create policy signed_in_read on public.ref_schools for select to authenticated
  using (not private.is_anonymous_caller());
create policy admin_write on public.ref_schools for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy signed_in_read on public.ref_grades for select to authenticated
  using (not private.is_anonymous_caller());
create policy admin_write on public.ref_grades for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- No policies at all (nobody but the server's own functions):
-- app_admins, device_pairings, audit_log, deletion_proofs.
