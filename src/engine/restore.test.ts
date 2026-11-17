import { describe, expect, it } from 'vitest';
import { backupJson, readBackup } from './backup';
import { childProgress, restoreInto, type AppData } from './store';

const KID = '11111111-1111-4111-8111-111111111111';
const KID2 = '22222222-2222-4222-8222-222222222222';
const PHONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mistake = (n: number) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, at: n, topicId: 'g5.math.average', prompt: `q${n}`, given: 'g', correct: 'c' });
const kid = (id: string, name: string) => ({ id, name, avatar: '🦊', createdAt: 1, updatedAt: 1, grade: 5, enrollment: {} });

// The day the backup was made: one child, 10 stars, one mistake.
const atBackup: AppData = {
  version: 3,
  deviceId: PHONE,
  parentPin: '1234',
  sound: true,
  sync: { outbox: [] },
  profiles: [kid(KID, 'דנה')],
  progress: { [KID]: { byDevice: { [PHONE]: { stars: 10, sessions: 2, daily: { '2026-11-10': 5 } } }, topics: {}, mistakes: [mistake(10)] } },
  deleted: {},
};
const file = backupJson(atBackup);

describe('restoring a backup merges it in', () => {
  it('keeps what was added on this device since the backup', () => {
    const now: AppData = {
      ...atBackup,
      sound: false,
      profiles: [kid(KID, 'דנה'), kid(KID2, 'נועם')],
      progress: {
        [KID]: { byDevice: { [PHONE]: { stars: 14, sessions: 3, daily: { '2026-11-10': 5, '2026-11-11': 2 } } }, topics: {}, mistakes: [mistake(20), mistake(10)] },
        [KID2]: { byDevice: {}, topics: {}, mistakes: [] },
      },
    };
    const { data, merge } = readBackup(file);
    expect(merge).toBe(true);
    const out = restoreInto(now, data, merge);
    expect(out.profiles.map((p) => p.id)).toEqual([KID, KID2]);
    expect(childProgress(out, KID).stars).toBe(14);
    expect(out.progress[KID].mistakes.map((x) => x.at)).toEqual([20, 10]);
    expect(out).toMatchObject({ deviceId: PHONE, parentPin: '1234', sound: false });
  });

  it('brings back a child that was deleted on this device', () => {
    const now: AppData = { ...atBackup, profiles: [], progress: {}, deleted: { [KID]: 50 } };
    const out = restoreInto(now, readBackup(file).data, true);
    expect(out.profiles.map((p) => p.id)).toEqual([KID]);
    expect(childProgress(out, KID).stars).toBe(10);
    expect(out.deleted).toEqual({});
  });

  it('undoes a reset made after the backup, keeping what came after the reset', () => {
    const now: AppData = {
      ...atBackup,
      progress: { [KID]: { byDevice: { [PHONE]: { stars: 1, sessions: 1, daily: {} } }, topics: {}, mistakes: [mistake(60)], resetAt: 50 } },
    };
    const out = restoreInto(now, readBackup(file).data, true);
    expect(out.progress[KID].resetAt).toBeUndefined();
    expect(childProgress(out, KID).stars).toBe(10); // the same device's row: the larger copy
    expect(out.progress[KID].mistakes.map((x) => x.at)).toEqual([60, 10]);
  });

  it('replaces the data with an older-format file', () => {
    const v2 = { version: 2, profiles: [{ id: 'kid', name: 'דנה', avatar: '🦊', createdAt: 1, grade: 5 }], progress: {} };
    const { data, merge } = readBackup(JSON.stringify(v2));
    expect(merge).toBe(false);
    const out = restoreInto({ ...atBackup, deleted: { [KID2]: 5 } }, data, merge);
    expect(out.profiles.map((p) => p.name)).toEqual(['דנה']);
    expect(out.profiles[0].id).not.toBe(KID);
    expect(out.deleted).toEqual({ [KID2]: 5 });
    expect(out.parentPin).toBe('1234');
  });

  it('rejects a bad deleted list', () => {
    const bad = JSON.parse(file);
    bad.deleted = { 'not-a-uuid': 1 };
    expect(() => readBackup(JSON.stringify(bad))).toThrow();
  });
});
