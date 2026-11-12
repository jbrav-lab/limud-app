import { describe, expect, it } from 'vitest';
import { migrate } from './store';

// Data exactly as saved by the first version of the app (grade-5 math only, un-namespaced ids).
const V1 = {
  version: 1,
  parentPin: '1234',
  sound: true,
  profiles: [{ id: 'kid1', name: 'דנה', avatar: '🦊', createdAt: 1, theme: 'darkfocus' }],
  progress: {
    kid1: {
      stars: 42,
      streakDays: 3,
      lastDay: '2026-11-12',
      daily: { '2026-11-12': 20 },
      sessions: 2,
      topics: {
        'fraction-meaning': { level: 2, runCorrect: 1, runWrong: 0, attempts: 12, firstTry: 9, secondTry: 2, byLevel: [5, 4, 0], lastAt: 5 },
        average: { level: 1, runCorrect: 0, runWrong: 1, attempts: 3, firstTry: 1, secondTry: 0, byLevel: [1, 0, 0], lastAt: 6 },
      },
      mistakes: [{ at: 7, topicId: 'average', prompt: 'p', given: 'g', correct: 'c' }],
      exams: [{ at: 8, topicIds: ['fraction-meaning', 'average'], difficulty: 'easy', questions: 6, correct: 4, score: 67 }],
    },
  },
};

describe('data migration', () => {
  it('moves version-1 progress to the g5.math pack without losing anything', () => {
    const d = migrate(structuredClone(V1));
    expect(d.version).toBe(2);
    expect(d.parentPin).toBe('1234');
    expect(d.profiles[0]).toMatchObject({ name: 'דנה', theme: 'darkfocus', grade: 5 });
    const c = d.progress.kid1;
    expect(c.stars).toBe(42);
    expect(Object.keys(c.topics).sort()).toEqual(['g5.math.average', 'g5.math.fraction-meaning']);
    expect(c.topics['g5.math.fraction-meaning'].byLevel).toEqual([5, 4, 0]);
    expect(c.mistakes[0].topicId).toBe('g5.math.average');
    expect(c.exams![0]).toMatchObject({ packId: 'g5.math', topicIds: ['g5.math.fraction-meaning', 'g5.math.average'], score: 67 });
  });

  it('leaves current data unchanged and is safe to run twice', () => {
    const once = migrate(structuredClone(V1));
    const twice = migrate(structuredClone(once));
    expect(twice).toEqual(once);
  });
});
