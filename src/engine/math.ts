export const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

export function simplify(n: number, d: number): [number, number] {
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}

/** Fraction markup: {n/d}. If n >= d and mixed=true -> {w n/d} or whole number. */
export function fr(n: number, d: number, mixed = false): string {
  if (mixed && n >= d) {
    const w = Math.floor(n / d);
    const r = n % d;
    return r === 0 ? `${w}` : `{${w} ${r}/${d}}`;
  }
  return `{${n}/${d}}`;
}

/** Round away floating point noise and print with "." decimal point, thousands with ",". */
export function fmt(x: number, thousands = true): string {
  const r = Math.round(x * 1e6) / 1e6;
  const [i, f] = String(Math.abs(r)).split('.');
  const intPart = thousands && i.length > 4 ? i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : i;
  return (r < 0 ? '-' : '') + intPart + (f ? '.' + f : '');
}

/** Fixed-decimals formatting for vertical arithmetic explanations (e.g. 3.1 -> "3.10"). */
export const fixed = (x: number, digits: number) => (Math.round(x * 10 ** digits) / 10 ** digits).toFixed(digits);

export const decimalsOf = (x: number) => {
  const s = fmt(x, false);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};

/** Build a multiple-choice answer from a correct option and distractors (deduplicated, shuffled). */
export function choice(correct: string, distractors: string[], max = 4) {
  const uniq = [...new Set(distractors.filter((d) => d !== correct))].slice(0, max - 1);
  const options = shuffle([correct, ...uniq]);
  return { kind: 'choice' as const, options, correct: options.indexOf(correct) };
}

export const cmp = (a: number, b: number): '<' | '>' | '=' =>
  Math.abs(a - b) < 1e-9 ? '=' : a < b ? '<' : '>';

/* ---------- fractions in Hebrew words ---------- */

const MASC = ['', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה', 'אחד-עשר', 'שנים-עשר'];
const FEM = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר', 'אחת-עשרה', 'שתים-עשרה'];
// [one part, plural, gender of the part noun]
const PARTS: Record<number, [string, string, 'm' | 'f']> = {
  2: ['חצי', 'חצאים', 'm'],
  3: ['שליש', 'שלישים', 'm'],
  4: ['רבע', 'רבעים', 'm'],
  5: ['חמישית', 'חמישיות', 'f'],
  6: ['שישית', 'שישיות', 'f'],
  7: ['שביעית', 'שביעיות', 'f'],
  8: ['שמינית', 'שמיניות', 'f'],
  9: ['תשיעית', 'תשיעיות', 'f'],
  10: ['עשירית', 'עשיריות', 'f'],
};

/** Hebrew words for a proper fraction: 1/2 "חצי", 3/4 "שלושה רבעים", 2/5 "שתי חמישיות", 5/12 "חמישה חלקים מתוך שנים-עשר". */
export function fracWords(n: number, d: number): string {
  const part = PARTS[d];
  if (part) {
    const [one, many, g] = part;
    if (n === 1) return one;
    const num = g === 'm' ? MASC[n] : FEM[n];
    // "two" before a noun takes the construct form: שני / שתי
    const counted = n === 2 ? (g === 'm' ? 'שני' : 'שתי') : num;
    return `${counted} ${many}`;
  }
  return n === 1 ? `חלק אחד מתוך ${MASC[d] ?? d}` : `${MASC[n] ?? n} חלקים מתוך ${MASC[d] ?? d}`;
}

/**
 * A fraction for a word problem: in words, then the number in parentheses, e.g. "חצי ([[{1/2}]])".
 * mixed=true writes values > 1 as a mixed number: "שלושה ורבע ([[{3 1/4}]])".
 */
export function frBoth(n: number, d: number, mixed = false): string {
  const w = Math.floor(n / d);
  const r = n % d;
  if (mixed && w > 0) {
    const whole = MASC[w] ?? String(w);
    const words = r === 0 ? whole : `${whole} ו${fracWords(r, d)}`;
    return `${words} ([[${fr(n, d, true)}]])`;
  }
  return `${fracWords(n, d)} ([[${fr(n, d)}]])`;
}

const PEOPLE:[string, 'm' | 'f'][] = [
  ['רנה', 'f'], ['דן', 'm'], ['מאיה', 'f'], ['יואב', 'm'], ['שירה', 'f'], ['איתי', 'm'],
  ['נועם', 'm'], ['תמר', 'f'], ['גלעד', 'm'], ['נועה', 'f'], ['אורי', 'm'], ['הילה', 'f'],
];
/** A random child name; v(male, female) picks the matching Hebrew form. */
export function person() {
  const [name, g] = pick(PEOPLE);
  return { name, v: (m: string, f: string) => (g === 'm' ? m : f) };
}

export const sum =(xs: number[]) => xs.reduce((s, x) => s + x, 0);
