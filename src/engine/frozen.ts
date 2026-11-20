import { checkAnswer, isComplete, type UserAnswer } from './check';
import type { ExamQuestion } from './exam';
import type { Answer, Level, RichText, Visual } from './types';

/**
 * Parent-made tests (owner, 2026-11-20): questions are generated once on the parent's phone and frozen.
 * A frozen question holds only what the child needs to answer it; its answer and explanation go to a
 * separate key that the child's device never receives until a parent releases the results
 * (security file §12: the child device never gets the answer key). Scoring runs on the parent's phone
 * with the app's own checker (owner's choice, 2026-11-20), so the score matches practice exactly.
 */

/** How the child answers, without the answer. */
export type AnswerInputSpec =
  | { kind: 'number'; unit?: string }
  | { kind: 'fraction'; form?: 'any' | 'simplest' | 'mixed'; showWhole: boolean }
  | { kind: 'choice'; options: RichText[] }
  | { kind: 'compare' }
  | { kind: 'divRem' }
  | { kind: 'multi'; options: RichText[] }
  /** items in the scrambled order shown; the child's answer indexes into this list */
  | { kind: 'order'; items: RichText[] }
  | { kind: 'match'; lefts: RichText[]; rights: RichText[] }
  | { kind: 'text' };

export interface FrozenQuestion {
  topicId: string;
  level: Level;
  points: number;
  prompt: RichText;
  expression?: RichText;
  visual?: Visual;
  wordProblem?: boolean;
  input: AnswerInputSpec;
}

export interface FrozenKey {
  answer: Answer;
  solution: RichText[];
}

function inputSpec(a: Answer): AnswerInputSpec {
  switch (a.kind) {
    case 'number':
      return a.unit ? { kind: 'number', unit: a.unit } : { kind: 'number' };
    case 'fraction':
      // The same "whole number" box practice shows (AnswerInput), without the value itself.
      return { kind: 'fraction', ...(a.form ? { form: a.form } : {}), showWhole: Boolean(a.allowWhole || a.form === 'mixed' || a.num > a.den) };
    case 'choice':
      return { kind: 'choice', options: a.options };
    case 'compare':
      return { kind: 'compare' };
    case 'divRem':
      return { kind: 'divRem' };
    case 'multi':
      return { kind: 'multi', options: a.options };
    case 'order':
      return { kind: 'order', items: a.start.map((i) => a.items[i]) };
    case 'match':
      return { kind: 'match', lefts: a.pairs.map((p) => p[0]), rights: a.rights };
    case 'text':
      return { kind: 'text' };
  }
}

/** Split a generated test into what the child gets and the key the parent keeps. */
export function freeze(exam: ExamQuestion[]): { questions: FrozenQuestion[]; keys: FrozenKey[] } {
  // A JSON round trip drops undefined fields, so what is stored is exactly what was checked.
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  return {
    questions: exam.map((e) =>
      clone({
        topicId: e.topicId,
        level: e.level,
        points: e.points,
        prompt: e.q.prompt,
        expression: e.q.expression,
        visual: e.q.visual,
        wordProblem: e.q.wordProblem,
        input: inputSpec(e.q.answer),
      }),
    ),
    keys: exam.map((e) => clone({ answer: e.q.answer, solution: e.q.solution })),
  };
}

/**
 * A stand-in Answer that lets the child's device draw the usual answer widget (AnswerInput) from the
 * input spec alone. Its "correct" fields are placeholders and are never used to check anything.
 */
export function standIn(s: AnswerInputSpec): Answer {
  switch (s.kind) {
    case 'number':
      return { kind: 'number', value: NaN, ...(s.unit ? { unit: s.unit } : {}) };
    case 'fraction':
      return { kind: 'fraction', num: 0, den: 1, ...(s.form ? { form: s.form } : {}), allowWhole: s.showWhole };
    case 'choice':
      return { kind: 'choice', options: s.options, correct: -1 };
    case 'compare':
      return { kind: 'compare', correct: '=' };
    case 'divRem':
      return { kind: 'divRem', q: NaN, r: NaN };
    case 'multi':
      return { kind: 'multi', options: s.options, correct: [] };
    case 'order':
      return { kind: 'order', items: s.items, start: s.items.map((_, i) => i) };
    case 'match':
      return { kind: 'match', pairs: s.lefts.map((l) => [l, ''] as [RichText, RichText]), rights: s.rights };
    case 'text':
      return { kind: 'text', accept: [] };
  }
}

/** The child's answer as the real Answer expects it (an order answer indexes the shown order). */
export function toKeyAnswer(user: UserAnswer, key: Answer): UserAnswer {
  if (user.kind === 'order' && key.kind === 'order') return { kind: 'order', seq: user.seq.map((d) => key.start[d] ?? -1) };
  return user;
}

export interface Mark {
  answered: boolean;
  correct: boolean;
  note?: string;
}

/** An answer as uploaded: null for a question left blank. */
export type SubmittedAnswer = UserAnswer | null;

/** Score a submitted test with the app's own checker: points per question, out of 100. */
export function scoreFrozen(questions: FrozenQuestion[], keys: FrozenKey[], answers: SubmittedAnswer[]): { score: number; correct: number; marks: Mark[] } {
  const marks = questions.map((_, i): Mark => {
    const u = answers[i];
    const k = keys[i];
    if (!u || !k || !isComplete(u)) return { answered: false, correct: false };
    const r = checkAnswer(k.answer, toKeyAnswer(u, k.answer));
    return { answered: true, correct: r.correct, ...(r.note ? { note: r.note } : {}) };
  });
  return {
    score: Math.min(100, questions.reduce((s, q, i) => s + (marks[i].correct ? q.points : 0), 0)),
    correct: marks.filter((m) => m.correct).length,
    marks,
  };
}
