import { useSyncExternalStore } from 'react';
import type { Level } from './types';

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  /** Color theme id from the design system (see src/themes.ts); missing = default theme. */
  theme?: string;
  /** School grade (2, 5, …): decides which subjects the child sees. */
  grade: number;
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
}

export interface Mistake {
  at: number;
  topicId: string;
  prompt: string;
  expression?: string;
  given: string;
  correct: string;
}

/** One finished "הכנה למבחן" test. */
export interface ExamRecord {
  at: number;
  topicIds: string[];
  /** The subject pack the test was taken in, e.g. "g5.math". */
  packId: string;
  difficulty: string;
  questions: number;
  correct: number;
  score: number; // 0-100
}

export interface ChildProgress {
  stars: number;
  streakDays: number;
  lastDay: string; // YYYY-MM-DD
  daily: Record<string, number>; // questions answered per day
  topics: Record<string, TopicProgress>;
  mistakes: Mistake[];
  sessions: number;
  exams?: ExamRecord[]; // newest first
}

export interface AppData {
  /** 1 = grade-5 math only (topic ids like "fractions"); 2 = curriculum packs (ids like "g5.math.fractions"). */
  version: 2;
  parentPin?: string;
  profiles: Profile[];
  progress: Record<string, ChildProgress>;
  sound: boolean;
}

// The storage key stays the same across data versions: progress is migrated in place.
const KEY = 'limud-app-v1';
const BACKUP_V1_KEY = 'limud-app-backup-before-v2';

const empty = (): AppData => ({ version: 2, profiles: [], progress: {}, sound: true });

/** Data version 1 only had grade-5 math, so every old id belongs to the "g5.math" pack. */
const V1_PACK = 'g5.math';
const nsId = (id: string) => (id.includes('.') ? id : `${V1_PACK}.${id}`);

/** Bring any saved data (current or older version) up to the current shape. Never drops progress. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrate(raw: any): AppData {
  const d = { ...empty(), ...raw };
  if ((raw?.version ?? 1) < 2) {
    d.profiles = (d.profiles ?? []).map((p: Profile) => ({ ...p, grade: p.grade ?? 5 }));
    d.progress = Object.fromEntries(
      Object.entries(d.progress ?? {}).map(([pid, c]) => {
        const child = c as ChildProgress;
        return [
          pid,
          {
            ...child,
            topics: Object.fromEntries(Object.entries(child.topics ?? {}).map(([tid, tp]) => [nsId(tid), tp])),
            mistakes: (child.mistakes ?? []).map((m) => ({ ...m, topicId: nsId(m.topicId) })),
            exams: (child.exams ?? []).map((e) => ({ ...e, packId: e.packId ?? V1_PACK, topicIds: e.topicIds.map(nsId) })),
          },
        ];
      }),
    );
  }
  d.profiles = d.profiles.map((p: Profile) => ({ ...p, grade: p.grade ?? 5 }));
  d.version = 2;
  return d as AppData;
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if ((parsed?.version ?? 1) < 2) {
        // keep an untouched copy of the old data, just in case
        localStorage.setItem(BACKUP_V1_KEY, raw);
        const m = migrate(parsed);
        localStorage.setItem(KEY, JSON.stringify(m));
        return m;
      }
      return migrate(parsed);
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

const emptyChild = (): ChildProgress => ({
  stars: 0,
  streakDays: 0,
  lastDay: '',
  daily: {},
  topics: {},
  mistakes: [],
  sessions: 0,
});

export const emptyTopic = (): TopicProgress => ({
  level: 1,
  runCorrect: 0,
  runWrong: 0,
  attempts: 0,
  firstTry: 0,
  secondTry: 0,
  byLevel: [0, 0, 0],
  lastAt: 0,
});

export function childProgress(d: AppData, profileId: string): ChildProgress {
  return d.progress[profileId] ?? emptyChild();
}

export function topicProgress(d: AppData, profileId: string, topicId: string): TopicProgress {
  return childProgress(d, profileId).topics[topicId] ?? emptyTopic();
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

export const actions = {
  addProfile(fields: ProfileFields) {
    const id = Math.random().toString(36).slice(2, 10);
    update((d) => ({ ...d, profiles: [...d.profiles, { id, ...fields, createdAt: Date.now() }] }));
    return id;
  },
  editProfile(id: string, fields: ProfileFields) {
    update((d) => ({ ...d, profiles: d.profiles.map((p) => (p.id === id ? { ...p, ...fields } : p)) }));
  },
  /** The child changes their own avatar (name, grade and theme stay in the parent area). */
  setAvatar(id: string, avatar: string) {
    update((d) => ({ ...d, profiles: d.profiles.map((p) => (p.id === id ? { ...p, avatar } : p)) }));
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
  importData(json: string) {
    const parsed = JSON.parse(json);
    if (![1, 2].includes(parsed?.version) || !Array.isArray(parsed.profiles)) throw new Error('bad file');
    update(() => migrate(parsed)); // backups from older versions are upgraded on restore
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
    mistake?: Omit<Mistake, 'at' | 'topicId'>,
  ): { stars: number; levelChange: -1 | 0 | 1 } {
    let out = { stars: 0, levelChange: 0 as -1 | 0 | 1 };
    update((d) => {
      const child = { ...childProgress(d, profileId) };
      const tp: TopicProgress = { ...(child.topics[topicId] ?? emptyTopic()) };
      tp.byLevel = [...tp.byLevel] as [number, number, number];
      tp.attempts++;
      tp.lastAt = Date.now();
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
      if (child.lastDay !== day) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        child.streakDays = child.lastDay === today(y) ? child.streakDays + 1 : 1;
        child.lastDay = day;
      }
      child.daily = { ...child.daily, [day]: (child.daily[day] ?? 0) + 1 };
      child.stars += stars;
      child.topics = { ...child.topics, [topicId]: tp };
      if (result === 'wrong' && mistake) {
        child.mistakes = [{ ...mistake, at: Date.now(), topicId }, ...child.mistakes].slice(0, 60);
      }
      out = { ...out, stars };
      return { ...d, progress: { ...d.progress, [profileId]: child } };
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
    exam: Omit<ExamRecord, 'at'>,
    answers: { topicId: string; level: Level; correct: boolean; mistake?: Omit<Mistake, 'at' | 'topicId'> }[],
  ): number {
    const stars = Math.round(exam.score / 10);
    update((d) => {
      const child = { ...childProgress(d, profileId) };
      const topics = { ...child.topics };
      const mistakes: Mistake[] = [];
      for (const a of answers) {
        const tp: TopicProgress = { ...(topics[a.topicId] ?? emptyTopic()) };
        tp.byLevel = [...tp.byLevel] as [number, number, number];
        tp.attempts++;
        tp.lastAt = Date.now();
        if (a.correct) {
          tp.firstTry++;
          tp.byLevel[a.level - 1]++;
        } else if (a.mistake) mistakes.push({ ...a.mistake, at: Date.now(), topicId: a.topicId });
        topics[a.topicId] = tp;
      }
      const day = today();
      if (child.lastDay !== day) {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        child.streakDays = child.lastDay === today(y) ? child.streakDays + 1 : 1;
        child.lastDay = day;
      }
      child.daily = { ...child.daily, [day]: (child.daily[day] ?? 0) + answers.length };
      child.topics = topics;
      child.stars += stars;
      child.mistakes = [...mistakes, ...child.mistakes].slice(0, 60);
      child.exams = [{ ...exam, at: Date.now() }, ...(child.exams ?? [])].slice(0, 50);
      return { ...d, progress: { ...d.progress, [profileId]: child } };
    });
    return stars;
  },
  endSession(profileId: string) {
    update((d) => {
      const child = { ...childProgress(d, profileId) };
      child.sessions++;
      return { ...d, progress: { ...d.progress, [profileId]: child } };
    });
  },
};
