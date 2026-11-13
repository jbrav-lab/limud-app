import { useEffect, useState } from 'react';
import type { Topic, Unit } from '../engine/types';
import type { Pack, PackContent, PackInfo } from './types';

/**
 * The curriculum registry: Grade → Subject (pack) → Unit → Topic.
 * Pack info is small and always available; pack content is loaded on demand (its own JS chunk).
 * To add a subject: create src/curricula/g<grade>/<subject>/pack.ts and add it to PACKS + LOADERS.
 */

export const GRADES = [
  { grade: 2, label: 'כיתה ב׳' },
  { grade: 5, label: 'כיתה ה׳' },
];
export const DEFAULT_GRADE = 5;
export const gradeLabel = (g: number) => GRADES.find((x) => x.grade === g)?.label ?? `כיתה ${g}`;

export const PACKS: PackInfo[] = [
  { id: 'g5.math', grade: 5, subject: 'math', title: 'חשבון', emoji: '🧮', dir: 'rtl', program: 'תכנית 2006', doc: 'docs/curriculum-grade5.md' },
  { id: 'g5.science', grade: 5, subject: 'science', title: 'מדע וטכנולוגיה', emoji: '🔬', dir: 'rtl', program: 'מפרטי תוכן תשפ"ז', doc: 'docs/curriculum-g5-science.md' },
  { id: 'g5.hebrew', grade: 5, subject: 'hebrew', title: 'שפה ולשון', emoji: '📝', dir: 'rtl', program: 'חינוך לשוני תשס"ג – הישגים נדרשים', doc: 'docs/curriculum-g5-hebrew.md' },
  { id: 'g5.english', grade: 5, subject: 'english', title: 'אנגלית', emoji: '🔤', dir: 'ltr', program: 'English Curriculum 2020', doc: 'docs/curriculum-g5-english.md' },
];

const LOADERS: Record<string, () => Promise<{ default: PackContent }>> = {
  'g5.math': () => import('./g5/math/pack'),
  'g5.science': () => import('./g5/science/pack'),
  'g5.hebrew': () => import('./g5/hebrew/pack'),
  'g5.english': () => import('./g5/english/pack'),
};

export const packInfo = (id: string) => PACKS.find((p) => p.id === id);
export const packsForGrade = (grade: number) => PACKS.filter((p) => p.grade === grade);
/** "g5.math.fraction-meaning" → "g5.math" */
export const packIdOf = (namespacedId: string) => namespacedId.split('.').slice(0, 2).join('.');

const loaded = new Map<string, Pack>();
const loading = new Map<string, Promise<Pack>>();

export function loadPack(id: string): Promise<Pack> {
  const done = loaded.get(id);
  if (done) return Promise.resolve(done);
  const inFlight = loading.get(id);
  if (inFlight) return inFlight;
  const info = packInfo(id);
  const loader = LOADERS[id];
  if (!info || !loader) return Promise.reject(new Error(`unknown pack ${id}`));
  const p = loader().then(({ default: content }) => {
    const ns = (local: string) => `${id}.${local}`;
    const pack: Pack = {
      ...info,
      units: content.units.map((u): Unit => ({ ...u, id: ns(u.id) })),
      topics: content.topics.map((t): Topic => ({ ...t, id: ns(t.id), unit: ns(t.unit) })),
    };
    loaded.set(id, pack);
    loading.delete(id);
    return pack;
  });
  loading.set(id, p);
  return p;
}

/** CSS class for content of a left-to-right pack (English): each line takes its direction from its own text. */
export const dirClass = (namespacedId: string) => (packInfo(packIdOf(namespacedId))?.dir === 'ltr' ? 'dir-auto' : '');

export const loadedPack = (id: string) => loaded.get(id);
/** Synchronous lookups — only valid once the topic's pack is loaded (screens render inside <WithPacks>). */
export const topicById = (id: string) => loaded.get(packIdOf(id))?.topics.find((t) => t.id === id);
export const unitById = (id: string) => loaded.get(packIdOf(id))?.units.find((u) => u.id === id);

/** Load the given packs; returns them once all are ready (null while loading). */
export function usePacks(ids: string[]): Pack[] | null {
  const key = [...new Set(ids)].sort().join('|');
  const ready = () => {
    const ps = key ? key.split('|').map((id) => loaded.get(id)) : [];
    return ps.every(Boolean) ? (ps as Pack[]) : null;
  };
  const [packs, setPacks] = useState<Pack[] | null>(ready);
  useEffect(() => {
    let alive = true;
    const now = ready();
    if (now) {
      setPacks(now);
      return;
    }
    setPacks(null);
    Promise.all(key.split('|').map(loadPack)).then((ps) => alive && setPacks(ps));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return packs;
}
