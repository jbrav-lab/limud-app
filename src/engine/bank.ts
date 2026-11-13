import type { LessonBlock, Level, Question, RichText, Topic } from './types';
import { shuffle } from './math';

/**
 * Question banks: authored questions (as data) instead of code generators.
 * Used by subjects like science, Hebrew and English. Each item has a level (1-3) and one shape:
 *   choice:  { q, a: correct, d: [distractors] }
 *   true/false: { tf: statement, t: true|false }
 *   multi (choose all correct): { q, multi: [all correct], d: [distractors] }
 *   order:   { q, order: [items in the correct order] }
 *   match:   { q, match: [[left, right], ...] }
 *   number:  { q, num, unit? }
 *   text:    { q, text: [accepted answers; the first is shown as the answer] }
 * `why` is the explanation shown after answering; `hint` is optional.
 */
interface Base {
  l: Level;
  why: RichText | RichText[];
  hint?: RichText;
}
export type BankItem = Base &
  (
    | { q: RichText; a: RichText; d: RichText[] }
    | { tf: RichText; t: boolean }
    | { q: RichText; multi: RichText[]; d: RichText[] }
    | { q: RichText; order: RichText[] }
    | { q: RichText; match: [RichText, RichText][] }
    | { q: RichText; num: number; unit?: string }
    | { q: RichText; text: string[] }
  );

export const TRUE_LABEL = 'נכון ✔';
export const FALSE_LABEL = 'לא נכון ✘';

export function bankQuestion(item: BankItem): Question {
  const solution = Array.isArray(item.why) ? item.why : [item.why];
  const common = { solution, hint: item.hint, wordProblem: true };
  if ('tf' in item) {
    return { ...common, prompt: `נכון או לא נכון?\n**${item.tf}**`, answer: { kind: 'choice', options: [TRUE_LABEL, FALSE_LABEL], correct: item.t ? 0 : 1 } };
  }
  if ('a' in item) {
    const options = shuffle([item.a, ...item.d]);
    return { ...common, prompt: item.q, answer: { kind: 'choice', options, correct: options.indexOf(item.a) } };
  }
  if ('multi' in item) {
    const options = shuffle([...item.multi, ...item.d]);
    return { ...common, prompt: item.q, answer: { kind: 'multi', options, correct: item.multi.map((m) => options.indexOf(m)) } };
  }
  if ('order' in item) {
    const n = item.order.length;
    let start = shuffle([...Array(n).keys()]);
    while (start.every((v, i) => v === i)) start = shuffle(start); // never start already solved
    return { ...common, prompt: item.q, answer: { kind: 'order', items: item.order, start } };
  }
  if ('match' in item) {
    return { ...common, prompt: item.q, answer: { kind: 'match', pairs: item.match, rights: shuffle(item.match.map(([, r]) => r)) } };
  }
  if ('text' in item) {
    return { ...common, prompt: item.q, answer: { kind: 'text', accept: item.text } };
  }
  return { ...common, prompt: item.q, answer: { kind: 'number', value: item.num, unit: item.unit } };
}

/** Recently asked items per topic, so a bank rotates before repeating. */
const recent = new Map<string, number[]>();

export function bankGenerator(key: string, items: BankItem[]): (level: Level) => Question {
  return (level: Level) => {
    // the requested level; if it has no items, the nearest level that does
    const byDistance = [0, 1, 2].map((d) => items.map((it, i) => [it, i] as const).filter(([it]) => Math.abs(it.l - level) === d));
    const pool = byDistance.find((p) => p.length > 0) ?? [];
    const seen = recent.get(key) ?? [];
    const fresh = pool.filter(([, i]) => !seen.includes(i));
    const [item, idx] = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
    const keep = Math.max(1, Math.floor(pool.length / 2));
    recent.set(key, [idx, ...seen.filter((i) => i !== idx)].slice(0, Math.min(keep, 8)));
    return bankQuestion(item);
  };
}

/** Build a topic whose questions come from a bank. */
export function bankTopic(t: { id: string; unit: string; title: string; emoji: string; lesson: LessonBlock[]; items: BankItem[] }): Topic {
  return {
    id: t.id,
    unit: t.unit,
    title: t.title,
    emoji: t.emoji,
    lesson: t.lesson,
    generate: bankGenerator(t.id, t.items),
    bank: t.items,
  };
}
