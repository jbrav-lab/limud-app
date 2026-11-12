import type { Level, Question, Topic } from '../engine/types';
import { choice, cmp, fixed, fmt, fr, pick, randInt, shuffle, simplify, chance } from '../engine/math';

const UNIT = 'decimals';
const PLACE = ['עשיריות', 'מאיות', 'אלפיות'];

/** n units of 10^-places, e.g. dec(273, 2) = 2.73 (exact-ish, formatted via fmt). */
const dec = (n: number, places: number) => n / 10 ** places;

/* ---------------- א5. משמעות השבר העשרוני ---------------- */

function meaningQ(level: Level): Question {
  if (level === 1) {
    const kind = pick(['grid', 'words', 'fromFrac'] as const);
    if (kind === 'grid') {
      const n = randInt(1, 99);
      return {
        prompt: 'הריבוע הגדול הוא שלם אחד, מחולק ל-100 משבצות. איזה מספר עשרוני מתאר את החלק הצבוע?',
        visual: { type: 'decimalGrid', shaded: n },
        answer: { kind: 'number', value: dec(n, 2) },
        hint: 'כל משבצת היא מאית אחת (0.01). כל עמודה שלמה היא עשירית (0.1).',
        solution: [`צבועות ${n} משבצות מתוך 100, כלומר ${n} מאיות.`, `[[${fr(n, 100)} = ${fixed(dec(n, 2), 2)}]]`],
      };
    }
    if (kind === 'words') {
      const t = randInt(0, 9);
      const h = randInt(1, 9);
      const w = randInt(0, 5);
      const v = w + t / 10 + h / 100;
      const words = `${w ? `${w} שלמים, ` : ''}${t} עשיריות ו-${h} מאיות`;
      return {
        prompt: `כתבו כמספר עשרוני: **${words}**`,
        answer: { kind: 'number', value: v },
        hint: 'הספרה הראשונה אחרי הנקודה – עשיריות, השנייה – מאיות.',
        solution: [`שלמים: ${w}, עשיריות: ${t}, מאיות: ${h}.`, `[[${fixed(v, 2)}]]`],
      };
    }
    const p = pick([1, 2] as const);
    const den = 10 ** p;
    const n = randInt(1, den - 1);
    return {
      prompt: 'כתבו כמספר עשרוני:',
      expression: fr(n, den),
      answer: { kind: 'number', value: dec(n, p) },
      hint: p === 1 ? 'מכנה 10 – ספרה אחת אחרי הנקודה.' : 'מכנה 100 – שתי ספרות אחרי הנקודה.',
      solution: [`[[${fr(n, den)} = ${fixed(dec(n, p), p)}]] (${n} ${PLACE[p - 1]}).`],
    };
  }
  if (level === 2) {
    const kind = pick(['placeValue', 'howManyHundredths', 'equalZeros'] as const);
    if (kind === 'placeValue') {
      const digits = [randInt(1, 9), randInt(0, 9), randInt(0, 9), randInt(0, 9)];
      const pos = randInt(1, 3); // index into digits after the whole digit
      // make chosen digit unique & non-zero
      const d = randInt(1, 9);
      digits[pos] = d;
      for (let i = 0; i < 4; i++) if (i !== pos && digits[i] === d) digits[i] = 0;
      const num = `${digits[0]}.${digits[1]}${digits[2]}${digits[3]}`;
      const correct = `${d} ${PLACE[pos - 1]}`;
      return {
        prompt: `מה הערך של הספרה ${d} במספר [[${num}]]?`,
        answer: choice(correct, [`${d} יחידות`, ...PLACE.map((p) => `${d} ${p}`)]),
        hint: 'אחרי הנקודה: מקום ראשון – עשיריות, שני – מאיות, שלישי – אלפיות.',
        solution: [`הספרה ${d} נמצאת במקום ה-${pos} אחרי הנקודה – מקום ה${PLACE[pos - 1]}.`],
      };
    }
    if (kind === 'howManyHundredths') {
      const n = randInt(11, 99);
      return {
        prompt: `[[${fixed(dec(n, 2), 2)}]] הם כמה מאיות?`,
        answer: { kind: 'number', value: n },
        hint: `[[0.01]] היא מאית אחת. כמה מאיות יש ב-[[${fixed(dec(n, 2), 2)}]]?`,
        solution: [`[[${fixed(dec(n, 2), 2)} = ${fr(n, 100)}]], כלומר ${n} מאיות (${Math.floor(n / 10)} עשיריות ו-${n % 10} מאיות).`],
      };
    }
    const a = randInt(1, 9);
    const b = randInt(1, 9);
    const base = `0.${a}${b}`;
    const same = `0.${a}${b}0`;
    const diffs = [`0.${a}0${b}`, `0.0${a}${b}`, `${a}.${b}`];
    return {
      prompt: `איזה מספר **שווה** ל-[[${base}]]?`,
      answer: choice(`[[${same}]]`, diffs.map((d) => `[[${d}]]`)),
      hint: 'אפס בסוף החלק העשרוני לא משנה את הערך. אפס באמצע – כן משנה!',
      solution: [`[[${base} = ${same}]] – בשניהם ${a} עשיריות ו-${b} מאיות.`],
    };
  }
  // level 3
  const kind = pick(['toFraction', 'percentOf', 'percentFrac', 'thousandths'] as const);
  if (kind === 'toFraction') {
    const p = pick([1, 2] as const);
    const den = 10 ** p;
    let n = randInt(1, den - 1);
    if (n % 10 === 0 && p === 2) n++;
    const [sn, sd] = simplify(n, den);
    return {
      prompt: 'כתבו כשבר פשוט מצומצם:',
      expression: fixed(dec(n, p), p),
      answer: { kind: 'fraction', num: sn, den: sd, form: 'simplest' },
      hint: `כתבו קודם כשבר עם מכנה ${den}, ואז צמצמו.`,
      solution: [`[[${fixed(dec(n, p), p)} = ${fr(n, den)}]]`, ...(sd !== den ? [`צמצום: [[${fr(n, den)} = ${fr(sn, sd)}]]`] : [])],
    };
  }
  if (kind === 'percentOf') {
    const pct = pick([50, 25, 10]);
    const base = pct === 25 ? randInt(2, 20) * 4 : pct === 50 ? randInt(2, 40) * 2 : randInt(2, 30) * 10;
    return {
      prompt: `כמה זה ${pct}% מ-${base}?`,
      answer: { kind: 'number', value: (base * pct) / 100 },
      hint: pct === 50 ? '50% זה חצי.' : pct === 25 ? '25% זה רבע.' : '10% זה עשירית.',
      solution: [`${pct}% = [[${fr(pct, 100)} = ${pct === 50 ? '{1/2}' : pct === 25 ? '{1/4}' : '{1/10}'}]]`, `[[${base} : ${100 / pct} = ${(base * pct) / 100}]]`],
    };
  }
  if (kind === 'percentFrac') {
    const pct = pick([50, 25, 10, 75]);
    const map: Record<number, string> = { 50: '{1/2}', 25: '{1/4}', 10: '{1/10}', 75: '{3/4}' };
    return {
      prompt: `איזה שבר שווה ל-${pct}%?`,
      answer: choice(`[[${map[pct]}]]`, Object.values(map).filter((x) => x !== map[pct]).map((x) => `[[${x}]]`).concat(`[[{1/${pct}}]]`)),
      hint: `אחוז הוא מאית: ${pct}% = [[${fr(pct, 100)}]]. צמצמו.`,
      solution: [`[[${pct}% = ${fr(pct, 100)} = ${map[pct]}]]`],
    };
  }
  const n = randInt(1, 999);
  const v = dec(n, 3);
  return {
    prompt: `כתבו כמספר עשרוני:`,
    expression: fr(n, 1000),
    answer: { kind: 'number', value: v },
    hint: 'מכנה 1000 – שלוש ספרות אחרי הנקודה (אפשר להוסיף אפסים משמאל).',
    solution: [`[[${fr(n, 1000)} = ${fixed(v, 3)}]] (${n} ${PLACE[2]}).`],
  };
}

/* ---------------- א6. השוואה ועיגול ---------------- */

function compareQ(level: Level): Question {
  if (level === 1) {
    const p = pick([1, 2]);
    const a = randInt(1, 10 ** p * 3);
    let b = randInt(1, 10 ** p * 3);
    if (chance(0.1)) b = a;
    const A = fixed(dec(a, p), p);
    const B = fixed(dec(b, p), p);
    return {
      prompt: 'השלימו את הסימן: [[> , < , =]]',
      expression: `${A} ? ${B}`,
      answer: { kind: 'compare', correct: cmp(a, b) },
      hint: 'משווים קודם את השלמים, אחר כך את העשיריות, ואז את המאיות.',
      solution: [`[[${A} ${cmp(a, b)} ${B}]]`],
    };
  }
  if (level === 2) {
    if (chance(0.6)) {
      // classic trap: different number of digits (0.5 vs 0.35, 0.12 vs 0.9)
      const t = randInt(1, 9);
      const h = randInt(10, 99);
      const A = `0.${t}`;
      const B = fixed(dec(h, 2), 2);
      const [x, y] = chance(0.5) ? [A, B] : [B, A];
      const r = cmp(Number(x), Number(y));
      return {
        prompt: 'השלימו את הסימן: [[> , < , =]]',
        expression: `${x} ? ${y}`,
        answer: { kind: 'compare', correct: r },
        hint: `השלימו אפס כדי שיהיה אותו מספר ספרות: [[0.${t} = 0.${t}0]].`,
        solution: [`[[0.${t} = 0.${t}0]] – ${t * 10} מאיות. [[${B}]] – ${h} מאיות.`, `[[${x} ${r} ${y}]]`],
        };
    }
    const n = randInt(101, 999);
    const v = dec(n, 2);
    const r = Math.round(n / 10) / 10;
    return {
      prompt: `עגלו לעשיריות:`,
      expression: fixed(v, 2),
      answer: { kind: 'number', value: r },
      hint: 'מסתכלים על ספרת המאיות: 5 ומעלה – מעגלים למעלה, פחות מ-5 – למטה.',
      solution: [`ספרת המאיות היא ${n % 10}, ${n % 10 >= 5 ? 'לכן מעגלים למעלה' : 'לכן מעגלים למטה'}.`, `[[${fixed(v, 2)} ≈ ${fixed(r, 1)}]]`],
    };
  }
  const kind = pick(['order', 'between', 'roundWhole'] as const);
  if (kind === 'order') {
    const vals = shuffle([
      fixed(dec(randInt(1, 9), 1), 1),
      fixed(dec(randInt(10, 99), 2), 2),
      fixed(dec(randInt(1, 9), 2), 2),
      fixed(dec(randInt(100, 999), 3), 3),
    ]);
    if (new Set(vals.map(Number)).size < 4) return compareQ(level);
    const big = chance(0.5);
    const target = vals.reduce((m, x) => (big ? (Number(x) > Number(m) ? x : m) : Number(x) < Number(m) ? x : m));
    return {
      prompt: `איזה מספר הוא ה${big ? 'גדול' : 'קטן'} ביותר?`,
      answer: { kind: 'choice', options: vals.map((v) => `[[${v}]]`), correct: vals.indexOf(target) },
      hint: 'כתבו את כולם עם 3 ספרות אחרי הנקודה (הוסיפו אפסים) והשוו.',
      solution: [vals.map((v) => `[[${v} = ${Number(v).toFixed(3)}]]`).join(' , '), `ה${big ? 'גדול' : 'קטן'} ביותר: [[${target}]].`],
    };
  }
  if (kind === 'between') {
    const hiT = randInt(3, 9);
    const hiV = hiT * 10; // in hundredths
    const lo = randInt(Math.max(11, hiV - 40), hiV - 3);
    const loS = fixed(dec(lo, 2), 2);
    const hiS = `0.${hiT}`;
    const good = fixed(dec(randInt(lo + 1, hiV - 1), 2), 2);
    const bad = [fixed(dec(lo - randInt(1, Math.min(9, lo - 1)), 2), 2), fixed(dec(hiV + randInt(1, 9), 2), 2), `0.0${randInt(1, 9)}`];
    return {
      prompt: `איזה מספר נמצא בין [[${loS}]] ל-[[${hiS}]]?`,
      answer: choice(`[[${good}]]`, bad.map((b) => `[[${b}]]`)),
      hint: `[[${hiS} = ${hiS}0]]. חפשו מספר מאיות בין ${lo} ל-${hiV}.`,
      solution: [`[[${loS} < ${good} < ${hiS}]]`],
    };
  }
  const n = randInt(1001, 9999);
  const v = dec(n, 2);
  return {
    prompt: 'עגלו למספר השלם הקרוב:',
    expression: fixed(v, 2),
    answer: { kind: 'number', value: Math.round(v) },
    hint: 'מסתכלים על ספרת העשיריות.',
    solution: [`ספרת העשיריות היא ${Math.floor(n / 10) % 10}.`, `[[${fixed(v, 2)} ≈ ${Math.round(v)}]]`],
  };
}

/* ---------------- א6. חיבור וחיסור עשרוניים ---------------- */

function addsubQ(level: Level): Question {
  if (level === 3 && chance(0.3)) {
    // estimation: which exercise result is bigger than 10
    const ex: { s: string; v: number }[] = [];
    while (ex.length < 4) {
      const a = randInt(100, 900) / 100;
      const b = randInt(10, 600) / 100;
      const plus = chance(0.6);
      const v = plus ? a + b : a + 6 - b;
      const s = plus ? `${fixed(a, 2)} + ${fixed(b, 2)}` : `${fixed(a + 6, 2)} - ${fixed(b, 2)}`;
      if (Math.abs(v - 10) > 0.3) ex.push({ s, v });
    }
    const bigs = ex.filter((e) => e.v > 10);
    if (bigs.length !== 1) return addsubQ(level);
    return {
      prompt: 'בלי לחשב בדיוק: לאיזה תרגיל יש תוצאה **גדולה מ-10**?',
      answer: { kind: 'choice', options: ex.map((e) => `[[${e.s}]]`), correct: ex.indexOf(bigs[0]) },
      hint: 'עגלו כל מספר לשלם הקרוב וחשבו בראש.',
      solution: ex.map((e) => `[[${e.s} ≈ ${fmt(Math.round(e.v * 10) / 10)}]]`),
    };
  }
  const p1 = level === 1 ? 1 : randInt(1, 2);
  const p2 = level === 1 ? 1 : level === 2 ? 2 : randInt(1, 3);
  const plus = chance(0.5);
  const maxW = level === 1 ? 5 : level === 2 ? 10 : 20;
  let a = randInt(1, maxW * 10 ** p1) / 10 ** p1;
  let b = randInt(1, maxW * 10 ** p2) / 10 ** p2;
  if (level === 3 && !plus && chance(0.5)) a = Math.round(a); // subtraction from a whole: 3 - 0.45
  if (!plus && a < b) [a, b] = [b, a];
  const r = Math.round((plus ? a + b : a - b) * 1000) / 1000;
  const P = Math.max(p1, p2, level === 3 ? 2 : 1);
  const op = plus ? '+' : '-';
  return {
    prompt: 'פתרו:',
    expression: `${fmt(a)} ${op} ${fmt(b)} = ?`,
    answer: { kind: 'number', value: r },
    hint: 'כתבו במאונך: נקודה מתחת לנקודה, ספרות מאותו מקום זו מתחת לזו. אפשר להוסיף אפסים בסוף.',
    solution: [
      'נכתוב עם אותו מספר ספרות אחרי הנקודה:',
      `[[${fixed(a, P)} ${op} ${fixed(b, P)} = ${fixed(r, P)}]]`,
      plus ? `בדיקה: [[${fixed(r, P)} - ${fixed(b, P)} = ${fixed(a, P)}]] ✓` : `בדיקה: [[${fixed(r, P)} + ${fixed(b, P)} = ${fixed(a, P)}]] ✓`,
    ],
  };
}

/* ---------------- א7. מעבר משבר פשוט לעשרוני ---------------- */

function toDecimalQ(level: Level): Question {
  if (level === 1) {
    const p = pick([1, 2, 3]);
    const den = 10 ** p;
    const n = randInt(1, den * 2 - 1);
    return {
      prompt: 'כתבו כמספר עשרוני:',
      expression: fr(n, den),
      answer: { kind: 'number', value: dec(n, p) },
      hint: `מכנה ${den} – ${p} ספרות אחרי הנקודה.`,
      solution: [`[[${fr(n, den)} = ${fixed(dec(n, p), p)}]]`],
    };
  }
  const dens = level === 2 ? [2, 4, 5, 20, 25, 50] : [8, 40, 125, 250, 200, 4, 20];
  const d = pick(dens);
  const target = [10, 100, 1000].find((t) => t % d === 0)!;
  const k = target / d;
  const p = String(target).length - 1;
  const n = randInt(1, d - 1);
  const w = level === 3 && chance(0.4) ? randInt(1, 5) : 0;
  const v = w + (n * k) / target;
  return {
    prompt: 'כתבו כמספר עשרוני:',
    expression: w ? `{${w} ${n}/${d}}` : fr(n, d),
    answer: { kind: 'number', value: v },
    hint: `הרחיבו את השבר כך שהמכנה יהיה ${target}: פי ${k}.`,
    solution: [`[[${fr(n, d)} = {${n} × ${k}/${d} × ${k}} = ${fr(n * k, target)} = ${fixed((n * k) / target, p)}]]`, ...(w ? [`ועם השלמים: [[${fixed(v, p)}]]`] : [])],
  };
}

export const decimalTopics: Topic[] = [
  {
    id: 'decimal-meaning',
    unit: UNIT,
    title: 'מהו מספר עשרוני? ואחוזים',
    emoji: '🔢',
    lesson: [
      { kind: 'text', text: 'המספר העשרוני ממשיך את שיטת הספירה שלנו. **הנקודה העשרונית** מפרידה בין השלמים (משמאל) לבין החלקים (מימין).' },
      { kind: 'example', text: 'במספר [[3.472]]:', expression: '3 שלמים  .  4 עשיריות  7 מאיות  2 אלפיות' },
      { kind: 'visual', visual: { type: 'decimalGrid', shaded: 73 }, caption: '[[0.73]] – 73 מאיות = 7 עשיריות ו-3 מאיות' },
      { kind: 'text', text: '[[0.1 = {1/10}]] , [[0.01 = {1/100}]] , [[0.001 = {1/1000}]]' },
      { kind: 'tip', text: 'אפס בסוף לא משנה: [[0.73 = 0.730]]. אבל [[0.703]] זה מספר אחר!' },
      { kind: 'text', text: '**אחוז** הוא שם אחר למאית: [[1% = {1/100}]]. [[50% = {1/2}]], [[25% = {1/4}]], [[10% = {1/10}]].' },
    ],
    generate: meaningQ,
  },
  {
    id: 'decimal-compare',
    unit: UNIT,
    title: 'השוואה ועיגול עשרוניים',
    emoji: '📏',
    lesson: [
      { kind: 'text', text: 'משווים **מקום אחרי מקום**: קודם השלמים, אחר כך העשיריות, אחר כך המאיות.' },
      { kind: 'example', text: 'מה גדול יותר, [[0.9]] או [[0.12]]?', expression: '0.90 > 0.12' },
      { kind: 'tip', text: 'מלכודת! מספר עם יותר ספרות **לא** תמיד גדול יותר. הוסיפו אפסים כדי שיהיה אותו אורך.' },
      { kind: 'text', text: '**עיגול לעשיריות**: מסתכלים על ספרת המאיות. 5 ומעלה – מעלים, פחות מ-5 – משאירים.' },
      { kind: 'example', text: '', expression: '3.47 ≈ 3.5     ,     0.12 ≈ 0.1' },
    ],
    generate: compareQ,
  },
  {
    id: 'decimal-addsub',
    unit: UNIT,
    title: 'חיבור וחיסור עשרוניים',
    emoji: '🧮',
    lesson: [
      { kind: 'text', text: 'כותבים במאונך כך ש**הנקודה מתחת לנקודה** – ואז עשיריות מתחת לעשיריות, מאיות מתחת למאיות.' },
      { kind: 'example', text: 'חסר מקום? מוסיפים אפס:', expression: '3.08 - 1.2  →  3.08 - 1.20 = 1.88' },
      { kind: 'example', text: 'חיסור משלם:', expression: '8 - 0.05  →  8.00 - 0.05 = 7.95' },
      { kind: 'tip', text: 'בדיקה: אחרי חיסור – חברו את התוצאה עם המחסר. צריך לקבל את המספר הראשון.' },
      { kind: 'tip', text: 'אומדן: עגלו לשלמים ובדקו שהתשובה הגיונית.' },
    ],
    generate: addsubQ,
  },
  {
    id: 'fraction-to-decimal',
    unit: UNIT,
    title: 'משבר פשוט לעשרוני',
    emoji: '🔄',
    lesson: [
      { kind: 'text', text: 'שבר עם מכנה 10, 100 או 1000 קל לכתוב כעשרוני: [[{7/10} = 0.7]], [[{23/100} = 0.23]], [[{5/1000} = 0.005]].' },
      { kind: 'text', text: 'אם המכנה אחר – **מרחיבים** אותו ל-10, 100 או 1000.' },
      { kind: 'example', text: '', expression: '{3/4} = {75/100} = 0.75' },
      { kind: 'example', text: '', expression: '{1/5} = {2/10} = 0.2' },
      { kind: 'example', text: '', expression: '{3/8} = {375/1000} = 0.375' },
      { kind: 'tip', text: 'כדאי לזכור: [[{1/2} = 0.5]] , [[{1/4} = 0.25]] , [[{3/4} = 0.75]] , [[{1/5} = 0.2]].' },
    ],
    generate: toDecimalQ,
  },
];
