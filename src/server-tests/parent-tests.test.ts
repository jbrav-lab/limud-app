// Parent-made tests (supabase/migrations/20261120000100_parent_tests.sql): a parent releases a submitted
// test with the score their phone computed; the child's device gets a test's answer key only after release.
import { beforeAll, describe, expect, it } from 'vitest';
import { BOOT_TIMEOUT, denied, uuid } from './db';
import { buildWorld, type World } from './fixtures';

let w: World;
beforeAll(async () => {
  w = await buildWorld();
}, BOOT_TIMEOUT);

describe('parent-made tests: score, release and the key after release', () => {
  it('the child’s device never reads a key before release, by any route', async () => {
    const { db, A } = w;
    expect(await db.as(A.device, `select * from public.device_released_keys()`)).toEqual([]);
    expect(await db.as(A.device, `select answers from public.test_answer_keys`)).toEqual([]);
    // The questions themselves are readable (they carry no answers).
    expect((await db.as(A.device, `select questions from public.device_tests()`)).length).toBe(1);
  });

  it('refuses bad scores, other families, devices and unsubmitted tests', async () => {
    const { db, A, B } = w;
    await denied(db.as(A.primary, `select public.score_and_release($1, 101)`, [A.assignmentId]));
    await denied(db.as(A.primary, `select public.score_and_release($1, -1)`, [A.assignmentId]));
    await denied(db.as(A.primary, `select public.score_and_release($1, 50, $2)`, [A.assignmentId, 'x'.repeat(501)]));
    await denied(db.as(B.primary, `select public.score_and_release($1, 80)`, [A.assignmentId]));
    await denied(db.as(A.device, `select public.score_and_release($1, 100)`, [A.assignmentId]));
    await denied(db.as(w.stranger, `select public.score_and_release($1, 100)`, [A.assignmentId]));
    await denied(db.as(A.primary, `select public.score_and_release($1, 100)`, [uuid()]));
    // A new, unsubmitted assignment can't be released.
    const test = uuid();
    const asg = uuid();
    await db.as(A.parent, `insert into public.tests (id, family_id, grade, pack_id, topic_ids, questions) values ($1, $2, 5, 'g5.math', '{}', '[]')`, [test, A.id]);
    await db.as(A.parent, `insert into public.test_assignments (id, test_id, child_id, family_id) values ($1, $2, $3, $4)`, [asg, test, A.child1, A.id]);
    await denied(db.as(A.parent, `select public.score_and_release($1, 90)`, [asg]));
  });

  it('a parent releases once with the score; then the device sees the score, note and key', async () => {
    const { db, A, B } = w;
    await db.as(A.parent, `select public.score_and_release($1, 85, $2)`, [A.assignmentId, '  כל הכבוד!  ']);
    const [t] = await db.as<{ released: boolean; score: number; note: string }>(A.device, `select released, score, note from public.device_tests() where assignment_id = $1`, [A.assignmentId]);
    expect(t).toEqual({ released: true, score: 85, note: 'כל הכבוד!' });
    expect(await db.as(A.device, `select answers from public.device_released_keys()`)).toEqual([{ answers: ['3/4'] }]);
    // Released once: no second release, and another family's device sees nothing.
    await denied(db.as(A.primary, `select public.score_and_release($1, 100)`, [A.assignmentId]));
    expect(await db.as(B.device, `select * from public.device_released_keys()`)).toEqual([]);
    const [{ anon }] = await db.owner<{ anon: boolean }>(
      `select has_function_privilege('anon', 'public.score_and_release(uuid, int, text)', 'execute') or has_function_privilege('anon', 'public.device_released_keys()', 'execute') as anon`,
    );
    expect(anon).toBe(false);
  });
});
