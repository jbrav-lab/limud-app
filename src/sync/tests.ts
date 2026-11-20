import type { ExamQuestion } from '../engine/exam';
import { freeze, scoreFrozen, standIn, type FrozenKey, type FrozenQuestion, type SubmittedAnswer } from '../engine/frozen';
import { actions, getData } from '../engine/store';
import { describeCorrect, describeUser } from '../components/AnswerInput';
import { DEVICE_AUTH_KEY, deviceClient, parentClient, syncEnabled } from './client';
import { SyncError, familyChildren, type Family } from './family';

/**
 * Parent-made tests (owner, 2026-11-20). The parent's phone generates and freezes the questions,
 * keeps the answer key apart (security file §12), scores submitted answers with the app's own checker
 * and releases the score. The child's device downloads only the questions, saves answers locally at
 * once, uploads them when it can, and gets the key after release.
 */

const fail = (): never => {
  throw new SyncError('משהו השתבש. בדקו את החיבור לאינטרנט ונסו שוב.');
};

// --- Parent -----------------------------------------------------------------------------------------

/** The family a child belongs to, for the signed-in parent (null if the child isn't in their families). */
export async function familyOfChild(childId: string): Promise<string | null> {
  const c = await parentClient();
  const { data, error } = await c.rpc('my_families');
  if (error) fail();
  for (const f of (data ?? []) as Family[]) if ((await familyChildren(f.family_id)).some((k) => k.id === childId)) return f.family_id;
  return null;
}

/** Freeze a generated test and assign it to one child. */
export async function createParentTest(p: { familyId: string; childId: string; grade: number; packId: string; topicIds: string[]; exam: ExamQuestion[] }) {
  const c = await parentClient();
  const { questions, keys } = freeze(p.exam);
  const testId = crypto.randomUUID();
  const steps = [
    () => c.from('tests').insert({ id: testId, family_id: p.familyId, grade: p.grade, pack_id: p.packId, topic_ids: p.topicIds, questions }),
    () => c.from('test_answer_keys').insert({ test_id: testId, family_id: p.familyId, answers: keys }),
    () => c.from('test_assignments').insert({ id: crypto.randomUUID(), test_id: testId, child_id: p.childId, family_id: p.familyId }),
  ];
  for (const step of steps) {
    const { error } = await step();
    if (error) {
      await c.from('tests').delete().eq('id', testId); // don't leave half a test behind
      fail();
    }
  }
}

export interface ParentTestRow {
  id: string;
  testId: string;
  createdAt: number;
  packId: string;
  topicIds: string[];
  questions: number;
  submittedAt: number | null;
  releasedAt: number | null;
  score: number | null;
  note: string | null;
}

/** The tests assigned to a child, newest first. */
export async function childTests(childId: string): Promise<ParentTestRow[]> {
  const c = await parentClient();
  const { data, error } = await c
    .from('test_assignments')
    .select('id, submitted_at, released_at, score, note, tests(id, created_at, pack_id, topic_ids, questions)')
    .eq('child_id', childId);
  if (error) fail();
  type Raw = {
    id: string;
    submitted_at: string | null;
    released_at: string | null;
    score: number | null;
    note: string | null;
    tests: { id: string; created_at: string; pack_id: string; topic_ids: string[]; questions: unknown[] } | null;
  };
  const t = (s: string | null) => (s ? Date.parse(s) : null);
  return ((data ?? []) as unknown as Raw[])
    .filter((r) => r.tests)
    .map((r) => ({
      id: r.id,
      testId: r.tests!.id,
      createdAt: Date.parse(r.tests!.created_at),
      packId: r.tests!.pack_id,
      topicIds: r.tests!.topic_ids,
      questions: r.tests!.questions.length,
      submittedAt: t(r.submitted_at),
      releasedAt: t(r.released_at),
      score: r.score,
      note: r.note,
    }))
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

export interface Review {
  questions: FrozenQuestion[];
  keys: FrozenKey[];
  answers: SubmittedAnswer[];
}

/** A submitted test with its key and the child's answers, to score and review on the parent's phone. */
export async function loadReview(row: ParentTestRow): Promise<Review> {
  const c = await parentClient();
  const [t, k, a] = await Promise.all([
    c.from('tests').select('questions').eq('id', row.testId).single(),
    c.from('test_answer_keys').select('answers').eq('test_id', row.testId).single(),
    c.from('test_assignments').select('answers').eq('id', row.id).single(),
  ]);
  if (t.error || k.error || a.error) fail();
  return {
    questions: t.data!.questions as FrozenQuestion[],
    keys: k.data!.answers as FrozenKey[],
    answers: (a.data!.answers ?? []) as SubmittedAnswer[],
  };
}

export async function releaseTest(assignmentId: string, score: number, note: string) {
  const c = await parentClient();
  const { error } = await c.rpc('score_and_release', { p_assignment: assignmentId, p_score: score, p_note: note.trim() || null });
  if (error) fail();
}

/** Delete a test (and its assignment) that hasn't been submitted yet. */
export async function deleteTest(testId: string) {
  const c = await parentClient();
  const { error } = await c.from('tests').delete().eq('id', testId);
  if (error) fail();
}

// --- Child's device ---------------------------------------------------------------------------------

export interface DeviceTest {
  assignmentId: string;
  testId: string;
  childId: string;
  questions: FrozenQuestion[];
  submitted: boolean;
  released: boolean;
  score: number | null;
  note: string | null;
  /** The key, only after release. */
  keys?: FrozenKey[];
}

/** Stored on the device (data inventory, security file §3): the child's tests (no keys before release). */
export const TESTS_KEY = 'limud-parent-tests';
/** Stored on the device: answers in progress and submitted answers not yet uploaded. */
export const ANSWERS_KEY = 'limud-test-answers';

type Saved = Record<string, { answers: SubmittedAnswer[]; done?: boolean; sent?: boolean; seen?: boolean }>;
const read = <T,>(k: string, empty: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? empty;
  } catch {
    return empty;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the answers stay in memory for this run */
  }
};

const listeners = new Set<() => void>();
export function onTestsChange(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
const changed = () => listeners.forEach((l) => l());

export const cachedTests = (): DeviceTest[] => read<DeviceTest[]>(TESTS_KEY, []);
export const savedAnswers = (assignmentId: string) => read<Saved>(ANSWERS_KEY, {})[assignmentId];

export function saveAnswers(assignmentId: string, answers: SubmittedAnswer[], done = false) {
  const all = read<Saved>(ANSWERS_KEY, {});
  all[assignmentId] = { ...all[assignmentId], answers, ...(done ? { done: true } : {}) };
  write(ANSWERS_KEY, all);
  changed();
}

/** The child opened the released results (the banner then stops showing them). */
export function markSeen(assignmentId: string) {
  const all = read<Saved>(ANSWERS_KEY, {});
  if (all[assignmentId]?.seen) return;
  all[assignmentId] = { ...(all[assignmentId] ?? { answers: [] }), seen: true };
  write(ANSWERS_KEY, all);
  changed();
}

export const devicePaired = () => {
  try {
    return syncEnabled() && Boolean(localStorage.getItem(DEVICE_AUTH_KEY));
  } catch {
    return false;
  }
};

/** Upload answers of finished tests that haven't reached the server yet. */
async function sendFinished(c: Awaited<ReturnType<typeof deviceClient>>) {
  const all = read<Saved>(ANSWERS_KEY, {});
  for (const [id, s] of Object.entries(all)) {
    if (!s.done || s.sent) continue;
    const { error } = await c.rpc('submit_test_answers', { p_assignment: id, p_answers: s.answers });
    // Refused means it was already submitted (for example from an earlier, interrupted try).
    if (!error || error.code === '42501') all[id] = { ...s, sent: true };
  }
  write(ANSWERS_KEY, all);
}

/** Refresh this device's tests from the server (and send finished answers first). Quiet when offline. */
export async function refreshDeviceTests(): Promise<boolean> {
  if (!devicePaired()) return false;
  try {
    const c = await deviceClient();
    await sendFinished(c);
    const [t, k] = await Promise.all([c.rpc('device_tests'), c.rpc('device_released_keys')]);
    if (t.error || k.error) return false;
    const keys = new Map(((k.data ?? []) as { assignment_id: string; answers: FrozenKey[] }[]).map((x) => [x.assignment_id, x.answers]));
    type Raw = { assignment_id: string; test_id: string; child_id: string; questions: FrozenQuestion[]; submitted_at: string | null; released: boolean; score: number | null; note: string | null };
    const tests: DeviceTest[] = ((t.data ?? []) as Raw[]).map((r) => ({
      assignmentId: r.assignment_id,
      testId: r.test_id,
      childId: r.child_id,
      questions: r.questions,
      submitted: Boolean(r.submitted_at),
      released: r.released,
      score: r.score,
      note: r.note,
      ...(keys.has(r.assignment_id) ? { keys: keys.get(r.assignment_id) } : {}),
    }));
    write(TESTS_KEY, tests);
    // Answers of tests that no longer exist (deleted by a parent) aren't kept.
    const all = read<Saved>(ANSWERS_KEY, {});
    for (const id of Object.keys(all)) if (!tests.some((x) => x.assignmentId === id)) delete all[id];
    write(ANSWERS_KEY, all);
    recordReleased(tests);
    changed();
    return true;
  } catch {
    return false;
  }
}

/** A released test counts in the child's progress once (its record id is the assignment id). */
export const recordReleasedTests = () => recordReleased(cachedTests());
function recordReleased(tests: DeviceTest[]) {
  const d = getData();
  for (const t of tests) {
    if (!t.released || !t.keys || t.score === null) continue;
    if (!d.profiles.some((p) => p.id === t.childId) || d.progress[t.childId]?.exams?.some((e) => e.id === t.assignmentId)) continue;
    const answers = savedAnswers(t.assignmentId)?.answers ?? [];
    const { marks, correct } = scoreFrozen(t.questions, t.keys, answers);
    const topicIds = [...new Set(t.questions.map((q) => q.topicId))];
    actions.recordExam(
      t.childId,
      { id: t.assignmentId, packId: topicIds[0]?.split('.').slice(0, 2).join('.') ?? '', topicIds, difficulty: 'parent', questions: t.questions.length, correct, score: t.score },
      t.questions.map((q, i) => ({
        topicId: q.topicId,
        level: q.level,
        correct: marks[i].correct,
        mistake: marks[i].correct
          ? undefined
          : {
              prompt: q.prompt,
              expression: q.expression,
              given: marks[i].answered ? describeUser(answers[i]!, standIn(q.input)) : '—',
              correct: describeCorrect(t.keys![i].answer),
            },
      })),
    );
  }
}

/** Submit a finished test: saved on the device at once, uploaded now or at the next chance. */
export async function submitTest(assignmentId: string, answers: SubmittedAnswer[]) {
  saveAnswers(assignmentId, answers, true);
  await refreshDeviceTests();
}

let started = false;
/** On a paired device: refresh tests at start, when back online, and when the app comes to the front. */
export function startTestSync() {
  if (started || !devicePaired()) return;
  started = true;
  void refreshDeviceTests();
  addEventListener('online', () => void refreshDeviceTests());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshDeviceTests();
  });
}
