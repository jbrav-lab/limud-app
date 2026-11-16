// Two complete families built only through the API, as the app would: admin invite → primary user
// creates the family → invites a second parent → children → a paired child phone → progress → a test.
import { TestDb, uuid, type Caller } from './db';

export interface Family {
  key: 'A' | 'B';
  id: string;
  name: string;
  primary: Caller;
  parent: Caller;
  primaryMember: string;
  parentMember: string;
  /** child1 is on the device; child2 is not. */
  child1: string;
  child2: string;
  childNames: [string, string];
  device: Caller;
  deviceId: string;
  deviceLabel: string;
  examId: string;
  mistakeId: string;
  testId: string;
  assignmentId: string;
}

export interface World {
  db: TestDb;
  admin: Caller;
  A: Family;
  B: Family;
  /** Signed in, but in no family and not admin. */
  stranger: Caller;
}

const NAMES = {
  A: { family: 'משפחת אלון', kids: ['נועה', 'איתי'] as [string, string], device: 'הטלפון של נועה' },
  B: { family: 'משפחת ברק', kids: ['שירה', 'עומר'] as [string, string], device: 'הטבלט של שירה' },
};

async function buildFamily(db: TestDb, admin: Caller, key: 'A' | 'B'): Promise<Family> {
  const n = NAMES[key];
  const lower = key.toLowerCase();
  const primary = await db.newParent(`${key}.primary`, `Primary.${lower}@Example.org`);
  const parent = await db.newParent(`${key}.parent`, `parent.${lower}@example.org`);

  await db.as(admin, `select public.invite_primary($1)`, [primary.email]);
  // Emails are matched lower-cased: the invite was sent to the mixed-case address.
  const [{ id }] = await db.as<{ id: string }>(primary, `select public.create_family($1) as id`, [n.family]);
  await db.as(primary, `select public.record_consent($1, '2026-11')`, [id]);
  await db.as(primary, `select public.invite_parent($1, $2)`, [id, parent.email!.toUpperCase()]);
  await db.as(parent, `select * from public.accept_invites()`);

  const members = await db.as<{ member_id: string; role: string }>(primary,
    `select member_id, role from public.family_members where family_id = $1`, [id]);
  const primaryMember = members.find((m) => m.role === 'primary')!.member_id;
  const parentMember = members.find((m) => m.role === 'parent')!.member_id;

  const child1 = uuid();
  const child2 = uuid();
  const now = new Date().toISOString();
  await db.as(primary, `select public.upsert_child($1, $2, $3, '🦊', 5, 'analytical', $4)`, [child1, id, n.kids[0], now]);
  await db.as(parent, `select public.upsert_child($1, $2, $3, '🦉', 4, null, $4)`, [child2, id, n.kids[1], now]);

  const [{ code }] = await db.as<{ code: string }>(primary,
    `select public.create_device_pairing($1, $2, $3::uuid[]) as code`, [id, n.device, [child1]]);
  const device = await db.newDeviceUser(`${key}.device`);
  const deviceId = uuid();
  await db.as(device, `select public.redeem_device_pairing($1, $2)`, [code, deviceId]);

  // The device syncs progress for child1.
  const examId = uuid();
  const mistakeId = uuid();
  await db.as(device, `insert into public.child_device_totals (child_id, device_id, family_id, stars, sessions, updated_at)
                        values ($1, $2, $3, 12, 3, now())`, [child1, deviceId, id]);
  await db.as(device, `insert into public.daily_activity (child_id, device_id, family_id, day, answered)
                        values ($1, $2, $3, current_date, 20)`, [child1, deviceId, id]);
  await db.as(device, `insert into public.topic_progress (child_id, topic_id, family_id, level, run_correct, run_wrong,
                          attempts, first_try, second_try, by_level, last_at, updated_at)
                        values ($1, 'g5.math.fractions', $2, 2, 3, 0, 10, 7, 2, '{5,5,0}', now(), now())`, [child1, id]);
  await db.as(device, `insert into public.exam_results (id, child_id, family_id, pack_id, topic_ids, difficulty,
                          questions, correct, score, taken_at)
                        values ($1, $2, $3, 'g5.math', '{g5.math.fractions}', 'mixed', 10, 8, 80, now())`, [examId, child1, id]);
  await db.as(device, `insert into public.mistakes (id, child_id, family_id, topic_id, prompt, given, correct, at)
                        values ($1, $2, $3, 'g5.math.fractions', 'חצי (1/2) ועוד רבע (1/4)', '2/6', '3/4', now())`,
    [mistakeId, child1, id]);

  // A parent makes a test for child1; the device submits answers.
  const testId = uuid();
  const assignmentId = uuid();
  await db.as(parent, `insert into public.tests (id, family_id, grade, pack_id, topic_ids, questions)
                        values ($1, $2, 5, 'g5.math', '{g5.math.fractions}', '[{"q":"1/2 + 1/4"}]')`, [testId, id]);
  await db.as(parent, `insert into public.test_answer_keys (test_id, family_id, answers) values ($1, $2, '["3/4"]')`, [testId, id]);
  await db.as(parent, `insert into public.test_assignments (id, test_id, child_id, family_id) values ($1, $2, $3, $4)`,
    [assignmentId, testId, child1, id]);
  await db.as(device, `select public.submit_test_answers($1, '["3/4"]')`, [assignmentId]);

  return {
    key, id, name: n.family, primary, parent, primaryMember, parentMember, child1, child2, childNames: n.kids,
    device, deviceId, deviceLabel: n.device, examId, mistakeId, testId, assignmentId,
  };
}

export async function buildWorld(): Promise<World> {
  const db = await TestDb.create();
  const admin = await db.newParent('admin', 'owner@example.org');
  await db.owner(`select private.add_admin($1)`, [admin.id]);
  const A = await buildFamily(db, admin, 'A');
  const B = await buildFamily(db, admin, 'B');
  const stranger = await db.newParent('stranger', 'stranger@example.org');
  return { db, admin, A, B, stranger };
}
