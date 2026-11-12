import { describe, expect, it } from 'vitest';
import { PACKS, loadPack, packIdOf } from './index';
import { checkAnswer } from '../engine/check';

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
  it('parses numbers typed in different ways', () => {
    const a = { kind: 'number' as const, value: 3.5 };
    expect(checkAnswer(a, { kind: 'number', text: '3,5' }).correct).toBe(true);
    expect(checkAnswer(a, { kind: 'number', text: '3.50' }).correct).toBe(true);
    expect(checkAnswer({ kind: 'number', value: 10000 }, { kind: 'number', text: '10,000' }).correct).toBe(true);
  });
});
