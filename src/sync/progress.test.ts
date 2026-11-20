import { describe, expect, it } from 'vitest';
import { deriveTotals, today, type StoredChild } from '../engine/store';
import { mergeChild } from '../engine/merge';
import { DAILY_DAYS, fromRows, toRows } from './progress';

const DEV = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const KID = '33333333-3333-4333-8333-333333333333';
const FAM = '44444444-4444-4444-8444-444444444444';
const NOW = Date.UTC(2026, 10, 20, 10);
const dayAgo = (n: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return today(d);
};

const child = (): StoredChild => ({
  byDevice: {
    [DEV]: { stars: 12, sessions: 4, daily: { [dayAgo(0)]: 20, [dayAgo(1)]: 7, [dayAgo(DAILY_DAYS + 5)]: 3 } },
    [OTHER]: { stars: 99, sessions: 9, daily: { [dayAgo(0)]: 50 } },
  },
  topics: {
    'g5.math.fractions': { level: 2, runCorrect: 1, runWrong: 0, attempts: 30, firstTry: 20, secondTry: 4, byLevel: [10, 10, 0], lastAt: NOW - 1000, updatedAt: NOW - 1000 },
    'g5.math.untouched': { level: 1, runCorrect: 0, runWrong: 0, attempts: 0, firstTry: 0, secondTry: 0, byLevel: [0, 0, 0], lastAt: 0, updatedAt: 0 },
    'Bad Id': { level: 1, runCorrect: 0, runWrong: 0, attempts: 3, firstTry: 1, secondTry: 0, byLevel: [1, 0, 0], lastAt: NOW, updatedAt: NOW },
  },
  mistakes: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', at: NOW - 500, topicId: 'g5.math.fractions', prompt: 'כמה זה חצי (1/2) ועוד רבע (1/4)?', given: '2/6', correct: '3/4' }],
  exams: [
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', at: NOW - 2000, topicIds: ['g5.math.fractions'], packId: 'g5.math', difficulty: 'medium', questions: 10, correct: 8, score: 80 },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', at: NOW, topicIds: [], packId: 'g5.math', difficulty: 'medium', questions: 10, correct: 11, score: 110 },
  ],
});

describe('progress upload rows (Stage 4)', () => {
  it('sends only this device’s counters, recent days, practised topics with valid ids, and valid tests', () => {
    const r = toRows(child(), KID, FAM, DEV, NOW);
    expect(r.totals).toMatchObject({ child_id: KID, device_id: DEV, family_id: FAM, stars: 12, sessions: 4 });
    expect(r.daily.map((d) => [d.day, d.answered]).sort()).toEqual([[dayAgo(0), 20], [dayAgo(1), 7]].sort());
    expect(r.topics.map((t) => t.topic_id)).toEqual(['g5.math.fractions']);
    expect(r.exams.map((e) => e.score)).toEqual([80]);
    expect(r.mistakes).toHaveLength(1);
    for (const rows of [r.daily, r.topics, r.exams, r.mistakes]) for (const x of rows) expect(x).toMatchObject({ child_id: KID, family_id: FAM });
  });

  it('reads back into the app’s shape (what the parent report shows)', () => {
    const r = toRows(child(), KID, FAM, DEV, NOW);
    const back = fromRows({ totals: [r.totals], daily: r.daily, topics: r.topics, exams: r.exams, mistakes: r.mistakes });
    expect(back.byDevice[DEV]).toEqual({ stars: 12, sessions: 4, daily: { [dayAgo(0)]: 20, [dayAgo(1)]: 7 } });
    expect(back.topics['g5.math.fractions']).toEqual(child().topics['g5.math.fractions']);
    expect(back.exams?.[0]).toEqual(child().exams?.[0]);
    expect(back.mistakes).toEqual(child().mistakes);
  });

  it('merged with a parent’s restored copy of the same device, nothing counts twice', () => {
    const local = child();
    const r = toRows(local, KID, FAM, DEV, NOW);
    const remote = fromRows({ totals: [r.totals], daily: r.daily, topics: r.topics, exams: r.exams, mistakes: r.mistakes });
    const merged = mergeChild(local, remote);
    expect(deriveTotals(merged).stars).toBe(12 + 99);
    expect(deriveTotals(merged).daily[dayAgo(0)]).toBe(20 + 50);
    expect(merged.mistakes).toHaveLength(1);
    expect(merged.exams?.filter((e) => e.score === 80)).toHaveLength(1);
  });

  it('cuts text to the server’s limits instead of failing the upload', () => {
    const c = child();
    c.mistakes[0] = { ...c.mistakes[0], prompt: 'א'.repeat(5000), given: 'ב'.repeat(2000) };
    const [m] = toRows(c, KID, FAM, DEV, NOW).mistakes;
    expect(m.prompt.length).toBe(4000);
    expect(m.given.length).toBe(1000);
  });
});
