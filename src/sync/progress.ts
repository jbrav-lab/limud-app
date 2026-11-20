import { emptyChild, getData, onDataChange, today, type DeviceCounters, type StoredChild, type TopicProgress } from '../engine/store';
import { DEVICE_AUTH_KEY, deviceClient, parentClient, syncEnabled } from './client';

/**
 * Stage 4 (owner, 2026-11-20: "online monitoring on his device"): a paired child's device uploads its
 * progress; a parent reads it. One way only: nothing on the device is changed by the server.
 *
 * The server merges every upload so nothing goes backwards (supabase/migrations/…0300_rls.sql):
 * per-device counters only grow, topic progress takes the max of each counter and the newer level,
 * and test results and mistakes are written once by id. So the device simply sends what it has,
 * as often as it likes, and an upload that fails is repeated next time.
 */

/** Days of daily activity sent per upload (older days were sent before and never change). */
export const DAILY_DAYS = 45;
const TOPIC_RE = /^g[0-9]+\.[a-z0-9-]+\.[a-z0-9-]+$/;
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
const iso = (ms: number) => new Date(ms || 0).toISOString();

export interface ProgressRows {
  totals: { child_id: string; device_id: string; family_id: string; stars: number; sessions: number; updated_at: string };
  daily: { child_id: string; device_id: string; family_id: string; day: string; answered: number }[];
  topics: {
    child_id: string;
    topic_id: string;
    family_id: string;
    level: number;
    run_correct: number;
    run_wrong: number;
    attempts: number;
    first_try: number;
    second_try: number;
    by_level: number[];
    last_at: string;
    updated_at: string;
  }[];
  exams: {
    id: string;
    child_id: string;
    family_id: string;
    pack_id: string;
    topic_ids: string[];
    difficulty: string;
    questions: number;
    correct: number;
    score: number;
    taken_at: string;
  }[];
  mistakes: { id: string; child_id: string; family_id: string; topic_id: string; prompt: string; expression: string | null; given: string; correct: string; at: string }[];
}

const n = (x: unknown) => (Number.isFinite(x) && (x as number) >= 0 ? Math.floor(x as number) : 0);

/** This device's rows for one child, shaped for the server tables (only values the server accepts). */
export function toRows(c: StoredChild, childId: string, familyId: string, deviceId: string, now = Date.now()): ProgressRows {
  const mine: DeviceCounters = c.byDevice[deviceId] ?? { stars: 0, sessions: 0, daily: {} };
  const since = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - DAILY_DAYS);
    return today(d);
  })();
  const ids = { child_id: childId, family_id: familyId };
  return {
    totals: { ...ids, device_id: deviceId, stars: n(mine.stars), sessions: n(mine.sessions), updated_at: iso(now) },
    daily: Object.entries(mine.daily)
      .filter(([day, k]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= since && n(k) > 0)
      .map(([day, k]) => ({ ...ids, device_id: deviceId, day, answered: n(k) })),
    topics: Object.entries(c.topics)
      .filter(([id, tp]) => TOPIC_RE.test(id) && n(tp.attempts) > 0 && tp.level >= 1 && tp.level <= 3)
      .map(([id, tp]) => ({
        ...ids,
        topic_id: id,
        level: tp.level,
        run_correct: n(tp.runCorrect),
        run_wrong: n(tp.runWrong),
        attempts: n(tp.attempts),
        first_try: n(tp.firstTry),
        second_try: n(tp.secondTry),
        by_level: [0, 1, 2].map((i) => n(tp.byLevel?.[i])),
        last_at: iso(tp.lastAt),
        updated_at: iso(tp.updatedAt || tp.lastAt),
      })),
    exams: (c.exams ?? [])
      .filter((e) => e.questions >= 0 && e.questions <= 500 && e.correct >= 0 && e.correct <= e.questions && e.score >= 0 && e.score <= 100)
      .filter((e) => e.packId.length <= 64 && e.difficulty.length <= 16 && e.topicIds.length <= 64)
      .map((e) => ({
        ...ids,
        id: e.id,
        pack_id: e.packId,
        topic_ids: e.topicIds,
        difficulty: e.difficulty,
        questions: n(e.questions),
        correct: n(e.correct),
        score: n(e.score),
        taken_at: iso(e.at),
      })),
    mistakes: c.mistakes.map((m) => ({
      ...ids,
      id: m.id,
      topic_id: cut(m.topicId, 128),
      prompt: cut(m.prompt, 4000),
      expression: m.expression ? cut(m.expression, 1000) : null,
      given: cut(m.given, 1000),
      correct: cut(m.correct, 1000),
      at: iso(m.at),
    })),
  };
}

type Row<K extends keyof ProgressRows> = ProgressRows[K] extends (infer R)[] ? R : ProgressRows[K];

/** A child's progress from the server's rows, in the app's own shape (so the parent report can show it). */
export function fromRows(r: {
  totals: Row<'totals'>[];
  daily: Row<'daily'>[];
  topics: Row<'topics'>[];
  exams: Row<'exams'>[];
  mistakes: Row<'mistakes'>[];
}): StoredChild {
  const c = emptyChild();
  const row = (dev: string) => (c.byDevice[dev] ??= { stars: 0, sessions: 0, daily: {} });
  for (const t of r.totals) Object.assign(row(t.device_id), { stars: t.stars, sessions: t.sessions });
  for (const d of r.daily) row(d.device_id).daily[d.day] = d.answered;
  for (const t of r.topics) {
    c.topics[t.topic_id] = {
      level: t.level as TopicProgress['level'],
      runCorrect: t.run_correct,
      runWrong: t.run_wrong,
      attempts: t.attempts,
      firstTry: t.first_try,
      secondTry: t.second_try,
      byLevel: [t.by_level[0] ?? 0, t.by_level[1] ?? 0, t.by_level[2] ?? 0],
      lastAt: Date.parse(t.last_at),
      updatedAt: Date.parse(t.updated_at),
    };
  }
  c.exams = r.exams
    .map((e) => ({
      id: e.id,
      at: Date.parse(e.taken_at),
      topicIds: e.topic_ids,
      packId: e.pack_id,
      difficulty: e.difficulty,
      questions: e.questions,
      correct: e.correct,
      score: e.score,
    }))
    .sort((a, b) => b.at - a.at);
  c.mistakes = r.mistakes
    .map((m) => ({
      id: m.id,
      at: Date.parse(m.at),
      topicId: m.topic_id,
      prompt: m.prompt,
      ...(m.expression ? { expression: m.expression } : {}),
      given: m.given,
      correct: m.correct,
    }))
    .sort((a, b) => b.at - a.at);
  return c;
}

// --- On the child's device: upload -----------------------------------------------------------------

let lastSent = 0;
let running: Promise<boolean> | null = null;
/** When this device last uploaded its progress (ms, this app run only; 0 if not yet). */
export const lastUpload = () => lastSent;

/** Upload this device's progress for every child it is paired with. False if not paired, offline or refused (tried again later). */
export function uploadProgress(): Promise<boolean> {
  return (running ??= (async () => {
    try {
      const c = await deviceClient();
      const { data: s } = await c.auth.getSession();
      if (!s.session) return false;
      const { data: kids, error } = await c.from('children').select('id, family_id');
      if (error || !kids?.length) return false;
      const d = getData();
      for (const k of kids as { id: string; family_id: string }[]) {
        const child = d.progress[k.id];
        if (!child || d.deleted[k.id]) continue;
        const r = toRows(child, k.id, k.family_id, d.deviceId);
        const steps = [
          c.from('child_device_totals').upsert(r.totals, { onConflict: 'child_id,device_id' }),
          r.daily.length ? c.from('daily_activity').upsert(r.daily, { onConflict: 'child_id,device_id,day' }) : null,
          r.topics.length ? c.from('topic_progress').upsert(r.topics, { onConflict: 'child_id,topic_id' }) : null,
          r.exams.length ? c.from('exam_results').upsert(r.exams, { onConflict: 'id', ignoreDuplicates: true }) : null,
          r.mistakes.length ? c.from('mistakes').upsert(r.mistakes, { onConflict: 'id', ignoreDuplicates: true }) : null,
        ];
        for (const step of steps) {
          if (!step) continue;
          const { error: e } = await step;
          if (e) return false; // offline or refused (for example a revoked device): try again next time
        }
      }
      lastSent = Date.now();
      return true;
    } catch {
      return false; // offline: try again next time
    } finally {
      running = null;
    }
  })());
}

/** Wait after a change before uploading, so a practice session sends once, not after every answer. */
export const UPLOAD_DELAY_MS = 20_000;

/**
 * On a paired device: upload soon after the app opens, a short while after progress changes, when the
 * app goes to the background, and when the connection comes back. Does nothing on an unpaired device
 * (the sync library isn't even loaded there).
 */
let autoStarted = false;
export function startAutoUpload() {
  if (!syncEnabled() || autoStarted) return;
  try {
    if (!localStorage.getItem(DEVICE_AUTH_KEY)) return;
  } catch {
    return;
  }
  autoStarted = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = (ms = UPLOAD_DELAY_MS) => {
    clearTimeout(timer);
    timer = setTimeout(() => void uploadProgress(), ms);
  };
  onDataChange(() => soon());
  addEventListener('online', () => soon(2_000));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      clearTimeout(timer);
      void uploadProgress();
    }
  });
  soon(3_000);
}

// --- For a parent: read -----------------------------------------------------------------------------

export interface RemoteChild {
  child: StoredChild;
  /** When a device of this child last uploaded (ms), or 0. */
  updatedAt: number;
}

/** A child's progress on the server (every paired device), read with the parent's sign-in. */
export async function fetchChildProgress(childId: string): Promise<RemoteChild> {
  const c = await parentClient();
  const since = (() => {
    const d = new Date();
    d.setDate(d.getDate() - DAILY_DAYS);
    return today(d);
  })();
  const [totals, daily, topics, exams, mistakes] = await Promise.all([
    c.from('child_device_totals').select('child_id, device_id, family_id, stars, sessions, updated_at').eq('child_id', childId),
    c.from('daily_activity').select('child_id, device_id, family_id, day, answered').eq('child_id', childId).gte('day', since),
    c.from('topic_progress').select('*').eq('child_id', childId),
    c.from('exam_results').select('*').eq('child_id', childId).order('taken_at', { ascending: false }).limit(50),
    c.from('mistakes').select('*').eq('child_id', childId).order('at', { ascending: false }).limit(60),
  ]);
  const failed = [totals, daily, topics, exams, mistakes].find((x) => x.error);
  if (failed) throw new Error('fetch failed');
  const t = (totals.data ?? []) as Row<'totals'>[];
  return {
    child: fromRows({
      totals: t,
      daily: (daily.data ?? []) as Row<'daily'>[],
      topics: (topics.data ?? []) as Row<'topics'>[],
      exams: (exams.data ?? []) as Row<'exams'>[],
      mistakes: (mistakes.data ?? []) as Row<'mistakes'>[],
    }),
    updatedAt: Math.max(0, ...t.map((x) => Date.parse(x.updated_at))),
  };
}
