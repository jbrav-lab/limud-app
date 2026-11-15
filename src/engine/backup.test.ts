import { describe, expect, it } from 'vitest';
import { BackupError, MAX_BACKUP_BYTES, backupJson, parseBackup } from './backup';
import type { AppData } from './store';

const DATA: AppData = {
  version: 2,
  parentPin: '4321',
  sound: true,
  profiles: [{ id: 'kid1', name: 'דנה', avatar: '🦉', createdAt: 1, theme: 'darkfocus', grade: 4 }],
  progress: {
    kid1: {
      stars: 12,
      streakDays: 2,
      lastDay: '2026-11-14',
      daily: { '2026-11-14': 9 },
      sessions: 3,
      topics: { 'g4.math.place-value': { level: 2, runCorrect: 1, runWrong: 0, attempts: 9, firstTry: 7, secondTry: 1, byLevel: [5, 2, 0], lastAt: 5 } },
      mistakes: [{ at: 7, topicId: 'g4.math.place-value', prompt: 'p', given: 'g', correct: 'c' }],
      exams: [{ at: 8, topicIds: ['g4.math.place-value'], packId: 'g4.math', difficulty: 'easy', questions: 5, correct: 4, score: 80 }],
    },
  },
};

const bad = (text: string) => expect(() => parseBackup(text)).toThrow(BackupError);
const withChange = (fn: (d: Record<string, unknown>) => void) => {
  const d = JSON.parse(backupJson(DATA));
  fn(d);
  return JSON.stringify(d);
};

describe('backup files', () => {
  it('never contain the parent PIN', () => {
    const text = backupJson(DATA);
    expect(text).not.toContain('parentPin');
    expect(text).not.toContain('4321');
  });

  it('round-trip without losing progress', () => {
    const { parentPin, ...rest } = DATA;
    void parentPin;
    expect(parseBackup(backupJson(DATA))).toEqual(rest);
  });

  it('still accept version-1 files and migrate them', () => {
    const v1 = { version: 1, sound: true, profiles: [{ id: 'kid1', name: 'דנה', avatar: '🦊', createdAt: 1 }], progress: {} };
    const d = parseBackup(JSON.stringify(v1));
    expect(d.version).toBe(2);
    expect(d.profiles[0].grade).toBe(5);
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
    bad(JSON.stringify({ version: 3, profiles: [] }));
    bad(JSON.stringify({ version: 2, profiles: 'nope' }));
    bad('{"version":2,"profiles":[],"__proto__":{"polluted":true}}');
    bad(withChange((x) => ((x.profiles as Record<string, unknown>[])[0].name = 'x'.repeat(100))));
    bad(withChange((x) => ((x.profiles as Record<string, unknown>[])[0].id = '../etc')));
    bad(withChange((x) => ((x.progress as Record<string, Record<string, unknown>>).kid1.stars = -5)));
    bad(withChange((x) => ((x.progress as Record<string, unknown>).someoneElse = (x.progress as Record<string, unknown>).kid1)));
    bad(withChange((x) => ((x.progress as Record<string, Record<string, Record<string, unknown>>>).kid1.topics['<script>'] = {})));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
