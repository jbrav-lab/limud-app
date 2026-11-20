import { describe, expect, it } from 'vitest';
import { PACKS, loadPack } from '../curricula';
import { emptyUserAnswer } from '../components/AnswerInput';
import type { UserAnswer } from './check';
import { gcd } from './math';
import { allocatePoints, type ExamQuestion } from './exam';
import { freeze, scoreFrozen, standIn } from './frozen';
import type { Answer, Level } from './types';

const LOADED = await Promise.all(PACKS.map((p) => loadPack(p.id)));

/** One generated question of every topic at every level, as a test. */
function everyQuestion(): ExamQuestion[] {
  const out: Omit<ExamQuestion, 'points'>[] = [];
  for (const pack of LOADED) for (const t of pack.topics) for (const level of [1, 2, 3] as Level[]) out.push({ topicId: t.id, level, q: t.generate(level) });
  const pts = allocatePoints(out.map(() => 1));
  return out.map((x, i) => ({ ...x, points: pts[i] }));
}

/** The right answer, typed the way a child would on the frozen (shown) question. */
function rightAnswer(a: Answer): UserAnswer {
  switch (a.kind) {
    case 'number':
      return { kind: 'number', text: String(a.value) };
    case 'fraction': {
      const g = gcd(a.num, a.den);
      const [n, d] = [a.num / g, a.den / g];
      if (a.form === 'mixed' && n % d !== 0) return { kind: 'fraction', whole: String(Math.floor(n / d)), num: String(n % d), den: String(d) };
      if (n % d === 0) return { kind: 'fraction', whole: String(n / d), num: '', den: '' };
      return { kind: 'fraction', whole: '', num: String(n), den: String(d) };
    }
    case 'choice':
      return { kind: 'choice', index: a.correct };
    case 'compare':
      return { kind: 'compare', value: a.correct };
    case 'divRem':
      return { kind: 'divRem', q: String(a.q), r: String(a.r) };
    case 'multi':
      return { kind: 'multi', picked: [...a.correct] };
    case 'order':
      // position k of the answer holds the shown item that is items[k]
      return { kind: 'order', seq: a.items.map((_, k) => a.start.indexOf(k)) };
    case 'match':
      return { kind: 'match', chosen: a.pairs.map(([, r]) => a.rights.indexOf(r)) };
    case 'text':
      return { kind: 'text', text: a.accept[0] };
  }
}

describe('parent-made tests: frozen questions and scoring', () => {
  const exam = everyQuestion();
  const { questions, keys } = freeze(exam);

  it('the child’s copy holds no answers, keys or explanations', () => {
    for (const q of questions) {
      const json = JSON.stringify(q);
      for (const field of ['"answer"', '"solution"', '"accept"', '"correct"', '"hint"', '"pairs"', '"start"', '"num"', '"den"', '"value"']) expect(json).not.toContain(field);
    }
  });

  it('a stand-in draws the usual answer widget', () => {
    for (const q of questions) expect(emptyUserAnswer(standIn(q.input)).kind).toBe(q.input.kind === 'fraction' ? 'fraction' : q.input.kind);
  });

  it('all right answers score 100; a blank test scores 0', () => {
    const right = exam.map((e) => rightAnswer(e.q.answer));
    const r = scoreFrozen(questions, keys, right);
    const wrong = r.marks.map((m, i) => (m.correct ? null : `${exam[i].topicId} L${exam[i].level} ${JSON.stringify(exam[i].q.answer)} ${m.note ?? ''}`)).filter(Boolean);
    expect(wrong).toEqual([]);
    expect(r.score).toBe(100);
    const blank = scoreFrozen(questions, keys, questions.map(() => null));
    expect(blank).toMatchObject({ score: 0, correct: 0 });
    expect(blank.marks.every((m) => !m.answered)).toBe(true);
  });

  it('a wrong order is wrong even though the shown order differs from the key', () => {
    const i = exam.findIndex((e) => e.q.answer.kind === 'order');
    if (i < 0) return;
    const shown: UserAnswer = { kind: 'order', seq: (questions[i].input as { items: string[] }).items.map((_, k) => k) };
    const a = exam[i].q.answer as Extract<Answer, { kind: 'order' }>;
    const identity = a.start.every((v, k) => v === k);
    expect(scoreFrozen([questions[i]], [keys[i]], [shown]).marks[0].correct).toBe(identity);
  });
});
