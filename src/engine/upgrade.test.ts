import { describe, expect, it } from 'vitest';
import { backupJson, readBackup } from './backup';
import { DATA_VERSION, childProgress, isUuid, migrate, restoreInto, type AppData } from './store';

/**
 * "An upgrade never loses a child's progress."
 *
 * src/engine/fixtures/ holds stored data exactly as each released data version wrote it (plus data that
 * older app code wrote into newer data). Every fixture must come through the upgrade, a backup and a
 * restore on a fresh device with the same totals. A new data version must add its own fixture: the last
 * test fails until it does.
 */

type Totals = { stars: number; sessions: number; streakDays: number; lastDay: string; mistakes: number; exams: number; topics: number; attempts: number };
type Fixture = { about: string; data: unknown; expect: Record<string, Totals> };

const files = import.meta.glob<Fixture>('./fixtures/*.json', { eager: true, import: 'default' });
const fixtures = Object.entries(files).map(([path, f]) => [path.replace('./fixtures/', ''), f] as const);

function totals(d: AppData): Record<string, Totals> {
  return Object.fromEntries(
    d.profiles.map((p) => {
      const c = childProgress(d, p.id);
      return [
        p.name,
        {
          stars: c.stars,
          sessions: c.sessions,
          streakDays: c.streakDays,
          lastDay: c.lastDay,
          mistakes: c.mistakes.length,
          exams: (c.exams ?? []).length,
          topics: Object.keys(c.topics).length,
          attempts: Object.values(c.topics).reduce((s, t) => s + t.attempts, 0),
        },
      ];
    }),
  );
}

const freshDevice = (): AppData => ({ version: 3, deviceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', profiles: [], progress: {}, deleted: {}, sound: true, sync: { outbox: [] } });

describe('upgrades never lose progress (saved data from every version)', () => {
  it('has fixtures', () => expect(fixtures.length).toBeGreaterThanOrEqual(4));

  for (const [name, f] of fixtures) {
    describe(name, () => {
      const up = migrate(structuredClone(f.data));

      it('upgrades with every child’s totals unchanged', () => {
        expect(up.version).toBe(DATA_VERSION);
        expect(totals(up)).toEqual(f.expect);
      });

      it('gives every child, mistake and test a unique id', () => {
        for (const p of up.profiles) expect(isUuid(p.id)).toBe(true);
        expect(Object.keys(up.progress).sort()).toEqual(up.profiles.map((p) => p.id).sort());
        for (const c of Object.values(up.progress)) {
          const ids = [...c.mistakes, ...(c.exams ?? [])].map((r) => r.id);
          for (const id of ids) expect(isUuid(id)).toBe(true);
          expect(new Set(ids).size).toBe(ids.length);
        }
      });

      it('is unchanged by a second upgrade', () => {
        expect(migrate(structuredClone(up))).toEqual(up);
      });

      it('survives a backup and a restore on a fresh device', () => {
        const { data, merge } = readBackup(backupJson(up));
        expect(merge).toBe(true);
        const restored = restoreInto(freshDevice(), data, merge);
        expect(totals(restored)).toEqual(f.expect);
        expect(restored.deleted).toEqual(up.deleted);
      });

      it('survives restoring the same backup twice (merge, no double counting)', () => {
        const { data } = readBackup(backupJson(up));
        const once = restoreInto(freshDevice(), data, true);
        expect(totals(restoreInto(once, data, true))).toEqual(f.expect);
      });
    });
  }

  it(`has a fixture for the current data version (${DATA_VERSION})`, () => {
    expect(fixtures.map(([n]) => n)).toContain(`data-v${DATA_VERSION}.json`);
  });
});
