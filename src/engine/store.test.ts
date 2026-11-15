import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_V1_KEY, BACKUP_V2_KEY, childProgress, isUuid, migrate, migrateWithIds, remapIds } from './store';

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

// Data as saved by data version 2 (curriculum packs, two children).
export const V2 = {
  version: 2,
  parentPin: '1234',
  sound: false,
  profiles: [
    { id: 'a1b2c3d4', name: 'דנה', avatar: '🦊', createdAt: 1, theme: 'darkfocus', grade: 5 },
    { id: 'z9y8x7w6', name: 'נועם', avatar: '🐢', createdAt: 2, grade: 4 },
  ],
  progress: {
    a1b2c3d4: {
      stars: 130,
      streakDays: 4,
      lastDay: '2026-11-14',
      daily: { '2026-11-13': 12, '2026-11-14': 8 }, // the streak is longer than the daily list shows
      sessions: 9,
      topics: { 'g5.math.average': { level: 3, runCorrect: 2, runWrong: 0, attempts: 30, firstTry: 25, secondTry: 3, byLevel: [5, 5, 4], lastAt: 50 } },
      mistakes: [{ at: 7, topicId: 'g5.math.average', prompt: 'p', given: 'g', correct: 'c' }],
      exams: [{ at: 8, topicIds: ['g5.math.average'], packId: 'g5.math', difficulty: 'easy', questions: 6, correct: 4, score: 67 }],
    },
    z9y8x7w6: { stars: 5, streakDays: 1, lastDay: '2026-11-01', daily: { '2026-11-01': 3 }, sessions: 1, topics: {}, mistakes: [] },
  },
};

describe('data migration', () => {
  it('moves version-1 progress to the g5.math pack and version 3 without losing anything', () => {
    const { data: d, idMap } = migrateWithIds(structuredClone(V1));
    expect(d.version).toBe(3);
    expect(isUuid(d.deviceId)).toBe(true);
    expect(d.parentPin).toBe('1234');
    expect(d.sync).toEqual({ outbox: [] });
    const id = idMap.kid1;
    expect(isUuid(id)).toBe(true);
    expect(d.profiles[0]).toMatchObject({ id, name: 'דנה', theme: 'darkfocus', grade: 5, updatedAt: 1, enrollment: {} });
    const c = childProgress(d, id);
    expect(c.stars).toBe(42);
    expect(c.sessions).toBe(2);
    expect(c.streakDays).toBe(3);
    expect(c.lastDay).toBe('2026-11-12');
    expect(c.daily).toEqual({ '2026-11-12': 20 });
    expect(Object.keys(d.progress[id].byDevice)).toEqual([d.deviceId]);
    expect(Object.keys(c.topics).sort()).toEqual(['g5.math.average', 'g5.math.fraction-meaning']);
    expect(c.topics['g5.math.fraction-meaning']).toMatchObject({ byLevel: [5, 4, 0], updatedAt: 5 });
    expect(c.mistakes[0].topicId).toBe('g5.math.average');
    expect(isUuid(c.mistakes[0].id)).toBe(true);
    expect(c.exams![0]).toMatchObject({ packId: 'g5.math', topicIds: ['g5.math.fraction-meaning', 'g5.math.average'], score: 67 });
    expect(isUuid(c.exams![0].id)).toBe(true);
  });

  it('upgrades version 2 to version 3: new ids, same totals, nothing lost', () => {
    const { data: d, idMap } = migrateWithIds(structuredClone(V2));
    expect(d.sound).toBe(false);
    expect(Object.keys(idMap).sort()).toEqual(['a1b2c3d4', 'z9y8x7w6']);
    expect(Object.keys(d.progress).sort()).toEqual(Object.values(idMap).sort());
    for (const [old, id] of Object.entries(idMap)) {
      const before = V2.progress[old as keyof typeof V2.progress];
      const c = childProgress(d, id);
      expect({ stars: c.stars, sessions: c.sessions, streakDays: c.streakDays, lastDay: c.lastDay, daily: c.daily }).toEqual({
        stars: before.stars,
        sessions: before.sessions,
        streakDays: before.streakDays,
        lastDay: before.lastDay,
        daily: before.daily,
      });
      expect(Object.keys(c.topics)).toEqual(Object.keys(before.topics));
      expect(c.mistakes.map(({ id: _id, ...m }) => m)).toEqual(before.mistakes);
      expect((c.exams ?? []).map(({ id: _id, ...e }) => e)).toEqual('exams' in before ? before.exams : []);
    }
    expect(d.profiles.map((p) => p.name)).toEqual(['דנה', 'נועם']);
  });

  it('leaves current data unchanged and is safe to run twice', () => {
    const once = migrate(structuredClone(V2));
    const twice = migrate(structuredClone(once));
    expect(twice).toEqual(once);
  });

  it('remaps old profile ids in a saved route', () => {
    const route = { s: 'home', packId: 'g5.math', nested: { pid: 'kid1', list: ['kid1', 'x'] } };
    expect(remapIds(route, { kid1: 'new-id' })).toEqual({ s: 'home', packId: 'g5.math', nested: { pid: 'new-id', list: ['new-id', 'x'] } });
  });
});

describe('loading old data from storage', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const fakeStorage = (init: Record<string, string>) => {
    const m = new Map(Object.entries(init));
    return {
      map: m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };

  it('keeps an untouched copy, migrates in place and moves the selected child to the new id', async () => {
    const raw = JSON.stringify(V2);
    const local = fakeStorage({ 'limud-app-v1': raw });
    const session = fakeStorage({ pid: 'a1b2c3d4' });
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    const store = await import('./store');
    expect(local.map.get(BACKUP_V2_KEY)).toBe(raw);
    expect(local.map.has(BACKUP_V1_KEY)).toBe(false);
    const saved = JSON.parse(local.map.get('limud-app-v1')!);
    expect(saved.version).toBe(3);
    const pid = session.map.get('pid')!;
    expect(isUuid(pid)).toBe(true);
    const d = store.getData();
    expect(d.profiles[0].id).toBe(pid);
    expect(store.childProgress(d, pid).stars).toBe(130);
    expect(store.childProgress(d, pid).streakDays).toBe(4);

    // a practice answer adds stars to this device's row; the total and streak follow
    store.actions.recordAnswer(pid, 'g5.math.average', 2, 'first');
    const after = store.childProgress(store.getData(), pid);
    expect(after.stars).toBe(132);
    expect(after.lastDay).toBe(store.today());
    expect(Object.keys(store.getData().progress[pid].byDevice)).toEqual([d.deviceId]);
  });

  it('keeps both copies when upgrading from version 1', async () => {
    const raw = JSON.stringify(V1);
    const local = fakeStorage({ 'limud-app-v1': raw });
    vi.stubGlobal('localStorage', local);
    await import('./store');
    expect(local.map.get(BACKUP_V1_KEY)).toBe(raw);
    expect(local.map.get(BACKUP_V2_KEY)).toBe(raw);
  });
});
