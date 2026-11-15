import { migrate, type AppData } from './store';

/**
 * Backup files (export/restore in the parent area).
 *
 * Security (see docs/security-privacy.md):
 * - Export never includes the parent PIN.
 * - Restore accepts only a known shape: every field is type- and length-checked and copied into a new
 *   object, so unknown keys, wrong types, oversized strings and prototype-pollution keys never reach storage.
 * - Files over MAX_BACKUP_BYTES are refused before they are read.
 */

export const MAX_BACKUP_BYTES = 2_000_000;

export class BackupError extends Error {}

const fail = (why: string): never => {
  throw new BackupError(why);
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function keysOf(o: Record<string, unknown>, max: number, where: string): string[] {
  const ks = Object.keys(o);
  if (ks.length > max) fail(`${where}: too many entries`);
  for (const k of ks) if (FORBIDDEN_KEYS.has(k)) fail(`${where}: forbidden key`);
  return ks;
}

function str(x: unknown, max: number, where: string, optional = false): string | undefined {
  if (x === undefined && optional) return undefined;
  if (typeof x !== 'string' || x.length > max) return fail(`${where}: bad text`);
  return x;
}

function int(x: unknown, where: string, max = 1e9, optional = false): number | undefined {
  if (x === undefined && optional) return undefined;
  if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x > max) return fail(`${where}: bad number`);
  return x;
}

function num(x: unknown, where: string): number {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0) return fail(`${where}: bad number`);
  return x;
}

const PROFILE_ID = /^[A-Za-z0-9_-]{1,40}$/;
const TOPIC_ID = /^[a-z0-9.-]{1,80}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function topicProgress(x: unknown, where: string) {
  if (!isObj(x)) return fail(where);
  const byLevel = x.byLevel;
  if (!Array.isArray(byLevel) || byLevel.length !== 3) return fail(`${where}: byLevel`);
  const level = int(x.level, `${where}.level`, 3)!;
  if (level < 1) fail(`${where}.level`);
  return {
    level: level as 1 | 2 | 3,
    runCorrect: int(x.runCorrect, where)!,
    runWrong: int(x.runWrong, where)!,
    attempts: int(x.attempts, where)!,
    firstTry: int(x.firstTry, where)!,
    secondTry: int(x.secondTry, where)!,
    byLevel: byLevel.map((v, i) => int(v, `${where}.byLevel[${i}]`)!) as [number, number, number],
    lastAt: num(x.lastAt, where),
  };
}

function child(x: unknown, where: string) {
  if (!isObj(x)) return fail(where);
  const daily: Record<string, number> = {};
  if (x.daily !== undefined) {
    if (!isObj(x.daily)) fail(`${where}.daily`);
    for (const k of keysOf(x.daily as Record<string, unknown>, 5000, `${where}.daily`)) {
      if (!DAY.test(k)) fail(`${where}.daily key`);
      daily[k] = int((x.daily as Record<string, unknown>)[k], `${where}.daily`)!;
    }
  }
  const topics: Record<string, ReturnType<typeof topicProgress>> = {};
  if (x.topics !== undefined) {
    if (!isObj(x.topics)) fail(`${where}.topics`);
    for (const k of keysOf(x.topics as Record<string, unknown>, 1000, `${where}.topics`)) {
      if (!TOPIC_ID.test(k)) fail(`${where}.topics key`);
      topics[k] = topicProgress((x.topics as Record<string, unknown>)[k], `${where}.topics.${k}`);
    }
  }
  const list = (v: unknown, max: number, name: string) => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.length > max) return fail(`${where}.${name}`);
    return v;
  };
  const mistakes = list(x.mistakes, 1000, 'mistakes').map((m, i) => {
    const w = `${where}.mistakes[${i}]`;
    if (!isObj(m)) return fail(w);
    const topicId = str(m.topicId, 80, w)!;
    if (!TOPIC_ID.test(topicId)) fail(w);
    return {
      at: num(m.at, w),
      topicId,
      prompt: str(m.prompt, 4000, w)!,
      expression: str(m.expression, 1000, w, true),
      given: str(m.given, 2000, w)!,
      correct: str(m.correct, 2000, w)!,
    };
  });
  const exams = list(x.exams, 2000, 'exams').map((e, i) => {
    const w = `${where}.exams[${i}]`;
    if (!isObj(e)) return fail(w);
    const topicIds = list(e.topicIds, 500, `exams[${i}].topicIds`).map((t) => {
      const id = str(t, 80, w)!;
      if (!TOPIC_ID.test(id)) fail(w);
      return id;
    });
    const packId = str(e.packId, 40, w, true);
    return {
      at: num(e.at, w),
      topicIds,
      ...(packId !== undefined ? { packId } : {}),
      difficulty: str(e.difficulty, 40, w)!,
      questions: int(e.questions, w, 1000)!,
      correct: int(e.correct, w, 1000)!,
      score: int(e.score, w, 100)!,
    };
  });
  return {
    stars: int(x.stars, `${where}.stars`)!,
    streakDays: int(x.streakDays, `${where}.streakDays`)!,
    lastDay: str(x.lastDay, 10, `${where}.lastDay`, true) ?? '',
    daily,
    topics,
    mistakes,
    sessions: int(x.sessions, `${where}.sessions`)!,
    exams,
  };
}

/**
 * Validate a parsed backup and copy only the known fields (version 1 or 2 files).
 * The returned object has no parentPin: the caller keeps the PIN that is already on this device.
 */
export function sanitizeBackup(raw: unknown): Record<string, unknown> {
  if (!isObj(raw)) return fail('not an object');
  keysOf(raw, 20, 'top level');
  const version = raw.version ?? 1;
  if (version !== 1 && version !== 2) fail('unknown version');
  if (!Array.isArray(raw.profiles) || raw.profiles.length > 20) fail('profiles');
  const profiles = (raw.profiles as unknown[]).map((p, i) => {
    const w = `profiles[${i}]`;
    if (!isObj(p)) return fail(w);
    const id = str(p.id, 40, w)!;
    if (!PROFILE_ID.test(id)) fail(`${w}.id`);
    const name = str(p.name, 32, w)!.trim();
    if (!name) fail(`${w}.name`);
    return {
      id,
      name,
      avatar: str(p.avatar, 16, w)!,
      createdAt: num(p.createdAt, w),
      theme: str(p.theme, 32, w, true),
      grade: int(p.grade, `${w}.grade`, 12, true),
    };
  });
  const ids = new Set(profiles.map((p) => p.id));
  if (ids.size !== profiles.length) fail('duplicate profile ids');
  const progress: Record<string, unknown> = {};
  if (raw.progress !== undefined) {
    if (!isObj(raw.progress)) fail('progress');
    for (const k of keysOf(raw.progress as Record<string, unknown>, 20, 'progress')) {
      if (!ids.has(k)) fail('progress for an unknown profile');
      progress[k] = child((raw.progress as Record<string, unknown>)[k], `progress.${k}`);
    }
  }
  return {
    version,
    profiles,
    progress,
    sound: typeof raw.sound === 'boolean' ? raw.sound : true,
  };
}

/** Parse and validate a backup file's text, then bring it up to the current data version. */
export function parseBackup(text: string): AppData {
  if (text.length > MAX_BACKUP_BYTES) fail('file too large');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('not JSON');
  }
  return migrate(sanitizeBackup(parsed));
}

/** The backup file's text. The parent PIN is never written to a file. */
export function backupJson(d: AppData): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { parentPin, ...rest } = d;
  return JSON.stringify(rest, null, 2);
}
