-- Sync step 2: deletion rules and retention, enforced in the database.
-- Rules (docs/family-view-design.md "Deleting a child", security-privacy.md §5, §10, §12):
--   * deleting a child or the family needs every parent's approval; a request expires after 7 days;
--   * removing a parent waits 7 days, and nothing can be deleted during that time;
--   * deletion is soft: hidden at once, then erased within 48 hours of the end of the day
--     (Israel time) on which it was confirmed. Confirmed on day D: restorable until the daily
--     maintenance run on D+2, which erases it; the deadline is 00:00 on D+3, Israel time;
--   * a family can never have zero parents (constraint trigger in the RLS migration);
--   * 7 years after a family's last activity, the family is erased; audit entries and the
--     anonymized proofs of deletion are kept 7 years.

-- The day rule works on Israel calendar dates, not elapsed hours, so it doesn't depend on
-- exactly when the daily job runs.
create function private.israel_date(p_at timestamptz) returns date
language sql stable set search_path = '' as $$
  select (p_at at time zone 'Asia/Jerusalem')::date
$$;

-- Erase by: 00:00 Israel time, three calendar days after the day of the soft delete.
create function private.erasure_deadline(p_deleted_at timestamptz) returns timestamptz
language sql stable set search_path = '' as $$
  select ((private.israel_date(p_deleted_at) + 3)::timestamp at time zone 'Asia/Jerusalem')
$$;

-- The daily run erases it from D+2 (Israel date) on.
create function private.erase_due(p_deleted_at timestamptz, p_now timestamptz) returns boolean
language sql stable set search_path = '' as $$
  select p_deleted_at is not null and private.israel_date(p_deleted_at) <= private.israel_date(p_now) - 2
$$;

-- Restorable while it still exists and the deadline hasn't passed (a missed run doesn't extend it).
create function private.restorable(p_deleted_at timestamptz, p_now timestamptz) returns boolean
language sql stable set search_path = '' as $$
  select p_deleted_at is not null and p_now < private.erasure_deadline(p_deleted_at)
$$;

create function private.removal_pending(p_family uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.deletion_requests where family_id = p_family and kind = 'remove_member')
$$;

-- Carry out a child or family deletion request if every current parent approved it.
-- Returns true when it was carried out.
create function private.execute_if_approved(p_request uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare r public.deletion_requests;
begin
  select * into r from public.deletion_requests where id = p_request for update;
  if r.id is null or r.kind not in ('child', 'family') or r.expires_at <= now()
     or private.removal_pending(r.family_id) then
    return false;
  end if;
  if exists (select 1 from public.family_members m
             where m.family_id = r.family_id and m.member_id <> all (r.approvals)) then
    return false;
  end if;
  if r.kind = 'child' then
    update public.children set deleted_at = private.round_hour(now())
    where id = r.target_child_id and deleted_at is null;
    perform private.audit('child.soft_deleted', null);
  else
    update public.families set deleted_at = private.round_hour(now()) where id = r.family_id and deleted_at is null;
    perform private.audit('family.soft_deleted', null);
  end if;
  delete from public.deletion_requests where id = r.id;
  return true;
end $$;

create function private.new_deletion_request(p_family uuid, p_kind text, p_child uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  mem uuid := private.require_member(p_family);
  req uuid;
begin
  if private.removal_pending(p_family) then
    raise exception 'nothing can be deleted while a parent removal is pending' using errcode = '55006';
  end if;
  -- One open request per target: a second request joins the first as an approval.
  select id into req from public.deletion_requests
  where family_id = p_family and kind = p_kind and target_child_id is not distinct from p_child
    and expires_at > now();
  if req is null then
    insert into public.deletion_requests (family_id, kind, target_child_id, requested_by, approvals, created_at, expires_at)
    values (p_family, p_kind, p_child, mem, array[mem], private.round_hour(now()),
            private.round_hour(now()) + interval '7 days')
    returning id into req;
  else
    update public.deletion_requests set approvals = array_append(approvals, mem)
    where id = req and mem <> all (approvals);
  end if;
  perform private.audit(p_kind || '.delete_requested', mem);
  perform private.execute_if_approved(req);
  return req;
end $$;

-- Ask to delete a child. With one parent it happens at once (soft); otherwise every parent approves.
create function public.request_child_deletion(p_child uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare fam uuid := (select family_id from public.children where id = p_child and deleted_at is null);
begin
  return private.new_deletion_request(fam, 'child', p_child);
end $$;

create function public.request_family_deletion(p_family uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
begin
  return private.new_deletion_request(p_family, 'family', null);
end $$;

-- Approve a pending child or family deletion. Returns true if this approval carried it out.
create function public.approve_deletion(p_request uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.deletion_requests := (select d from public.deletion_requests d where d.id = p_request);
  mem uuid := private.require_member(r.family_id);
begin
  if r.kind not in ('child', 'family') or r.expires_at <= now() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if private.removal_pending(r.family_id) then
    raise exception 'nothing can be deleted while a parent removal is pending' using errcode = '55006';
  end if;
  update public.deletion_requests set approvals = array_append(approvals, mem)
  where id = p_request and mem <> all (approvals);
  perform private.audit(r.kind || '.delete_approved', mem);
  return private.execute_if_approved(p_request);
end $$;

-- Withdraw or decline a request. Any parent can decline a child or family deletion;
-- only the primary user can withdraw a parent removal.
create function public.cancel_deletion_request(p_request uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.deletion_requests := (select d from public.deletion_requests d where d.id = p_request);
  mem uuid := private.require_member(r.family_id);
begin
  if r.kind = 'remove_member' and not private.is_primary(r.family_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.deletion_requests where id = p_request;
  perform private.audit(r.kind || '.request_cancelled', mem);
end $$;

-- The primary user asks to remove another parent. It takes effect after 7 days (run by the
-- maintenance job); the parent sees the request meanwhile, and nothing can be deleted until then.
create function public.request_member_removal(p_family uuid, p_member uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := private.require_primary(p_family);
  req uuid;
begin
  if p_member is null or p_member = me
     or not exists (select 1 from public.family_members where member_id = p_member and family_id = p_family) then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  if exists (select 1 from public.deletion_requests where target_member_id = p_member) then
    raise exception 'already requested' using errcode = '23505';
  end if;
  insert into public.deletion_requests (family_id, kind, target_member_id, requested_by, approvals, created_at, execute_after)
  values (p_family, 'remove_member', p_member, me, array[me], private.round_hour(now()),
          private.round_hour(now()) + interval '7 days')
  returning id into req;
  perform private.audit('member.removal_requested', me);
  return req;
end $$;

-- Restore a soft-deleted child or family until the daily run erases it. Any parent of the family.
create function public.restore_child(p_child uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.children := (select ch from public.children ch where ch.id = p_child);
  mem uuid := private.require_member(c.family_id);
begin
  if not private.restorable(c.deleted_at, now()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.children set deleted_at = null where id = p_child;
  perform private.audit('child.restored', mem);
end $$;

create function public.restore_family(p_family uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  f public.families := (select fa from public.families fa where fa.id = p_family);
  mem uuid := private.my_member_id(p_family, true);
begin
  if mem is null or private.is_anonymous_caller()
     or not private.restorable(f.deleted_at, now()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.families set deleted_at = null where id = p_family;
  perform private.audit('family.restored', mem);
end $$;

-- ---------------------------------------------------------------------------
-- Erasing
-- ---------------------------------------------------------------------------
create function private.erase_family(p_family uuid, p_channel text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  -- Consent records outlive the family only in anonymized form.
  update public.consent_records set family_id = null, member_id = null where family_id = p_family;
  delete from public.families where id = p_family;   -- cascades to every row of the family
  if found then
    insert into public.deletion_proofs (completed_on, request_type, channel, outcome)
    values (private.israel_date(now()), 'family', p_channel, 'erased');
  end if;
end $$;

-- The maintenance job. Runs once a day (pg_cron, as the database owner), at 20:30 UTC: that is
-- 22:30 or 23:30 Israel time, winter or summer, so the run on D+2 always comes before the
-- 00:00 D+3 deadline (docs/sync-supabase-plan.md §9). `p_now` is for tests only; the job passes
-- nothing. Returns counts for the job log (no ids); `erased_late` above 0 means a run was missed
-- and a deadline was broken, so the job log should alert on it.
create function private.run_retention(p_now timestamptz default now()) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r record;
  removed int := 0; children_erased int := 0; families_erased int := 0; aged_out int := 0;
  late int := 0;
  n int;
  today date := private.israel_date(p_now);
begin
  -- 1. Parent removals that waited 7 days. Pending deletions in that family are cancelled.
  for r in select * from public.deletion_requests where kind = 'remove_member' and execute_after <= p_now loop
    delete from public.deletion_requests where family_id = r.family_id and kind in ('child', 'family');
    delete from public.family_members where member_id = r.target_member_id and role <> 'primary';
    delete from public.deletion_requests where id = r.id;
    perform private.audit('member.removed', null);
    removed := removed + 1;
  end loop;

  -- 2. Expired requests, invites and pairing codes leave no trace.
  delete from public.deletion_requests where kind in ('child', 'family') and expires_at <= p_now;
  delete from public.invites where expires_at <= p_now;
  delete from public.device_pairings where expires_at <= p_now;

  -- 3. Soft-deleted children, from the day-rule date on (D+2, Israel date).
  for r in select id, deleted_at from public.children where private.erase_due(deleted_at, p_now) loop
    if p_now >= private.erasure_deadline(r.deleted_at) then late := late + 1; end if;
    delete from public.children where id = r.id;
    insert into public.deletion_proofs (completed_on, request_type, channel, outcome)
    values (today, 'child', 'app', 'erased');
    children_erased := children_erased + 1;
  end loop;

  -- 4. Soft-deleted families, by the same rule.
  for r in select id, deleted_at from public.families where private.erase_due(deleted_at, p_now) loop
    if p_now >= private.erasure_deadline(r.deleted_at) then late := late + 1; end if;
    perform private.erase_family(r.id, 'app');
    families_erased := families_erased + 1;
  end loop;

  -- 5. Families with no activity for 7 years.
  for r in select id from public.families where last_activity_on <= today - interval '7 years' loop
    perform private.erase_family(r.id, 'retention');
    aged_out := aged_out + 1;
  end loop;

  -- 6. Audit entries, proofs of deletion and anonymized consent records older than 7 years.
  delete from public.audit_log where at <= p_now - interval '7 years';
  delete from public.deletion_proofs where completed_on <= today - interval '7 years';
  delete from public.consent_records where family_id is null and agreed_on <= today - interval '7 years';

  -- 7. Mistakes: the newest 200 per child.
  delete from public.mistakes m using (
    select id, row_number() over (partition by child_id order by at desc, id) as rn from public.mistakes
  ) ranked
  where m.id = ranked.id and ranked.rn > 200;
  get diagnostics n = row_count;

  return jsonb_build_object('members_removed', removed, 'children_erased', children_erased,
    'families_erased', families_erased, 'families_aged_out', aged_out, 'mistakes_trimmed', n,
    'erased_late', late);
end $$;
