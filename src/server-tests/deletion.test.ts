// Deletion rules, enforced in the database (docs/family-view-design.md "Deleting a child",
// security-privacy.md §5 abuse case 1, §10, §12.2):
//   every parent approves; requests expire after 7 days; removing a parent waits 7 days and blocks
//   deletion meanwhile; soft delete restorable until the daily run on D+2 (Israel date), which erases it; never zero parents;
//   retention after 7 years without activity; anonymized proofs.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BOOT_TIMEOUT, TestDb, denied, uuid, type Caller } from './db';

let db: TestDb;
let admin: Caller;
let seq = 0;

interface Fam {
  id: string;
  primary: Caller;
  parents: Caller[];
  members: string[]; // [primary, ...parents]
  child: string;
  device: Caller;
}

/** A family with `extra` parents besides the primary user, one child and a paired device. */
async function family(extra: number): Promise<Fam> {
  const n = ++seq;
  const primary = await db.newParent(`p${n}`, `p${n}@example.org`);
  await db.as(admin, `select public.invite_primary($1)`, [primary.email]);
  const [{ id }] = await db.as<{ id: string }>(primary, `select public.create_family('משפחה') as id`);
  await db.as(primary, `select public.record_consent($1, '2026-11')`, [id]);
  const parents: Caller[] = [];
  for (let i = 0; i < extra; i++) {
    const q = await db.newParent(`q${n}.${i}`, `q${n}.${i}@example.org`);
    await db.as(primary, `select public.invite_parent($1, $2)`, [id, q.email]);
    await db.as(q, `select * from public.accept_invites()`);
    parents.push(q);
  }
  const members: string[] = [];
  for (const c of [primary, ...parents]) {
    const [{ member_id }] = await db.as<{ member_id: string }>(c, `select member_id from public.my_families() where family_id = $1`, [id]);
    members.push(member_id);
  }
  const child = uuid();
  await db.as(primary, `select public.upsert_child($1, $2, 'ילד', '🐶', 5, null, now())`, [child, id]);
  const [{ code }] = await db.as<{ code: string }>(primary, `select public.create_device_pairing($1, null, $2::uuid[]) as code`, [id, [child]]);
  const device = await db.newDeviceUser(`d${n}`);
  await db.as(device, `select public.redeem_device_pairing($1, $2)`, [code, uuid()]);
  await db.as(device, `insert into public.exam_results (id, child_id, family_id, pack_id, topic_ids, difficulty, questions, correct, score, taken_at)
                       values ($1, $2, $3, 'g5.math', '{}', 'easy', 5, 5, 100, now())`, [uuid(), child, id]);
  return { id, primary, parents, members, child, device };
}

const childState = async (id: string) =>
  (await db.owner<{ deleted: boolean }>(`select deleted_at is not null as deleted from public.children where id = $1`, [id]))[0];

const proofs = () => db.owner(`select request_type, channel, outcome from public.deletion_proofs order by request_type, channel`);

/** Set a soft delete to noon (Israel time), `days` Israel calendar days before today. */
const deletedDaysAgo = (table: 'children' | 'families', id: string, days: number) =>
  db.owner(`update public.${table} set deleted_at = ((private.israel_date(now()) - $2::int) + time '12:00') at time zone 'Asia/Jerusalem'
            where id = $1`, [id, days]);

const retention = () => db.owner<{ r: Record<string, number> }>(`select private.run_retention() as r`).then((x) => x[0].r);

/** Every row anywhere that still mentions this family. */
async function rowsOfFamily(fam: string): Promise<number> {
  const tables = await db.owner<{ table_name: string }>(`select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'family_id'`);
  let n = (await db.owner<{ n: number }>(`select count(*)::int as n from public.families where id = $1`, [fam]))[0].n;
  for (const t of tables) {
    n += (await db.owner<{ n: number }>(`select count(*)::int as n from public.${t.table_name} where family_id = $1`, [fam]))[0].n;
  }
  return n;
}

beforeAll(async () => {
  db = await TestDb.create();
  admin = await db.newParent('admin', 'owner@example.org');
  await db.owner(`select private.add_admin($1)`, [admin.id]);
}, BOOT_TIMEOUT);

describe('deleting a child', () => {
  it('with one parent: soft-deleted at once, hidden from the device, restorable', async () => {
    const f = await family(0);
    await db.as(f.primary, `select public.request_child_deletion($1)`, [f.child]);
    expect(await childState(f.child)).toEqual({ deleted: true });
    expect(await db.as(f.device, `select id from public.device_children_list()`)).toEqual([]);
    expect(await db.as(f.device, `select id from public.exam_results`)).toEqual([]);
    // Parents still see it (to restore it), marked deleted.
    const [c] = await db.as<{ deleted_at: string | null }>(f.primary, `select deleted_at from public.family_children($1)`, [f.id]);
    expect(c.deleted_at).not.toBeNull();
    await db.as(f.primary, `select public.restore_child($1)`, [f.child]);
    expect(await childState(f.child)).toEqual({ deleted: false });
    // Restoring brings the device link back too.
    expect(await db.as(f.device, `select id from public.device_children_list()`)).toEqual([{ id: f.child }]);
  });

  it('with two parents: needs both; either can decline', async () => {
    const f = await family(1);
    const [{ req }] = await db.as<{ req: string }>(f.parents[0], `select public.request_child_deletion($1) as req`, [f.child]);
    expect(await childState(f.child)).toEqual({ deleted: false });
    // The other parent sees the request in the app.
    expect((await db.as(f.primary, `select id from public.deletion_requests where id = $1`, [req])).length).toBe(1);
    // Asking again doesn't count as a second approval.
    await db.as(f.parents[0], `select public.request_child_deletion($1)`, [f.child]);
    await db.as(f.parents[0], `select public.approve_deletion($1)`, [req]);
    expect(await childState(f.child)).toEqual({ deleted: false });
    expect(await db.as(f.primary, `select public.approve_deletion($1) as done`, [req])).toEqual([{ done: true }]);
    expect(await childState(f.child)).toEqual({ deleted: true });
    await db.as(f.parents[0], `select public.restore_child($1)`, [f.child]);

    const [{ req: req2 }] = await db.as<{ req: string }>(f.primary, `select public.request_child_deletion($1) as req`, [f.child]);
    await db.as(f.parents[0], `select public.cancel_deletion_request($1)`, [req2]);
    await denied(db.as(f.primary, `select public.approve_deletion($1)`, [req2]));
    expect(await childState(f.child)).toEqual({ deleted: false });
  });

  it('with three parents: needs all three', async () => {
    const f = await family(2);
    const [{ req }] = await db.as<{ req: string }>(f.primary, `select public.request_child_deletion($1) as req`, [f.child]);
    expect(await db.as(f.parents[0], `select public.approve_deletion($1) as done`, [req])).toEqual([{ done: false }]);
    expect(await childState(f.child)).toEqual({ deleted: false });
    expect(await db.as(f.parents[1], `select public.approve_deletion($1) as done`, [req])).toEqual([{ done: true }]);
  });

  it('a request expires after 7 days', async () => {
    const f = await family(1);
    const [{ req }] = await db.as<{ req: string }>(f.primary, `select public.request_child_deletion($1) as req`, [f.child]);
    const [{ days }] = await db.owner<{ days: number }>(`select extract(day from expires_at - created_at)::int as days from public.deletion_requests where id = $1`, [req]);
    expect(days).toBe(7);
    await db.ageBy('deletion_requests', 'expires_at', 'id = $1', '7 days', [req]);
    await denied(db.as(f.parents[0], `select public.approve_deletion($1)`, [req]));
    expect(await childState(f.child)).toEqual({ deleted: false });
    await retention();
    expect(await db.owner(`select id from public.deletion_requests where id = $1`, [req])).toEqual([]);
  });

  it('a child device can neither request nor approve a deletion', async () => {
    const f = await family(1);
    await denied(db.as(f.device, `select public.request_child_deletion($1)`, [f.child]));
    const [{ req }] = await db.as<{ req: string }>(f.primary, `select public.request_child_deletion($1) as req`, [f.child]);
    await denied(db.as(f.device, `select public.approve_deletion($1)`, [req]));
    await denied(db.as(f.device, `select public.restore_child($1)`, [f.child]));
    expect(await childState(f.child)).toEqual({ deleted: false });
  });

  it('on D+2 it can still be restored until the run, which erases it with an anonymized proof', async () => {
    const f = await family(0);
    await db.as(f.primary, `select public.request_child_deletion($1)`, [f.child]);
    await deletedDaysAgo('children', f.child, 2);
    await db.as(f.primary, `select public.restore_child($1)`, [f.child]);
    expect(await childState(f.child)).toEqual({ deleted: false });

    await db.as(f.primary, `select public.request_child_deletion($1)`, [f.child]);
    await deletedDaysAgo('children', f.child, 2);
    const before = (await proofs()).length;
    const r = await retention();
    expect(r.erased_late).toBe(0);
    expect(await db.owner(`select id from public.children where id = $1`, [f.child])).toEqual([]);
    expect(await db.owner(`select id from public.exam_results where child_id = $1`, [f.child])).toEqual([]);
    await denied(db.as(f.primary, `select public.restore_child($1)`, [f.child]));
    const after = await proofs();
    expect(after.length).toBe(before + 1);
    expect(after).toContainEqual({ request_type: 'child', channel: 'app', outcome: 'erased' });
  });

  it('a missed run: after the deadline it cannot be restored, and the next run erases it and reports it late', async () => {
    const f = await family(0);
    await db.as(f.primary, `select public.request_child_deletion($1)`, [f.child]);
    await deletedDaysAgo('children', f.child, 3);
    await denied(db.as(f.primary, `select public.restore_child($1)`, [f.child]));
    const r = await retention();
    expect(r.erased_late).toBe(1);
    expect(await db.owner(`select id from public.children where id = $1`, [f.child])).toEqual([]);
  });
});

// The owner's rule: erased within 48 hours of the end of the day (Israel time) on which the
// deletion was confirmed. Confirmed on day D: restorable until the daily run on D+2, which erases
// it; deadline 00:00 on D+3. The job runs daily at 20:30 UTC (22:30 or 23:30 in Israel).
describe('the day rule for erasing (Israel time)', () => {
  /** An Israel wall-clock time as SQL, e.g. il('2026-12-01 23:59'). */
  const il = (local: string) => `('${local}'::timestamp at time zone 'Asia/Jerusalem')`;

  /** A soft-deleted child confirmed at an Israel time (stored rounded to the hour). */
  async function deletedChild(fam: Fam, local: string): Promise<string> {
    const id = uuid();
    await db.as(fam.primary, `select public.upsert_child($1, $2, 'ילד', '🐶', 5, null, now())`, [id, fam.id]);
    await db.owner(`update public.children set deleted_at = private.round_hour(${il(local)}) where id = $1`, [id]);
    return id;
  }

  const exists = async (id: string) => (await db.owner(`select 1 from public.children where id = $1`, [id])).length === 1;
  const runAt = (at: string) =>
    db.owner<{ r: Record<string, number> }>(`select private.run_retention(${at}) as r`).then((x) => x[0].r);
  const restorable = async (id: string, at: string) =>
    (await db.owner<{ ok: boolean }>(`select private.restorable(deleted_at, ${at}) as ok from public.children where id = $1`, [id]))[0].ok;
  const hours = [...Array(24).keys()].map((h) => `${String(h).padStart(2, '0')}:00`).concat('23:59');

  // These runs use dates in the future: first clear soft deletes that earlier tests left, so the
  // counts below are about this test's rows only.
  beforeEach(async () => {
    await db.owner(`delete from public.children where deleted_at is not null`);
    await db.owner(`delete from public.families where deleted_at is not null`);
  });

  it('confirmed at 00:01 or 23:59: restorable all of D+1 (nothing erased), erased by the run on D+2', async () => {
    const f = await family(0);
    const early = await deletedChild(f, '2026-12-01 00:01');
    const late = await deletedChild(f, '2026-12-01 23:59');
    for (const h of hours) {
      const at = il(`2026-12-02 ${h}`);
      expect((await runAt(at)).children_erased).toBe(0);
      expect(await exists(early)).toBe(true);
      expect(await exists(late)).toBe(true);
      expect(await restorable(early, at)).toBe(true);
      expect(await restorable(late, at)).toBe(true);
    }
    // D+2, before the run: still restorable.
    expect(await restorable(late, il('2026-12-03 22:00'))).toBe(true);
    const r = await runAt(`'2026-12-03 20:30+00'`); // the scheduled time: 22:30 in Israel (winter)
    expect(r.erased_late).toBe(0);
    expect(await exists(early)).toBe(false);
    expect(await exists(late)).toBe(false);
  });

  it('a run at any hour of D+2 erases it, before the deadline', async () => {
    const f = await family(0);
    for (const h of hours) {
      const id = await deletedChild(f, '2026-12-10 23:59');
      const at = il(`2026-12-12 ${h}`);
      const r = await runAt(at);
      expect(r.erased_late).toBe(0);
      expect(await exists(id)).toBe(false);
      const [{ before }] = await db.owner<{ before: boolean }>(
        `select ${at} < private.erasure_deadline(private.round_hour(${il('2026-12-10 23:59')})) as before`);
      expect(before).toBe(true);
    }
    // The deadline itself: 00:00 on D+3, Israel time.
    const [{ deadline }] = await db.owner<{ deadline: boolean }>(
      `select private.erasure_deadline(${il('2026-12-10 23:59')}) = ${il('2026-12-13 00:00')} as deadline`);
    expect(deadline).toBe(true);
  });

  it('a deletion confirmed just before a daylight-saving change', async () => {
    const f = await family(0);
    // Israel summer time starts Friday 2027-03-26 at 02:00, and ends Sunday 2026-10-25 at 02:00.
    const [{ spring, autumn }] = await db.owner<{ spring: boolean; autumn: boolean }>(`select
      extract(hour from ('2027-03-27 12:00+00'::timestamptz at time zone 'Asia/Jerusalem')) = 15
        and extract(hour from ('2027-03-25 12:00+00'::timestamptz at time zone 'Asia/Jerusalem')) = 14 as spring,
      extract(hour from ('2026-10-26 12:00+00'::timestamptz at time zone 'Asia/Jerusalem')) = 14
        and extract(hour from ('2026-10-24 12:00+00'::timestamptz at time zone 'Asia/Jerusalem')) = 15 as autumn`);
    expect({ spring, autumn }).toEqual({ spring: true, autumn: true });

    for (const [d, d1, d2] of [['2027-03-25', '2027-03-26', '2027-03-27'], ['2026-10-24', '2026-10-25', '2026-10-26']]) {
      const id = await deletedChild(f, `${d} 23:59`);
      expect((await runAt(`'${d1} 20:30+00'`)).children_erased).toBe(0);
      expect(await exists(id)).toBe(true);
      const r = await runAt(`'${d2} 20:30+00'`);
      expect(r.erased_late).toBe(0);
      expect(await exists(id)).toBe(false);
    }
  });

  it('the 20:30 UTC schedule (and anything from 20:00 to 20:59) is 22:00–23:59 in Israel every day', async () => {
    const bad = await db.owner(`
      select d::date, m from generate_series('2026-01-01'::date, '2030-12-31'::date, interval '1 day') d,
        unnest(array[0, 30, 59]) m
      where private.israel_date((d::date + time '20:00' + make_interval(mins => m)) at time zone 'UTC') <> d::date
         or extract(hour from ((d::date + time '20:00' + make_interval(mins => m)) at time zone 'UTC') at time zone 'Asia/Jerusalem') not in (22, 23)`);
    expect(bad).toEqual([]);
  });
});

describe('removing a parent', () => {
  it('waits 7 days, the parent sees it, and nothing can be deleted meanwhile', async () => {
    const f = await family(1);
    // A child deletion requested before the removal can't be approved during it either.
    const [{ early }] = await db.as<{ early: string }>(f.primary, `select public.request_child_deletion($1) as early`, [f.child]);
    const [{ req }] = await db.as<{ req: string }>(f.primary, `select public.request_member_removal($1, $2) as req`, [f.id, f.members[1]]);
    const [r] = await db.as<{ kind: string; target_member_id: string; days: number }>(f.parents[0],
      `select kind, target_member_id, extract(day from execute_after - created_at)::int as days from public.deletion_requests where id = $1`, [req]);
    expect(r).toEqual({ kind: 'remove_member', target_member_id: f.members[1], days: 7 });

    await denied(db.as(f.primary, `select public.request_child_deletion($1)`, [f.child]));
    await denied(db.as(f.primary, `select public.request_family_deletion($1)`, [f.id]));
    await denied(db.as(f.parents[0], `select public.approve_deletion($1)`, [early]));
    // The parent being removed can't stop it; only the primary user can withdraw it.
    await denied(db.as(f.parents[0], `select public.cancel_deletion_request($1)`, [req]));
    // A pending removal can't be dodged by handing the primary role to that parent.
    await denied(db.as(f.primary, `select public.hand_over_primary($1, $2)`, [f.id, f.members[1]]));

    // Before 7 days: nothing happens.
    await retention();
    expect((await db.as(f.parents[0], `select family_id from public.my_families()`)).length).toBe(1);

    await db.ageBy('deletion_requests', 'execute_after', 'id = $1', '7 days', [req]);
    const r2 = await retention();
    expect(r2.members_removed).toBe(1);
    expect(await db.as(f.parents[0], `select family_id from public.my_families()`)).toEqual([]);
    expect(await db.as(f.parents[0], `select id from public.children`)).toEqual([]);
    // Pending deletions in that family were cancelled, so the remaining parent starts fresh.
    expect(await db.owner(`select id from public.deletion_requests where family_id = $1`, [f.id])).toEqual([]);
    await db.as(f.primary, `select public.request_child_deletion($1)`, [f.child]);
    expect(await childState(f.child)).toEqual({ deleted: true });
  });

  it('the primary user can withdraw a removal', async () => {
    const f = await family(1);
    const [{ req }] = await db.as<{ req: string }>(f.primary, `select public.request_member_removal($1, $2) as req`, [f.id, f.members[1]]);
    await db.as(f.primary, `select public.cancel_deletion_request($1)`, [req]);
    const [{ req: del }] = await db.as<{ req: string }>(f.primary, `select public.request_child_deletion($1) as req`, [f.child]);
    expect(await db.as(f.parents[0], `select public.approve_deletion($1) as done`, [del])).toEqual([{ done: true }]);
  });

  it('only the primary user removes, never themself, and never twice', async () => {
    const f = await family(2);
    await denied(db.as(f.parents[0], `select public.request_member_removal($1, $2)`, [f.id, f.members[2]]));
    await denied(db.as(f.primary, `select public.request_member_removal($1, $2)`, [f.id, f.members[0]]));
    await db.as(f.primary, `select public.request_member_removal($1, $2)`, [f.id, f.members[2]]);
    await denied(db.as(f.primary, `select public.request_member_removal($1, $2)`, [f.id, f.members[2]]));
  });
});

describe('a family always has at least one parent', () => {
  it('the last parent and the primary user can never be removed directly, even by the owner', async () => {
    const f = await family(0);
    await denied(db.owner(`delete from public.family_members where family_id = $1`, [f.id]));
    const g = await family(1);
    await denied(db.owner(`delete from public.family_members where member_id = $1`, [g.members[0]]));
    await denied(db.owner(`update public.family_members set role = 'parent' where member_id = $1`, [g.members[0]]));
    expect((await db.owner(`select 1 from public.family_members where family_id = $1`, [g.id])).length).toBe(2);
  });

  it('two primary users at once are impossible', async () => {
    const f = await family(1);
    await denied(db.owner(`update public.family_members set role = 'primary' where member_id = $1`, [f.members[1]]), ['23505']);
  });
});

describe('deleting the family', () => {
  it('needs every parent, is soft until the run on D+2, then erases everything; consent is anonymized', async () => {
    const f = await family(1);
    const [{ req }] = await db.as<{ req: string }>(f.primary, `select public.request_family_deletion($1) as req`, [f.id]);
    expect((await db.as(f.primary, `select family_id from public.my_families()`)).length).toBe(1);
    await db.as(f.parents[0], `select public.approve_deletion($1)`, [req]);
    // Hidden at once, for parents and the device.
    expect(await db.as(f.primary, `select family_id from public.my_families()`)).toEqual([]);
    expect(await db.as(f.primary, `select id from public.children`)).toEqual([]);
    expect(await db.as(f.device, `select id from public.device_children_list()`)).toEqual([]);
    // Any parent can restore it until it is erased.
    await db.as(f.parents[0], `select public.restore_family($1)`, [f.id]);
    expect((await db.as(f.primary, `select family_id from public.my_families()`)).length).toBe(1);

    const [{ req: again }] = await db.as<{ req: string }>(f.parents[0], `select public.request_family_deletion($1) as req`, [f.id]);
    await db.as(f.primary, `select public.approve_deletion($1)`, [again]);
    await deletedDaysAgo('families', f.id, 2);
    const r = await retention();
    expect(r.families_erased).toBe(1);
    expect(r.erased_late).toBe(0);
    await denied(db.as(f.primary, `select public.restore_family($1)`, [f.id]));
    expect(await rowsOfFamily(f.id)).toBe(0);
    expect(await proofs()).toContainEqual({ request_type: 'family', channel: 'app', outcome: 'erased' });
    // The consent record stays only as "a notice version was agreed on a date".
    const consent = await db.owner(`select family_id, member_id from public.consent_records where member_id = any ($1::uuid[])`, [f.members]);
    expect(consent).toEqual([]);
    expect((await db.owner(`select 1 from public.consent_records where family_id is null and member_id is null`)).length).toBeGreaterThan(0);
  });
});

describe('retention', () => {
  it('erases a family 7 years after its last activity, and keeps active ones', async () => {
    const old = await family(0);
    const active = await family(0);
    await db.owner(`update public.families set last_activity_on = current_date - interval '7 years' where id = $1`, [old.id]);
    await db.owner(`update public.families set last_activity_on = current_date - interval '7 years' + interval '1 day' where id = $1`, [active.id]);
    const r = await retention();
    expect(r.families_aged_out).toBe(1);
    expect(await rowsOfFamily(old.id)).toBe(0);
    expect(await rowsOfFamily(active.id)).toBeGreaterThan(0);
    expect(await proofs()).toContainEqual({ request_type: 'family', channel: 'retention', outcome: 'erased' });
  });

  it("a child's activity resets the clock", async () => {
    const f = await family(0);
    await db.owner(`update public.families set last_activity_on = current_date - interval '6 years' where id = $1`, [f.id]);
    await db.as(f.device, `insert into public.mistakes (id, child_id, family_id, topic_id, prompt, given, correct, at)
                           values ($1, $2, $3, 't', 'p', 'g', 'c', now())`, [uuid(), f.child, f.id]);
    const [{ today }] = await db.owner<{ today: boolean }>(`select last_activity_on = current_date as today from public.families where id = $1`, [f.id]);
    expect(today).toBe(true);
  });

  it('drops audit entries and proofs older than 7 years, and keeps the newest 200 mistakes per child', async () => {
    await db.owner(`insert into public.audit_log (at, action) values
      (date_trunc('hour', now() - interval '7 years 1 day', 'UTC'), 'old.entry'),
      (date_trunc('hour', now() - interval '6 years', 'UTC'), 'recent.entry')`);
    // Exact times are refused: parent action times are rounded to the hour by a table rule.
    await denied(db.owner(`insert into public.audit_log (at, action) values (date_trunc('hour', now(), 'UTC') + interval '1 minute', 'x')`));
    await db.owner(`insert into public.deletion_proofs (completed_on, request_type, channel, outcome) values (current_date - interval '7 years 1 day', 'child', 'app', 'erased')`);
    const f = await family(0);
    const ids: string[] = [];
    for (let i = 0; i < 205; i++) ids.push(uuid());
    await db.owner(`insert into public.mistakes (id, child_id, family_id, topic_id, prompt, given, correct, at)
                    select id, $2, $3, 't', 'p', 'g', 'c', now() - make_interval(mins => ord::int)
                    from unnest($1::uuid[]) with ordinality as u(id, ord)`, [ids, f.child, f.id]);
    await retention();
    expect(await db.owner(`select action from public.audit_log where action in ('old.entry', 'recent.entry')`)).toEqual([{ action: 'recent.entry' }]);
    expect(await db.owner(`select 1 from public.deletion_proofs where completed_on < current_date - interval '7 years'`)).toEqual([]);
    const [{ n }] = await db.owner<{ n: number }>(`select count(*)::int as n from public.mistakes where child_id = $1`, [f.child]);
    expect(n).toBe(200);
    // The 5 oldest went.
    expect(await db.owner(`select 1 from public.mistakes where id = any ($1::uuid[])`, [ids.slice(200)])).toEqual([]);
  });

  it('proofs of deletion and audit entries hold no ids, names or emails', async () => {
    const cols = await db.owner<{ table_name: string; column_name: string }>(`select table_name, column_name from information_schema.columns
      where table_schema = 'public' and table_name in ('deletion_proofs', 'audit_log') order by 1, 2`);
    expect(cols.map((c) => `${c.table_name}.${c.column_name}`)).toEqual([
      'audit_log.action', 'audit_log.at', 'audit_log.id', 'audit_log.member_id',
      'deletion_proofs.channel', 'deletion_proofs.completed_on', 'deletion_proofs.id',
      'deletion_proofs.outcome', 'deletion_proofs.request_type',
    ]);
    const onHour = await db.owner(`select 1 from public.audit_log where at <> date_trunc('hour', at, 'UTC')`);
    expect(onHour).toEqual([]);
  });

  it('only the database owner can run it', async () => {
    const f = await family(0);
    await denied(db.as(f.primary, `select private.run_retention()`));
    await denied(db.as(f.device, `select private.run_retention()`));
    await denied(db.as(admin, `select private.run_retention()`));
  });
});
