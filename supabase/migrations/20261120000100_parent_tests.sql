-- Parent-made tests, first version (owner, 2026-11-20).
-- Scoring runs on the parent's phone with the app's own answer checker (owner's choice, 2026-11-20:
-- "Parent's phone"), so a parent releases the results together with the score. The child's device
-- still never sees an answer key before release; after release it may read the key of its own
-- released tests, to show the right answers and explanations (family-view-design.md, step 4).

-- A parent of the family releases a submitted test with its score (0-100) and an optional short note.
create function public.score_and_release(p_assignment uuid, p_score int, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  fam uuid;
  mem uuid;
begin
  if p_assignment is null or p_score is null or p_score < 0 or p_score > 100
     or (p_note is not null and (length(p_note) > 500 or p_note ~ '[[:cntrl:]]')) then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  fam := (select family_id from public.test_assignments where id = p_assignment);
  mem := private.require_member(fam);
  update public.test_assignments
  set score = p_score, note = nullif(btrim(p_note), ''), reviewed_by = mem, released_by = mem,
      released_at = private.round_hour(now())
  where id = p_assignment and submitted_at is not null and released_at is null;
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform private.audit('test.released', mem);
end $$;

-- On the child's device: the answer keys of its own children's tests, only once released.
create function public.device_released_keys()
returns table (assignment_id uuid, answers jsonb)
language sql stable security definer set search_path = '' as $$
  select a.id, k.answers
  from public.test_assignments a join public.test_answer_keys k on k.test_id = a.test_id
  where a.child_id in (select private.my_child_ids()) and a.released_at is not null
  order by a.id
$$;

revoke execute on function public.score_and_release(uuid, int, text) from public, anon;
grant execute on function public.score_and_release(uuid, int, text) to authenticated;
revoke execute on function public.device_released_keys() from public, anon;
grant execute on function public.device_released_keys() to authenticated;
