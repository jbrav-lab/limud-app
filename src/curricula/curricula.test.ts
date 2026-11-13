import { describe, expect, it } from 'vitest';
import { PACKS, loadPack, packIdOf } from './index';
import { checkAnswer } from '../engine/check';
import { describeCorrect } from '../components/AnswerInput';

// Every pack is checked: its question generators, ids and content rules.
const LOADED = await Promise.all(PACKS.map((p) => loadPack(p.id)));
const TOPICS = LOADED.flatMap((p) => p.topics);

describe('curriculum registry', () => {
  it('namespaces every topic and unit by its pack, with no duplicates', () => {
    for (const pack of LOADED) {
      for (const t of pack.topics) {
        expect(packIdOf(t.id)).toBe(pack.id);
        expect(pack.units.some((u) => u.id === t.unit), `${t.id} has unknown unit ${t.unit}`).toBe(true);
      }
      for (const u of pack.units) expect(pack.topics.some((t) => t.unit === u.id), `empty unit ${u.id}`).toBe(true);
    }
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
  });
});
import type { Level, Question } from '../engine/types';
import { fmt, fracWords, frBoth } from '../engine/math';
import { rootAnswers } from './g5/hebrew/forms';

const RUNS = 400;

function assertWellFormed(q: Question, where: string) {
  expect(q.prompt, where).toBeTruthy();
  expect(q.solution.length, where).toBeGreaterThan(0);
  const text = [q.prompt, q.expression ?? '', q.hint ?? '', ...q.solution].join(' ');
  expect(text, `${where}: contains undefined/NaN`).not.toMatch(/undefined|NaN|Infinity/);
  const a = q.answer;
  switch (a.kind) {
    case 'number':
      expect(Number.isFinite(a.value), where).toBe(true);
      expect(a.value, `${where} negative`).toBeGreaterThanOrEqual(0);
      // the correct value typed as a string must be accepted
      expect(checkAnswer(a, { kind: 'number', text: fmt(a.value, false) }).correct, `${where} self-check ${a.value}`).toBe(true);
      break;
    case 'fraction':
      expect(a.den, where).toBeGreaterThan(0);
      expect(a.num, where).toBeGreaterThan(0);
      expect(Number.isInteger(a.num) && Number.isInteger(a.den), where).toBe(true);
      break;
    case 'choice':
      expect(a.options.length, where).toBeGreaterThanOrEqual(2);
      expect(a.correct, where).toBeGreaterThanOrEqual(0);
      expect(a.correct, where).toBeLessThan(a.options.length);
      expect(new Set(a.options).size, `${where} duplicate options ${a.options}`).toBe(a.options.length);
      break;
    case 'divRem':
      expect(a.r, where).toBeGreaterThanOrEqual(0);
      break;
    case 'multi':
      expect(new Set(a.options).size, `${where} duplicate options`).toBe(a.options.length);
      expect(a.correct.length, `${where} needs at least one correct option`).toBeGreaterThan(0);
      expect(a.correct.length, `${where} needs at least one wrong option`).toBeLessThan(a.options.length);
      expect(a.correct.every((i) => i >= 0 && i < a.options.length), where).toBe(true);
      expect(checkAnswer(a, { kind: 'multi', picked: [...a.correct] }).correct, `${where} self-check`).toBe(true);
      break;
    case 'order':
      expect(a.items.length, where).toBeGreaterThanOrEqual(3);
      expect(new Set(a.items).size, `${where} duplicate items`).toBe(a.items.length);
      expect(a.start.every((v, i) => v === i), `${where} starts already solved`).toBe(false);
      expect(checkAnswer(a, { kind: 'order', seq: a.items.map((_, i) => i) }).correct, `${where} self-check`).toBe(true);
      break;
    case 'text':
      expect(a.accept.length, where).toBeGreaterThan(0);
      for (const t of a.accept) expect(checkAnswer(a, { kind: 'text', text: t }).correct, `${where} self-check ${t}`).toBe(true);
      break;
    case 'match': {
      expect(a.pairs.length, where).toBeGreaterThanOrEqual(2);
      expect(new Set(a.rights).size, `${where} duplicate right-hand items`).toBe(a.rights.length);
      const chosen = a.pairs.map(([, r]) => a.rights.indexOf(r));
      expect(chosen.every((c) => c >= 0), where).toBe(true);
      expect(checkAnswer(a, { kind: 'match', chosen }).correct, `${where} self-check`).toBe(true);
      break;
    }
  }
  // Word problems: every fraction (and decimal) is written in Hebrew words followed by the number, e.g. "חצי ([[{1/2}]])".
  if (q.wordProblem) {
    const rest = q.prompt.replace(/[֐-׿][֐-׿\s-]* \(\[\[\{[^{}]*\}\]\]\)/g, '');
    expect(rest, `${where}: fraction without words in "${q.prompt}"`).not.toMatch(/\{[^{}]*\}/);
    expect(rest, `${where}: decimal without words in "${q.prompt}"`).not.toMatch(/\d\.\d/);
  }
  // balanced fraction braces
  const opens = (text.match(/\{/g) ?? []).length;
  const closes = (text.match(/\}/g) ?? []).length;
  expect(opens, `${where} braces`).toBe(closes);
}

describe('question banks', () => {
  for (const topic of TOPICS.filter((t) => t.bank)) {
    it(`${topic.id} has questions at every level, all reachable`, () => {
      for (const l of [1, 2, 3]) expect(topic.bank!.filter((it) => it.l === l).length, `${topic.id} level ${l}`).toBeGreaterThanOrEqual(3);
      // over many draws, every item of a level is asked (the bank rotates instead of repeating)
      for (const l of [1, 2, 3] as Level[]) {
        const n = topic.bank!.filter((it) => it.l === l).length;
        const seen = new Set<string>();
        for (let i = 0; i < n * 30; i++) {
          const q = topic.generate(l);
          seen.add(q.prompt + '|' + describeCorrect(q.answer)); // two items may share a prompt with different answers
        }
        expect(seen.size, `${topic.id} level ${l}: asked ${seen.size} of ${n}`).toBe(n);
      }
    });
  }
});

describe('topic generators', () => {
  for (const topic of TOPICS) {
    for (const level of [1, 2, 3] as Level[]) {
      it(`${topic.id} level ${level}`, () => {
        for (let i = 0; i < RUNS; i++) assertWellFormed(topic.generate(level), `${topic.id}/L${level}`);
      });
    }
  }
});

describe('fractions in Hebrew words', () => {
  it('names fractions with correct gender and construct forms', () => {
    expect(fracWords(1, 2)).toBe('חצי');
    expect(fracWords(3, 4)).toBe('שלושה רבעים');
    expect(fracWords(2, 3)).toBe('שני שלישים');
    expect(fracWords(2, 5)).toBe('שתי חמישיות');
    expect(fracWords(7, 8)).toBe('שבע שמיניות');
    expect(fracWords(5, 12)).toBe('חמישה חלקים מתוך שנים-עשר');
  });
  it('writes the word form followed by the number', () => {
    expect(frBoth(1, 2)).toBe('חצי ([[{1/2}]])');
    expect(frBoth(13, 4, true)).toBe('שלושה ורבע ([[{3 1/4}]])');
  });
  it('is used by the fraction word problems', () => {
    const seen = TOPICS.find((t) => t.id === 'g5.math.fraction-word')!;
    for (let i = 0; i < 50; i++) expect(seen.generate(1).wordProblem).toBe(true);
  });
});

describe('answer checking', () => {
  it('accepts equivalent fractions by default and enforces forms', () => {
    const a = { kind: 'fraction' as const, num: 1, den: 2 };
    expect(checkAnswer(a, { kind: 'fraction', whole: '', num: '2', den: '4' }).correct).toBe(true);
    expect(checkAnswer({ ...a, form: 'simplest' }, { kind: 'fraction', whole: '', num: '2', den: '4' }).correct).toBe(false);
    const m = { kind: 'fraction' as const, num: 7, den: 4, form: 'mixed' as const };
    expect(checkAnswer(m, { kind: 'fraction', whole: '1', num: '3', den: '4' }).correct).toBe(true);
    expect(checkAnswer(m, { kind: 'fraction', whole: '', num: '7', den: '4' }).correct).toBe(false);
  });
  it('accepts typed words without case, niqqud, curly apostrophes or end punctuation', () => {
    const en = { kind: 'text' as const, accept: ["isn't"] };
    expect(checkAnswer(en, { kind: 'text', text: '  Isn’t. ' }).correct).toBe(true);
    expect(checkAnswer(en, { kind: 'text', text: 'is not' }).correct).toBe(false);
    const he = { kind: 'text' as const, accept: ['לשחק'] };
    expect(checkAnswer(he, { kind: 'text', text: 'לְשַׂחֵק' }).correct).toBe(true);
    expect(checkAnswer(he, { kind: 'text', text: 'לשחוק' }).correct).toBe(false);
  });
  it('accepts a root typed with or without separators and final letters', () => {
    const a = { kind: 'text' as const, accept: rootAnswers('הלכ') };
    for (const t of ['הלך', 'ה.ל.כ', 'ה-ל-ך', 'ה ל כ']) expect(checkAnswer(a, { kind: 'text', text: t }).correct, t).toBe(true);
  });
  it('parses numbers typed in different ways', () => {
    const a = { kind: 'number' as const, value: 3.5 };
    expect(checkAnswer(a, { kind: 'number', text: '3,5' }).correct).toBe(true);
    expect(checkAnswer(a, { kind: 'number', text: '3.50' }).correct).toBe(true);
    expect(checkAnswer({ kind: 'number', value: 10000 }, { kind: 'number', text: '10,000' }).correct).toBe(true);
  });
});
