import { describe, expect, it } from 'vitest';
import { MAX_MISTAKES, mergeFamily, mergeInto, mergeTopic } from './merge';
import { childProgress, migrate, type AppData, type Mistake, type StoredChild, type TopicProgress } from './store';

const KID = '11111111-1111-4111-8111-111111111111';
const PHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TABLET = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LAPTOP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const topic = (t: Partial<TopicProgress>): TopicProgress => ({
  level: 1,
  runCorrect: 0,
  runWrong: 0,
  attempts: 0,
  firstTry: 0,
  secondTry: 0,
  byLevel: [0, 0, 0],
  lastAt: 0,
  updatedAt: 0,
  ...t,
});
const mistake = (n: number): Mistake => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  at: n,
  topicId: 'g5.math.average',
  prompt: `q${n}`,
  given: 'g',
  correct: 'c',
});

/** The same family, as one device sees it. */
function device(deviceId: string, child: StoredChild, profile: Partial<AppData['profiles'][0]> = {}): AppData {
  return {
    version: 3,
    deviceId,
    sound: true,
    sync: { outbox: [] },
    profiles: [{ id: KID, name: 'דנה', avatar: '🦊', createdAt: 1, updatedAt: 1, grade: 5, enrollment: {}, ...profile }],
    progress: { [KID]: child },
    deleted: {},
  };
}

// Both devices start from the same synced state (the phone's stars from before), then go offline.
const shared = { stars: 10, sessions: 1, daily: { '2026-11-10': 4 } };
const phone = device(
  PHONE,
  {
    byDevice: { [PHONE]: { stars: 25, sessions: 3, daily: { '2026-11-10': 4, '2026-11-11': 6, '2026-11-12': 2 } } },
    topics: {
      'g5.math.average': topic({ level: 2, runCorrect: 1, attempts: 20, firstTry: 15, byLevel: [5, 3, 0], lastAt: 300, updatedAt: 300 }),
      'g5.math.fractions': topic({ attempts: 4, firstTry: 2, byLevel: [2, 0, 0], lastAt: 100, updatedAt: 100 }),
    },
    mistakes: [mistake(3), mistake(1)],
    exams: [{ id: 'e0000000-0000-4000-8000-000000000001', at: 50, topicIds: ['g5.math.average'], packId: 'g5.math', difficulty: 'easy', questions: 5, correct: 5, score: 100 }],
  },
  { avatar: '🐯', updatedAt: 500 }, // the child changed the avatar on the phone
);
const tablet = device(
  TABLET,
  {
    byDevice: {
      [PHONE]: shared, // an older copy of the phone's row
      [TABLET]: { stars: 7, sessions: 1, daily: { '2026-11-13': 5, '2026-11-14': 3 } },
    },
    topics: {
      'g5.math.average': topic({ level: 3, runCorrect: 0, runWrong: 1, attempts: 18, firstTry: 16, byLevel: [5, 5, 1], lastAt: 400, updatedAt: 400 }),
    },
    mistakes: [mistake(2), mistake(1)],
    exams: [],
  },
  { name: 'דנוש', updatedAt: 400 }, // the parent renamed the child earlier
);
const laptop = device(LAPTOP, {
  byDevice: { [LAPTOP]: { stars: 4, sessions: 2, daily: { '2026-11-15': 1 } } },
  topics: { 'g5.math.average': topic({ level: 1, attempts: 25, firstTry: 10, byLevel: [4, 0, 0], lastAt: 200, updatedAt: 200 }) },
  mistakes: [mistake(4)],
});

const fam = (d: Pick<AppData, 'profiles' | 'progress' | 'deleted'>) => ({ profiles: d.profiles, progress: d.progress, deleted: d.deleted });
const m = mergeFamily;

describe('merging two devices', () => {
  const merged = mergeInto(phone, tablet);
  const c = childProgress(merged, KID);

  it('sums stars and sessions over devices, counting each device once', () => {
    expect(c.stars).toBe(25 + 7);
    expect(c.sessions).toBe(3 + 1);
    expect(c.daily).toEqual({ '2026-11-10': 4, '2026-11-11': 6, '2026-11-12': 2, '2026-11-13': 5, '2026-11-14': 3 });
  });

  it('computes the streak over the active days of both devices', () => {
    expect(childProgress(phone, KID).streakDays).toBe(3);
    expect(childProgress(tablet, KID).streakDays).toBe(2);
    expect(c.streakDays).toBe(5);
    expect(c.lastDay).toBe('2026-11-14');
  });

  it('takes the newest profile fields', () => {
    expect(merged.profiles).toEqual([phone.profiles[0]]);
  });

  it('keeps max counters and the newest level for topic progress', () => {
    expect(c.topics['g5.math.average']).toEqual(
      topic({ level: 3, runCorrect: 0, runWrong: 1, attempts: 20, firstTry: 16, byLevel: [5, 5, 1], lastAt: 400, updatedAt: 400 }),
    );
    expect(c.topics['g5.math.fractions']).toEqual(phone.progress[KID].topics['g5.math.fractions']);
  });

  it('unions mistakes and exams by id, newest first', () => {
    expect(c.mistakes.map((x) => x.at)).toEqual([3, 2, 1]);
    expect(c.exams).toHaveLength(1);
  });

  it('keeps this device’s own settings', () => {
    expect(merged.deviceId).toBe(PHONE);
    expect(mergeInto(tablet, phone).deviceId).toBe(TABLET);
  });

  it('trims mistakes to the newest 60, as the device keeps them', () => {
    const many = (from: number) => Array.from({ length: 150 }, (_, i) => mistake(from + i));
    const a = device(PHONE, { byDevice: {}, topics: {}, mistakes: many(0) });
    const b = device(TABLET, { byDevice: {}, topics: {}, mistakes: many(150) });
    const out = m(a, b).progress[KID].mistakes;
    expect(out).toHaveLength(MAX_MISTAKES);
    expect(MAX_MISTAKES).toBe(60);
    expect(out[0].at).toBe(299);
    expect(out[out.length - 1].at).toBe(240);
  });
});

describe('merge laws', () => {
  const docs = { phone, tablet, laptop };

  it('is idempotent: A ∪ A = A', () => {
    for (const d of Object.values(docs)) expect(m(d, d)).toEqual(fam(d));
    const ab = m(phone, tablet);
    expect(m(ab, ab)).toEqual(ab);
    expect(m(ab, tablet)).toEqual(ab); // merging the same data again changes nothing
  });

  it('is order-independent: A ∪ B = B ∪ A', () => {
    for (const a of Object.values(docs)) for (const b of Object.values(docs)) expect(m(a, b)).toEqual(m(b, a));
  });

  it('is associative: (A ∪ B) ∪ C = A ∪ (B ∪ C)', () => {
    expect(m(m(phone, tablet), laptop)).toEqual(m(phone, m(tablet, laptop)));
    expect(m(m(laptop, phone), tablet)).toEqual(m(laptop, m(phone, tablet)));
    expect(childProgress({ ...phone, ...m(m(phone, tablet), laptop) }, KID).stars).toBe(25 + 7 + 4);
  });

  it('breaks ties without depending on argument order', () => {
    const a = topic({ level: 2, runCorrect: 1, lastAt: 9, attempts: 3 });
    const b = topic({ level: 1, runWrong: 1, lastAt: 9, attempts: 5 });
    expect(mergeTopic(a, b)).toEqual(mergeTopic(b, a));
    const p1 = device(PHONE, { byDevice: {}, topics: {}, mistakes: [] }, { avatar: '🐯', updatedAt: 9 });
    const p2 = device(TABLET, { byDevice: {}, topics: {}, mistakes: [] }, { avatar: '🦉', updatedAt: 9 });
    expect(m(p1, p2)).toEqual(m(p2, p1));
  });

  it('merges data migrated from version 2 on two phones without double counting', () => {
    const v2 = { version: 2, profiles: [{ id: 'kid', name: 'דנה', avatar: '🦊', createdAt: 1, grade: 5 }], progress: { kid: { stars: 9, streakDays: 1, lastDay: '2026-11-01', daily: { '2026-11-01': 3 }, sessions: 1, topics: {}, mistakes: [] } } };
    const a = migrate(v2);
    const again = { ...a, deviceId: TABLET };
    const pid = a.profiles[0].id;
    expect(childProgress(mergeInto(again, a), pid).stars).toBe(9);
  });
});

describe('deletions and resets survive a merge (tombstones)', () => {
  const KID2 = '22222222-2222-4222-8222-222222222222';
  const second = (d: AppData): AppData => ({
    ...d,
    profiles: [...d.profiles, { id: KID2, name: 'נועם', avatar: '🐢', createdAt: 2, updatedAt: 2, grade: 2, enrollment: {} }],
    progress: { ...d.progress, [KID2]: { byDevice: { [d.deviceId]: { stars: 3, sessions: 1, daily: {} } }, topics: {}, mistakes: [] } },
  });
  // The phone deleted the second child; the tablet still has it.
  const withBoth = second(tablet);
  const deletedHere: AppData = { ...phone, deleted: { [KID2]: 1000 } };

  it('a deleted child does not come back from a device that still has it', () => {
    for (const out of [m(deletedHere, withBoth), m(withBoth, deletedHere)]) {
      expect(out.profiles.map((p) => p.id)).toEqual([KID]);
      expect(Object.keys(out.progress)).toEqual([KID]);
      expect(out.deleted).toEqual({ [KID2]: 1000 });
    }
  });

  // The phone reset the child's progress at 350; the tablet hasn't seen the reset.
  const resetPhone = device(PHONE, {
    byDevice: { [PHONE]: { stars: 2, sessions: 1, daily: { '2026-11-16': 1 } } },
    topics: { 'g5.math.average': topic({ attempts: 1, firstTry: 1, byLevel: [1, 0, 0], lastAt: 360, updatedAt: 360 }) },
    mistakes: [mistake(370)],
    resetAt: 350,
  });
  const stale = device(TABLET, {
    ...tablet.progress[KID],
    mistakes: [mistake(400), mistake(2)], // one from after the reset, one from before
    exams: [{ id: 'e0000000-0000-4000-8000-000000000009', at: 380, topicIds: ['g5.math.average'], packId: 'g5.math', difficulty: 'easy', questions: 5, correct: 3, score: 60 }],
  });

  it('a reset hides the older copy’s counters but keeps its records from after the reset', () => {
    const c = m(resetPhone, stale).progress[KID];
    expect(c.resetAt).toBe(350);
    expect(c.byDevice).toEqual(resetPhone.progress[KID].byDevice);
    expect(c.topics).toEqual(resetPhone.progress[KID].topics);
    expect(c.mistakes.map((x) => x.at)).toEqual([400, 370]);
    expect(c.exams?.map((x) => x.at)).toEqual([380]);
    expect(childProgress({ ...resetPhone, ...m(resetPhone, stale) }, KID).stars).toBe(2);
  });

  it('keeps the merge laws with deletions and resets', () => {
    const docs = [phone, tablet, laptop, deletedHere, withBoth, resetPhone, stale];
    for (const a of docs) {
      expect(m(a, a)).toEqual(fam(a));
      for (const b of docs) {
        expect(m(a, b)).toEqual(m(b, a));
        for (const c of docs) expect(m(m(a, b), c)).toEqual(m(a, m(b, c)));
      }
    }
  });
});
