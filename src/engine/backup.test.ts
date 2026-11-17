import { describe, expect, it } from 'vitest';
import { BackupError, MAX_BACKUP_BYTES, backupJson, parseBackup } from './backup';
import { childProgress, migrate, type AppData } from './store';

const KID = '11111111-1111-4111-8111-111111111111';
const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const DATA: AppData = {
  version: 3,
  deviceId: DEVICE,
  parentPin: '4321',
  sound: true,
  sync: { lastPulledAt: 99, outbox: [] },
  profiles: [{ id: KID, name: 'דנה', avatar: '🦉', createdAt: 1, updatedAt: 2, theme: 'darkfocus', grade: 4, enrollment: {} }],
  progress: {
    [KID]: {
      byDevice: {
        [DEVICE]: { stars: 12, sessions: 3, daily: { '2026-11-14': 9 }, streakSeed: { lastDay: '2026-11-14', days: 2 } },
        [OTHER]: { stars: 5, sessions: 1, daily: { '2026-11-15': 2 } },
      },
      topics: { 'g4.math.place-value': { level: 2, runCorrect: 1, runWrong: 0, attempts: 9, firstTry: 7, secondTry: 1, byLevel: [5, 2, 0], lastAt: 5, updatedAt: 5 } },
      mistakes: [{ id: 'e0000000-0000-4000-8000-000000000001', at: 7, topicId: 'g4.math.place-value', prompt: 'p', given: 'g', correct: 'c' }],
      exams: [{ id: 'e0000000-0000-4000-8000-000000000002', at: 8, topicIds: ['g4.math.place-value'], packId: 'g4.math', difficulty: 'easy', questions: 5, correct: 4, score: 80 }],
      resetAt: 4,
    },
  },
  deleted: { '22222222-2222-4222-8222-222222222222': 3 },
};

const bad = (text: string) => expect(() => parseBackup(text)).toThrow(BackupError);
const withChange = (fn: (d: Record<string, unknown>) => void) => {
  const d = JSON.parse(backupJson(DATA));
  fn(d);
  return JSON.stringify(d);
};

describe('backup files', () => {
  it('never contain the parent PIN, the device id or the sync state', () => {
    const text = backupJson(DATA);
    expect(text).not.toContain('parentPin');
    expect(text).not.toContain('4321');
    expect(text).not.toContain('"deviceId"');
    expect(text).not.toContain('lastPulledAt');
  });

  it('round-trip version 3 without losing progress or the new fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { parentPin, deviceId, sync, ...rest } = DATA;
    const d = parseBackup(backupJson(DATA));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deviceId: _newDevice, sync: _sync, ...restored } = d;
    expect(restored).toEqual(rest);
    expect(childProgress(d, KID)).toMatchObject({ stars: 17, sessions: 4, streakDays: 3, lastDay: '2026-11-15' });
  });

  it('still accept version-1 files and migrate them', () => {
    const v1 = { version: 1, sound: true, profiles: [{ id: 'kid1', name: 'דנה', avatar: '🦊', createdAt: 1 }], progress: {} };
    const d = parseBackup(JSON.stringify(v1));
    expect(d.version).toBe(3);
    expect(d.profiles[0].grade).toBe(5);
  });

  it('still accept version-2 files and migrate them', () => {
    const v2 = {
      version: 2,
      sound: true,
      profiles: [{ id: 'kid1', name: 'דנה', avatar: '🦊', createdAt: 1, grade: 4 }],
      progress: {
        kid1: {
          stars: 12,
          streakDays: 2,
          lastDay: '2026-11-14',
          daily: { '2026-11-14': 9 },
          sessions: 3,
          topics: {},
          mistakes: [{ at: 7, topicId: 'g4.math.place-value', prompt: 'p', given: 'g', correct: 'c' }],
          exams: [{ at: 8, topicIds: ['g4.math.place-value'], packId: 'g4.math', difficulty: 'easy', questions: 5, correct: 4, score: 80 }],
        },
      },
    };
    const d = parseBackup(JSON.stringify(v2));
    expect(d.version).toBe(3);
    const id = d.profiles[0].id;
    expect(id).not.toBe('kid1');
    const c = childProgress(d, id);
    expect(c).toMatchObject({ stars: 12, streakDays: 2, sessions: 3, lastDay: '2026-11-14' });
    expect(c.mistakes[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(c.exams![0].score).toBe(80);
  });

  it('round-trip data migrated from version 2', () => {
    const d = migrate({
      version: 2,
      profiles: [{ id: 'k', name: 'דנה', avatar: '🦊', createdAt: 1, grade: 4 }],
      progress: { k: { stars: 3, streakDays: 1, lastDay: '2026-11-01', daily: { '2026-11-01': 1 }, sessions: 1, topics: {}, mistakes: [] } },
    });
    const back = parseBackup(backupJson(d));
    expect(back.profiles).toEqual(d.profiles);
    expect(back.progress).toEqual(d.progress);
  });

  it('drop unknown fields instead of storing them', () => {
    const d = parseBackup(withChange((x) => {
      x.evil = 'x';
      (x.profiles as Record<string, unknown>[])[0].extra = 'y';
    }));
    expect(d).not.toHaveProperty('evil');
    expect(d.profiles[0]).not.toHaveProperty('extra');
  });

  it('refuse broken, oversized or hostile files', () => {
    bad('not json');
    bad('x'.repeat(MAX_BACKUP_BYTES + 1));
    bad(JSON.stringify({ version: 4, profiles: [] }));
    bad(JSON.stringify({ version: 2, profiles: 'nope' }));
    bad('{"version":3,"profiles":[],"__proto__":{"polluted":true}}');
    bad(withChange((x) => ((x.profiles as Record<string, unknown>[])[0].name = 'x'.repeat(100))));
    bad(withChange((x) => ((x.profiles as Record<string, unknown>[])[0].id = '../etc')));
    bad(withChange((x) => ((x.profiles as Record<string, unknown>[])[0].id = 'kid1'))); // version 3 needs UUIDs
    type P = Record<string, Record<string, Record<string, Record<string, unknown>>>>;
    bad(withChange((x) => ((x.progress as P)[KID].byDevice[DEVICE].stars = -5)));
    bad(withChange((x) => ((x.progress as P)[KID].byDevice['not-a-device'] = { stars: 1, sessions: 1, daily: {} })));
    bad(withChange((x) => delete ((x.progress as P)[KID].mistakes as unknown as Record<string, unknown>[])[0].id));
    bad(withChange((x) => ((x.progress as Record<string, unknown>).someoneElse = (x.progress as Record<string, unknown>)[KID])));
    bad(withChange((x) => ((x.progress as P)[KID].topics['<script>'] = {})));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
