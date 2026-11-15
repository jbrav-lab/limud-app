import { useSyncExternalStore } from 'react';
import type { Level } from './types';

export interface Enrollment {
  school?: string;
  grade?: number;
  class?: string;
  year?: number;
}

export interface Profile {
  /** A UUID since data version 3 (older short ids are remapped by migrate()). */
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  /** Last change to this profile's fields (ms); a merge keeps the newest. */
  updatedAt: number;
  /** Color theme id from the design system (see src/themes.ts); missing = default theme. */
  theme?: string;
  /** School grade (2, 5, …): decides which subjects the child sees. */
  grade: number;
  /** Reserved for a possible class rollout. Always empty for now; no screen reads or writes it. */
  enrollment?: Enrollment;
}

export type ProfileFields = Pick<Profile, 'name' | 'avatar' | 'theme' | 'grade'>;

export interface TopicProgress {
  level: Level;
  runCorrect: number; // consecutive first-try correct at current level
  runWrong: number; // consecutive misses at current level
  attempts: number;
  firstTry: number; // answered correctly on first try
  secondTry: number; // answered correctly after a hint
  byLevel: [number, number, number]; // first-try correct per level
  lastAt: number;
  /** Last change (ms). */
  updatedAt: number;
}

export interface Mistake {
  id: string;
  at: number;
  topicId: string;
  prompt: string;
  expression?: string;
  given: string;
  correct: string;
}

/** One finished "הכנה למבחן" test. */
export interface ExamRecord {
  id: string;
  at: number;
  topicIds: string[];
  /** The subject pack the test was taken in, e.g. "g5.math". */
  packId: string;
  difficulty: string;
  questions: number;
  correct: number;
  score: number; // 0-100
}

/**
 * Counters one device wrote for one child. Each device only ever changes its own row, so rows from
 * different devices can be summed (stars, sessions, daily answers) without counting anything twice.
 */
export interface DeviceCounters {
  stars: number;
  sessions: number;
  daily: Record<string, number>; // questions answered per day (YYYY-MM-DD)
  /**
   * A streak carried over from data version 2, whose daily list may not cover every day of it:
   * the `days` days ending on `lastDay` count as active.
   */
  streakSeed?: { lastDay: string; days: number };
}

/** What is stored per child. Totals and the streak are derived (see childProgress). */
export interface StoredChild {
  byDevice: Record<string, DeviceCounters>;
  topics: Record<string, TopicProgress>;
  mistakes: Mistake[]; // newest first
  exams?: ExamRecord[]; // newest first
}

/** A child's progress as screens read it: stored data plus totals over all devices. */
export interface ChildProgress extends StoredChild {
  stars: number;
  sessions: number;
  streakDays: number;
  lastDay: string; // YYYY-MM-DD, '' if never active
  daily: Record<string, number>;
}

/** Changes waiting to be sent to a server. Not used until sync is built. */
export interface SyncState {
  lastPulledAt?: number;
  outbox: unknown[];
}

export interface AppData {
  /**
   * 1 = grade-5 math only (topic ids like "fractions"); 2 = curriculum packs (ids like "g5.math.fractions");
   * 3 = UUID profile ids, record ids, updatedAt and per-device counters (ready to merge between devices).
   */
  version: 3;
  /** This device's id (UUID), created once. Appears only as a key in byDevice. */
  deviceId: string;
  parentPin?: string;
  profiles: Profile[];
  progress: Record<string, StoredChild>;
  sound: boolean;
  sync: SyncState;
}

// The storage key stays the same across data versions: progress is migrated in place.
const KEY = 'limud-app-v1';
export const BACKUP_V1_KEY = 'limud-app-backup-before-v2';
export const BACKUP_V2_KEY = 'limud-app-backup-before-v3';

export const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
export const uuid = (): string => crypto.randomUUID();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (x: unknown): x is string => typeof x === 'string' && UUID_RE.test(x);

const empty = (): AppData => ({ version: 3, deviceId: uuid(), profiles: [], progress: {}, sound: true, sync: { outbox: [] } });

/** Data version 1 only had grade-5 math, so every old id belongs to the "g5.math" pack. */
const V1_PACK = 'g5.math';
const nsId = (id: string) => (id.includes('.') ? id : `${V1_PACK}.${id}`);

/* eslint-disable @typescript-eslint/no-explicit-any */
function v1to2(d: any) {
  d.progress = Object.fromEntries(
    Object.entries(d.progress ?? {}).map(([pid, c]) => {
      const child = c as any;
      return [
        pid,
        {
          ...child,
          topics: Object.fromEntries(Object.entries(child.topics ?? {}).map(([tid, tp]) => [nsId(tid), tp])),
          mistakes: (child.mistakes ?? []).map((m: any) => ({ ...m, topicId: nsId(m.topicId) })),
          exams: (child.exams ?? []).map((e: any) => ({ ...e, packId: e.packId ?? V1_PACK, topicIds: e.topicIds.map(nsId) })),
        },
      ];
    }),
  );
}

/** Version 2 → 3. Returns the map of old profile ids to their new UUIDs. */
function v2to3(d: any): Record<string, string> {
  const idMap: Record<string, string> = {};
  d.profiles = (d.profiles ?? []).map((p: any) => {
    const id = isUuid(p.id) ? p.id : uuid();
    if (id !== p.id) idMap[p.id] = id;
    return { ...p, id, updatedAt: p.updatedAt ?? p.createdAt ?? 0, enrollment: p.enrollment ?? {} };
  });
  const progress: Record<string, StoredChild> = {};
  for (const [pid, c] of Object.entries(d.progress ?? {})) {
    const child = c as any;
    const id = idMap[pid] ?? pid;
    const row: DeviceCounters = { stars: child.stars ?? 0, sessions: child.sessions ?? 0, daily: { ...(child.daily ?? {}) } };
    if (child.streakDays > 0 && child.lastDay) row.streakSeed = { lastDay: child.lastDay, days: child.streakDays };
    progress[id] = {
      byDevice: { [d.deviceId]: row },
      topics: Object.fromEntries(
        Object.entries(child.topics ?? {}).map(([tid, tp]: [string, any]) => [tid, { ...tp, updatedAt: tp.updatedAt ?? tp.lastAt ?? 0 }]),
      ),
      mistakes: (child.mistakes ?? []).map((m: any) => ({ ...m, id: isUuid(m.id) ? m.id : uuid() })),
      exams: (child.exams ?? []).map((e: any) => ({ ...e, id: isUuid(e.id) ? e.id : uuid() })),
    };
  }
  d.progress = progress;
  return idMap;
}

/**
 * Bring any saved data (current or older version) up to the current shape. Never drops progress.
 * idMap maps the profile ids that changed (old → new), so a saved route and the selected child can follow.
 */
export function migrateWithIds(raw: any): { data: AppData; idMap: Record<string, string> } {
  const from = raw?.version ?? 1;
  const d = structuredClone(raw ?? {});
  if (!isUuid(d.deviceId)) d.deviceId = uuid();
  if (from < 2) v1to2(d);
  d.profiles = (d.profiles ?? []).map((p: Profile) => ({ ...p, grade: p.grade ?? 5 }));
  const idMap = from < 3 ? v2to3(d) : {};
  const data: AppData = {
    version: 3,
    deviceId: d.deviceId,
    ...(d.parentPin !== undefined ? { parentPin: d.parentPin } : {}),
    profiles: d.profiles,
    progress: d.progress ?? {},
    sound: d.sound ?? true,
    sync: d.sync && Array.isArray(d.sync.outbox) ? d.sync : { outbox: [] },
  };
  return { data, idMap };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const migrate = (raw: unknown): AppData => migrateWithIds(raw).data;

/** Replace old profile ids anywhere in a saved route (any string value that is a key of idMap). */
export function remapIds<T>(x: T, idMap: Record<string, string>): T {
  if (typeof x === 'string') return (own(idMap, x) ? idMap[x] : x) as T;
  if (Array.isArray(x)) return x.map((v) => remapIds(v, idMap)) as T;
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, remapIds(v, idMap)])) as T;
  return x;
}

/** After a migration: the selected child (sessionStorage `pid`) and the saved route follow the new ids. */
function followIds(idMap: Record<string, string>) {
  if (!Object.keys(idMap).length) return;
  try {
    const pid = sessionStorage.getItem('pid');
    if (pid && own(idMap, pid)) sessionStorage.setItem('pid', idMap[pid]);
  } catch {
    /* ignore */
  }
  try {
    if (history.state) history.replaceState(remapIds(history.state, idMap), '');
  } catch {
    /* ignore */
  }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const from = parsed?.version ?? 1;
      if (from < 3) {
        // keep an untouched copy of the old data, just in case
        if (from < 2) localStorage.setItem(BACKUP_V1_KEY, raw);
        localStorage.setItem(BACKUP_V2_KEY, raw);
        const { data: m, idMap } = migrateWithIds(parsed);
        localStorage.setItem(KEY, JSON.stringify(m));
        followIds(idMap);
        return m;
      }
      const m = migrate(parsed);
      if (m.deviceId !== parsed.deviceId) localStorage.setItem(KEY, JSON.stringify(m));
      return m;
    }
  } catch {
    /* storage unavailable */
  }
  return empty();
}

let data: AppData = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function update(fn: (d: AppData) => AppData) {
  data = fn(data);
  save();
  listeners.forEach((l) => l());
}

export function useData(): AppData {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => data,
  );
}

export const getData = () => data;

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The day before a YYYY-MM-DD day, in the same format (local calendar, like today()). */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return today(new Date(y, m - 1, d - 1));
}

const emptyChild = (): StoredChild => ({ byDevice: {}, topics: {}, mistakes: [] });
export const emptyRow = (): DeviceCounters => ({ stars: 0, sessions: 0, daily: {} });

export const emptyTopic = (): TopicProgress => ({
  level: 1,
  runCorrect: 0,
  runWrong: 0,
  attempts: 0,
  firstTry: 0,
  secondTry: 0,
  byLevel: [0, 0, 0],
  lastAt: 0,
  updatedAt: 0,
});

/** Every day a child was active, on any device (the union of the daily lists and carried-over streaks). */
export function activeDays(c: StoredChild): Set<string> {
  const days = new Set<string>();
  for (const row of Object.values(c.byDevice)) {
    for (const k of Object.keys(row.daily)) days.add(k);
    if (row.streakSeed) {
      let day = row.streakSeed.lastDay;
      for (let i = 0; i < row.streakSeed.days; i++, day = dayBefore(day)) days.add(day);
    }
  }
  return days;
}

/** Totals over all devices, and the streak: consecutive active days ending on the last active day. */
export function deriveTotals(c: StoredChild): Pick<ChildProgress, 'stars' | 'sessions' | 'streakDays' | 'lastDay' | 'daily'> {
  let stars = 0;
  let sessions = 0;
  const daily: Record<string, number> = {};
  for (const row of Object.values(c.byDevice)) {
    stars += row.stars;
    sessions += row.sessions;
    for (const [k, n] of Object.entries(row.daily)) daily[k] = (daily[k] ?? 0) + n;
  }
  const days = activeDays(c);
  let lastDay = '';
  for (const k of days) if (k > lastDay) lastDay = k;
  let streakDays = 0;
  for (let day = lastDay; day && days.has(day); day = dayBefore(day)) streakDays++;
  return { stars, sessions, daily, streakDays, lastDay };
}

const views = new WeakMap<StoredChild, ChildProgress>();
const emptyView: ChildProgress = { ...emptyChild(), stars: 0, sessions: 0, streakDays: 0, lastDay: '', daily: {} };

/** A child's progress as screens read it, with totals over all devices (cached per stored object). */
export function childProgress(d: AppData, profileId: string): ChildProgress {
  const c = d.progress[profileId];
  if (!c) return emptyView;
  let v = views.get(c);
  if (!v) {
    v = { ...c, ...deriveTotals(c) };
    views.set(c, v);
  }
  return v;
}

export function topicProgress(d: AppData, profileId: string, topicId: string): TopicProgress {
  return d.progress[profileId]?.topics[topicId] ?? emptyTopic();
}

/** Mastery stars 0-3: 5 first-try answers at level 1 -> 1 star, then level 2 -> 2 stars, level 3 -> 3 stars. */
export const MASTERY_NEED = 5;
export function mastery(tp: TopicProgress): number {
  let m = 0;
  for (let i = 0; i < 3; i++) {
    if (tp.byLevel[i] >= MASTERY_NEED) m = i + 1;
    else break;
  }
  return m;
}

/** Change one child's stored progress and this device's own counter row. */
function updateChild(profileId: string, fn: (child: StoredChild, row: DeviceCounters) => void) {
  update((d) => {
    const child = { ...(d.progress[profileId] ?? emptyChild()) };
    const old = child.byDevice[d.deviceId] ?? emptyRow();
    const row = { ...old, daily: { ...old.daily } };
    fn(child, row);
    child.byDevice = { ...child.byDevice, [d.deviceId]: row };
    return { ...d, progress: { ...d.progress, [profileId]: child } };
  });
}

const touchProfile = (d: AppData, id: string, fields: Partial<Profile>): AppData => ({
  ...d,
  profiles: d.profiles.map((p) => (p.id === id ? { ...p, ...fields, updatedAt: Date.now() } : p)),
});

export const actions = {
  addProfile(fields: ProfileFields) {
    const id = uuid();
    const now = Date.now();
    update((d) => ({ ...d, profiles: [...d.profiles, { id, ...fields, createdAt: now, updatedAt: now, enrollment: {} }] }));
    return id;
  },
  editProfile(id: string, fields: ProfileFields) {
    update((d) => touchProfile(d, id, fields));
  },
  /** The child changes their own avatar (name, grade and theme stay in the parent area). */
  setAvatar(id: string, avatar: string) {
    update((d) => touchProfile(d, id, { avatar }));
  },
  deleteProfile(id: string) {
    update((d) => {
      const progress = { ...d.progress };
      delete progress[id];
      return { ...d, profiles: d.profiles.filter((p) => p.id !== id), progress };
    });
  },
  resetProgress(id: string) {
    update((d) => ({ ...d, progress: { ...d.progress, [id]: emptyChild() } }));
  },
  setPin(pin: string) {
    update((d) => ({ ...d, parentPin: pin }));
  },
  setSound(on: boolean) {
    update((d) => ({ ...d, sound: on }));
  },
  /**
   * Replace all data with a validated backup (from parseBackup in ./backup).
   * This device's PIN, device id and sync state stay.
   */
  restoreBackup(restored: AppData) {
    update((d) => ({ ...restored, deviceId: d.deviceId, sync: d.sync, parentPin: d.parentPin }));
  },

  /**
   * Record one answered question. result: 'first' (right on first try), 'second' (right after hint), 'wrong'.
   * Returns stars earned and whether the level changed.
   */
  recordAnswer(
    profileId: string,
    topicId: string,
    level: Level,
    result: 'first' | 'second' | 'wrong',
    mistake?: Omit<Mistake, 'id' | 'at' | 'topicId'>,
  ): { stars: number; levelChange: -1 | 0 | 1 } {
    let out = { stars: 0, levelChange: 0 as -1 | 0 | 1 };
    updateChild(profileId, (child, row) => {
      const tp: TopicProgress = { ...(child.topics[topicId] ?? emptyTopic()) };
      tp.byLevel = [...tp.byLevel] as [number, number, number];
      tp.attempts++;
      tp.lastAt = tp.updatedAt = Date.now();
      let stars = 0;
      if (result === 'first') {
        tp.firstTry++;
        tp.byLevel[level - 1]++;
        tp.runCorrect++;
        tp.runWrong = 0;
        stars = level;
      } else if (result === 'second') {
        tp.secondTry++;
        tp.runCorrect = 0;
        tp.runWrong = 0;
        stars = 1;
      } else {
        tp.runCorrect = 0;
        tp.runWrong++;
      }
      // Adaptive level: only adjust if the question was asked at the current level.
      if (level === tp.level) {
        if (tp.runCorrect >= 3 && tp.level < 3) {
          tp.level = (tp.level + 1) as Level;
          tp.runCorrect = 0;
          out.levelChange = 1;
        } else if (tp.runWrong >= 2 && tp.level > 1) {
          tp.level = (tp.level - 1) as Level;
          tp.runWrong = 0;
          out.levelChange = -1;
        }
      }
      const day = today();
      row.daily[day] = (row.daily[day] ?? 0) + 1;
      row.stars += stars;
      child.topics = { ...child.topics, [topicId]: tp };
      if (result === 'wrong' && mistake) {
        child.mistakes = [{ ...mistake, id: uuid(), at: Date.now(), topicId }, ...child.mistakes].slice(0, 60);
      }
      out = { ...out, stars };
    });
    return out;
  },
  /**
   * Record a finished test. Each question counts toward the topic's statistics and mastery
   * (correct = right on the first and only try), but tests never move the adaptive practice level.
   * Stars: one per 10 points.
   */
  recordExam(
    profileId: string,
    exam: Omit<ExamRecord, 'id' | 'at'>,
    answers: { topicId: string; level: Level; correct: boolean; mistake?: Omit<Mistake, 'id' | 'at' | 'topicId'> }[],
  ): number {
    const stars = Math.round(exam.score / 10);
    updateChild(profileId, (child, row) => {
      const topics = { ...child.topics };
      const mistakes: Mistake[] = [];
      const now = Date.now();
      for (const a of answers) {
        const tp: TopicProgress = { ...(topics[a.topicId] ?? emptyTopic()) };
        tp.byLevel = [...tp.byLevel] as [number, number, number];
        tp.attempts++;
        tp.lastAt = tp.updatedAt = now;
        if (a.correct) {
          tp.firstTry++;
          tp.byLevel[a.level - 1]++;
        } else if (a.mistake) mistakes.push({ ...a.mistake, id: uuid(), at: now, topicId: a.topicId });
        topics[a.topicId] = tp;
      }
      const day = today();
      row.daily[day] = (row.daily[day] ?? 0) + answers.length;
      row.stars += stars;
      child.topics = topics;
      child.mistakes = [...mistakes, ...child.mistakes].slice(0, 60);
      child.exams = [{ ...exam, id: uuid(), at: now }, ...(child.exams ?? [])].slice(0, 50);
    });
    return stars;
  },
  endSession(profileId: string) {
    updateChild(profileId, (_child, row) => {
      row.sessions++;
    });
  },
};
