-- Sync step 2: grants. Supabase grants everything in `public` to anon and authenticated by
-- default; this migration takes all of it back and grants only what the RLS policies are for.
-- `anon` (not signed in) gets nothing at all. `service_role` keeps its access (owner tools only).

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

-- Tables (rows still filtered by RLS). Sign-in fingerprints (auth_hmac) are never selectable.
grant select on public.families to authenticated;
grant select (member_id, family_id, role, joined_at) on public.family_members to authenticated;
grant select (id, family_id, label_enc, linked_at, last_seen_on, revoked_at) on public.devices to authenticated;
grant select on public.children to authenticated;
grant select on public.device_children to authenticated;
grant select, insert, update on public.child_device_totals to authenticated;
grant select, insert, update on public.daily_activity to authenticated;
grant select, insert, update on public.topic_progress to authenticated;
grant select, insert on public.exam_results to authenticated;
grant select, insert on public.mistakes to authenticated;
grant select, insert, delete on public.tests to authenticated;
grant select, insert on public.test_answer_keys to authenticated;
grant select, delete on public.test_assignments to authenticated;
grant insert (id, test_id, child_id, family_id) on public.test_assignments to authenticated;
grant select (id, kind, family_id, expires_at) on public.invites to authenticated;
grant select on public.deletion_requests to authenticated;
grant select on public.consent_records to authenticated;
grant select, insert, update, delete on public.ref_schools to authenticated;
grant select, insert, update, delete on public.ref_grades to authenticated;
-- No grants: app_admins, device_pairings, audit_log, deletion_proofs.

-- Helpers used inside RLS policies (they return only the caller's own scope).
grant execute on function
  private.my_hmac(), private.is_anonymous_caller(), private.my_family_ids(), private.is_admin(),
  private.my_device_id(), private.my_device_family(), private.my_child_ids(), private.my_test_ids()
to authenticated;

-- The API.
grant execute on function
  public.invite_primary(text),
  public.create_family(text),
  public.invite_parent(uuid, text),
  public.accept_invites(),
  public.my_families(),
  public.rename_family(uuid, text),
  public.record_consent(uuid, text),
  public.hand_over_primary(uuid, uuid),
  public.upsert_child(uuid, uuid, text, text, int, text, timestamptz),
  public.family_children(uuid),
  public.device_children_list(),
  public.create_device_pairing(uuid, text, uuid[]),
  public.redeem_device_pairing(text, uuid),
  public.set_device_children(uuid, uuid[]),
  public.revoke_device(uuid),
  public.rename_device(uuid, text),
  public.family_devices(uuid),
  public.mark_exam_seen(uuid),
  public.device_tests(),
  public.submit_test_answers(uuid, jsonb),
  public.release_test(uuid, text),
  public.request_child_deletion(uuid),
  public.request_family_deletion(uuid),
  public.approve_deletion(uuid),
  public.cancel_deletion_request(uuid),
  public.request_member_removal(uuid, uuid),
  public.restore_child(uuid),
  public.restore_family(uuid)
to authenticated;
-- private.run_retention() and private.add_admin() are for the database owner only
-- (pg_cron and the SQL editor).
