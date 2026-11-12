import type { Answer } from './types';
import { gcd } from './math';

export type UserAnswer =
  | { kind: 'number'; text: string }
  | { kind: 'fraction'; whole: string; num: string; den: string }
  | { kind: 'choice'; index: number }
  | { kind: 'compare'; value: '<' | '>' | '=' }
  | { kind: 'divRem'; q: string; r: string };

export interface CheckResult {
  correct: boolean;
  /** Gentle note when the answer is "almost" right (e.g. not reduced). Counts as wrong. */
  note?: string;
}

/** Parse a number typed by a child: "3.5", "3,5", "1,000", " 12 ". */
export function parseNumber(text: string): number | null {
  let s = text.trim().replace(/\s/g, '').replace('−', '-');
  if (!s) return null;
  if (s.includes('.') && s.includes(',')) s = s.replace(/,/g, '');
  else if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s);
}

const intOrNull = (t: string) => {
  const s = t.trim();
  if (!s) return null;
  return /^\d+$/.test(s) ? Number(s) : NaN;
};

export function isComplete(user: UserAnswer): boolean {
  switch (user.kind) {
    case 'number':
      return user.text.trim() !== '';
    case 'fraction':
      return user.num.trim() !== '' && user.den.trim() !== '' || (user.whole.trim() !== '' && user.num.trim() === '' && user.den.trim() === '');
    case 'divRem':
      return user.q.trim() !== '' && user.r.trim() !== '';
    default:
      return true;
  }
}

export function checkAnswer(answer: Answer, user: UserAnswer): CheckResult {
  switch (answer.kind) {
    case 'number': {
      if (user.kind !== 'number') return { correct: false };
      const v = parseNumber(user.text);
      if (v === null) return { correct: false, note: 'זה לא נראה כמו מספר' };
      return { correct: Math.abs(v - answer.value) < 1e-6 };
    }
    case 'choice':
      return { correct: user.kind === 'choice' && user.index === answer.correct };
    case 'compare':
      return { correct: user.kind === 'compare' && user.value === answer.correct };
    case 'divRem': {
      if (user.kind !== 'divRem') return { correct: false };
      return { correct: intOrNull(user.q) === answer.q && intOrNull(user.r) === answer.r };
    }
    case 'fraction': {
      if (user.kind !== 'fraction') return { correct: false };
      const w = intOrNull(user.whole) ?? 0;
      const n = intOrNull(user.num) ?? 0;
      const dRaw = intOrNull(user.den);
      if (Number.isNaN(w) || Number.isNaN(n) || Number.isNaN(dRaw)) return { correct: false, note: 'כתבו רק מספרים שלמים בתיבות' };
      const onlyWhole = user.num.trim() === '' && user.den.trim() === '';
      const d = onlyWhole ? 1 : dRaw;
      if (!d) return { correct: false, note: 'המכנה לא יכול להיות 0' };
      const equal = (w * d + n) * answer.den === answer.num * d;
      if (!equal) return { correct: false };
      const form = answer.form ?? 'any';
      if (form === 'simplest' && !onlyWhole && gcd(n, d) !== 1)
        return { correct: false, note: 'התשובה שווה, אבל אפשר עוד לצמצם 🙂' };
      if (form === 'mixed') {
        const isWholeAnswer = answer.num % answer.den === 0;
        if (!isWholeAnswer && (n >= d || w === 0)) return { correct: false, note: 'הערך נכון, אבל צריך לכתוב כמספר מעורב (שלם + שבר קטן מ-1)' };
        if (!onlyWhole && n > 0 && gcd(n, d) !== 1) return { correct: false, note: 'הערך נכון, אבל אפשר לצמצם את השבר' };
      }
      return { correct: true };
    }
  }
}
