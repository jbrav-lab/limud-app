import type { AppData, DeviceCounters, ExamRecord, Mistake, Profile, StoredChild, TopicProgress } from './store';
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Pure merge functions for data from different devices (docs/sync-supabase-plan.md §4).
 *
 * Every merge here is idempotent (a ∪ a = a), order-independent (a ∪ b = b ∪ a) and associative
 * ((a ∪ b) ∪ c = a ∪ (b ∪ c)), so devices can merge in any order, any number of times, and agree.
 * Ties are broken by a fixed order on the values themselves, never by argument position.
 *
 * Not handled yet: deletes (a deleted child or a progress reset comes back from another device).
 * Those need tombstones, which arrive with the server (plan §4, last row).
 */

export const MAX_MERGED_MISTAKES = 200;

/** A fixed order on any two JSON values, used only to break ties. */
const key = (x: unknown) => JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? sortKeys(v) : v));
const sortKeys = (o: Record<string, unknown>) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const tieBreak = <T>(a: T, b: T): T => (key(a) >= key(b) ? a : b);

/** Union of two maps by key; entries on both sides are combined with `both`. */
function unionBy<T>(a: Record<string, T>, b: Record<string, T>, both: (x: T, y: T) => T): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = own(a, k) ? both(a[k], v) : v;
  return sortKeys(out) as Record<string, T>;
}

/** Profile: last writer wins by updatedAt. */
export function mergeProfile(a: Profile, b: Profile): Profile {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return tieBreak(a, b);
}

export function mergeProfiles(a: Profile[], b: Profile[]): Profile[] {
  const byId = unionBy(
    Object.fromEntries(a.map((p) => [p.id, p])),
    Object.fromEntries(b.map((p) => [p.id, p])),
    mergeProfile,
  );
  // Keep the order children were added in (createdAt), then id.
  return Object.values(byId).sort((x, y) => x.createdAt - y.createdAt || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

/**
 * Two copies of the same device's counter row. A device's counters only grow, so the later copy is the
 * larger one in every field: take the max per field (never the sum, so a row is never counted twice).
 */
export function mergeDeviceRow(a: DeviceCounters, b: DeviceCounters): DeviceCounters {
  const out: DeviceCounters = {
    stars: Math.max(a.stars, b.stars),
    sessions: Math.max(a.sessions, b.sessions),
    daily: unionBy(a.daily, b.daily, Math.max),
  };
  const seed = a.streakSeed && b.streakSeed ? tieBreak(a.streakSeed, b.streakSeed) : (a.streakSeed ?? b.streakSeed);
  if (seed) out.streakSeed = seed;
  return out;
}

/** Topic progress: counters take the max; level and runs come from the copy with the newest lastAt. */
export function mergeTopic(a: TopicProgress, b: TopicProgress): TopicProgress {
  const rank = (t: TopicProgress) => [t.lastAt, t.level, t.runCorrect, t.runWrong];
  const ra = rank(a);
  const rb = rank(b);
  const i = ra.findIndex((v, j) => v !== rb[j]);
  const newer = i < 0 || ra[i] > rb[i] ? a : b;
  return {
    level: newer.level,
    runCorrect: newer.runCorrect,
    runWrong: newer.runWrong,
    attempts: Math.max(a.attempts, b.attempts),
    firstTry: Math.max(a.firstTry, b.firstTry),
    secondTry: Math.max(a.secondTry, b.secondTry),
    byLevel: a.byLevel.map((v, j) => Math.max(v, b.byLevel[j])) as [number, number, number],
    lastAt: Math.max(a.lastAt, b.lastAt),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

/** Records that are never edited: union by id, newest first (ties by id), optionally trimmed. */
function unionRecords<T extends { id: string; at: number }>(a: T[], b: T[], max = Infinity): T[] {
  const byId = unionBy(
    Object.fromEntries(a.map((r) => [r.id, r])),
    Object.fromEntries(b.map((r) => [r.id, r])),
    tieBreak,
  );
  return Object.values(byId)
    .sort((x, y) => y.at - x.at || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
    .slice(0, max);
}

export const mergeMistakes = (a: Mistake[], b: Mistake[]) => unionRecords(a, b, MAX_MERGED_MISTAKES);
export const mergeExams = (a: ExamRecord[], b: ExamRecord[]) => unionRecords(a, b);

/** One child's progress from two devices. */
export function mergeChild(a: StoredChild, b: StoredChild): StoredChild {
  return {
    byDevice: unionBy(a.byDevice, b.byDevice, mergeDeviceRow),
    topics: unionBy(a.topics, b.topics, mergeTopic),
    mistakes: mergeMistakes(a.mistakes, b.mistakes),
    ...(a.exams || b.exams ? { exams: mergeExams(a.exams ?? [], b.exams ?? []) } : {}),
  };
}

/** The family's shared data (profiles and progress) from two documents. */
export function mergeFamily(a: Pick<AppData, 'profiles' | 'progress'>, b: Pick<AppData, 'profiles' | 'progress'>) {
  return { profiles: mergeProfiles(a.profiles, b.profiles), progress: unionBy(a.progress, b.progress, mergeChild) };
}

/**
 * Merge another device's document into this device's. Device-local settings (device id, PIN, sound,
 * sync state) stay as they are on this device.
 */
export function mergeInto(local: AppData, remote: Pick<AppData, 'profiles' | 'progress'>): AppData {
  return { ...local, ...mergeFamily(local, remote) };
}
