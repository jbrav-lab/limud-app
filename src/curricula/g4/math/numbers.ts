import type { Level, Question, Topic } from '../../../engine/types';
import { choice, chance, cmp, fmt, fr, frBoth, person, pick, randInt } from '../../../engine/math';

/* =====================================================================
   Unit: fractions (פרק א – השבר הפשוט)
   ===================================================================== */

function fractionPartsQ(level: Level): Question {
  if (level === 1) {
    const d = randInt(2, 8), n = randInt(1, d - 1);
    return {
      prompt: 'איזה חלק מהפס צבוע?',
      visual: { type: 'fractionBar', parts: d, shaded: n },
      answer: { kind: 'fraction', num: n, den: d },
      hint: 'המכנה – לכמה חלקים שווים חילקו את השלם. המונה – כמה חלקים צבועים.',
      solution: [`הפס מחולק ל־${d} חלקים שווים, ו־${n} מהם צבועים.`, `החלק הצבוע: [[${fr(n, d)}]]`],
    };
  }
  if (level === 2) {
    const d = pick([2, 3, 4, 5, 10]), k = randInt(2, 9), total = d * k;
    const p = person();
    const thing = pick(['סוכריות', 'מדבקות', 'גולות', 'עוגיות']);
    return {
      prompt: `ל${p.name} היו ${total} ${thing}. ${p.v('הוא נתן', 'היא נתנה')} ${frBoth(1, d)} מהן ${p.v('לחברו', 'לחברתה')}. כמה ${thing} ${p.v('נתן', 'נתנה')}?`,
      answer: { kind: 'number', value: k },
      hint: `כדי למצוא חלק אחד מתוך ${d}, מחלקים את ${total} ל־${d} קבוצות שוות.`,
      solution: [`[[${total} : ${d} = ${k}]]`],
      wordProblem: true,
    };
  }
  if (chance(0.5)) {
    const d = pick([3, 4, 5, 6, 8, 10]), n = randInt(2, d - 1), k = randInt(2, 8), total = d * k;
    const p = person();
    return {
      prompt: `בכיתה של ${p.name} יש ${total} תלמידים. ${frBoth(n, d)} מהם הגיעו ברגל. כמה תלמידים הגיעו ברגל?`,
      answer: { kind: 'number', value: n * k },
      hint: `קודם מוצאים חלק אחד: [[${total} : ${d}]]. אחר כך כופלים ב־${n}.`,
      solution: [`חלק אחד: [[${total} : ${d} = ${k}]]`, `${n} חלקים: [[${k} × ${n} = ${n * k}]]`],
      wordProblem: true,
    };
  }
  const d = pick([2, 3, 4, 5, 6, 8]), n = randInt(1, 2 * d - 1);
  if (n === d) return fractionPartsQ(level);
  return {
    prompt: 'איזה מספר מסומן על ישר המספרים? (כתבו כשבר)',
    visual: { type: 'numberLine', min: 0, max: 2, ticksPerUnit: d, markAt: n / d, labels: true },
    answer: { kind: 'fraction', num: n, den: d, allowWhole: true },
    hint: `כל שלם מחולק ל־${d} חלקים שווים. ספרו את הקפיצות מ־0.`,
    solution: [`כל קפיצה היא [[${fr(1, d)}]].`, `${n} קפיצות מ־0: [[${fr(n, d)}${n > d ? ` = ${fr(n, d, true)}` : ''}]]`],
  };
}

function fractionCompareQ(level: Level): Question {
  if (level === 1) {
    const d = randInt(3, 10);
    let a = randInt(1, d - 1), b = randInt(1, d - 1);
    if (chance(0.15)) b = a;
    return {
      prompt: 'השוו: בחרו <, > או =',
      expression: `${fr(a, d)}   ?   ${fr(b, d)}`,
      answer: { kind: 'compare', correct: cmp(a / d, b / d) },
      hint: 'כשהמכנים שווים, משווים את המונים.',
      solution: [`לשני השברים אותו מכנה (${d}). משווים מונים: [[${a} ${cmp(a, b)} ${b}]]`, `[[${fr(a, d)} ${cmp(a / d, b / d)} ${fr(b, d)}]]`],
    };
  }
  if (level === 2) {
    if (chance(0.5)) {
      const n = randInt(1, 3), d1 = randInt(n + 1, 10);
      let d2 = randInt(n + 1, 10);
      if (d2 === d1) d2 = d1 === 10 ? 9 : d1 + 1;
      return {
        prompt: 'השוו: בחרו <, > או =',
        expression: `${fr(n, d1)}   ?   ${fr(n, d2)}`,
        answer: { kind: 'compare', correct: cmp(n / d1, n / d2) },
        hint: 'כשהמונים שווים: ככל שהמכנה גדול יותר, כל חלק קטן יותר.',
        solution: [`המונים שווים (${n}). מכנה גדול יותר ← חלקים קטנים יותר.`, `[[${fr(n, d1)} ${cmp(n / d1, n / d2)} ${fr(n, d2)}]]`],
      };
    }
    const d = randInt(2, 9), n = randInt(1, 2 * d);
    return {
      prompt: 'השוו לשלם: בחרו <, > או =',
      expression: `${fr(n, d)}   ?   1`,
      answer: { kind: 'compare', correct: cmp(n / d, 1) },
      hint: `שלם אחד הוא [[${fr(d, d)}]].`,
      solution: [`[[1 = ${fr(d, d)}]]`, `[[${fr(n, d)} ${cmp(n / d, 1)} 1]]`],
    };
  }
  const d = randInt(2, 8), w = randInt(1, 4), r = randInt(1, d - 1), n = w * d + r;
  return {
    prompt: `כתבו את [[${fr(n, d)}]] כמספר מעורב:`,
    answer: { kind: 'fraction', num: n, den: d, form: 'mixed' },
    hint: `כמה שלמים יש ב־[[${fr(n, d)}]]? כל שלם הוא ${d} חלקים.`,
    solution: [`[[${n} : ${d} = ${w}]] ושארית ${r}`, `[[${fr(n, d)} = ${fr(n, d, true)}]]`],
  };
}

function fractionAddSubQ(level: Level): Question {
  if (level === 1) {
    const d = randInt(3, 10), a = randInt(1, d - 2), b = randInt(1, d - 1 - a);
    return {
      prompt: 'פתרו:',
      expression: `${fr(a, d)} + ${fr(b, d)} = ?`,
      answer: { kind: 'fraction', num: a + b, den: d },
      hint: 'במכנים שווים מחברים רק את המונים. המכנה נשאר.',
      solution: [`[[${a} + ${b} = ${a + b}]]`, `[[${fr(a, d)} + ${fr(b, d)} = ${fr(a + b, d)}]]`],
    };
  }
  if (level === 2) {
    const d = randInt(3, 10);
    if (chance(0.5)) {
      const a = randInt(2, d - 1), b = randInt(1, a - 1);
      return {
        prompt: 'פתרו:',
        expression: `${fr(a, d)} - ${fr(b, d)} = ?`,
        answer: { kind: 'fraction', num: a - b, den: d },
        hint: 'במכנים שווים מחסרים רק את המונים.',
        solution: [`[[${a} - ${b} = ${a - b}]]`, `[[${fr(a, d)} - ${fr(b, d)} = ${fr(a - b, d)}]]`],
      };
    }
    const a = randInt(2, d - 1), b = randInt(d - a + 1, d - 1);
    return {
      prompt: 'פתרו (אפשר לכתוב כמספר מעורב):',
      expression: `${fr(a, d)} + ${fr(b, d)} = ?`,
      answer: { kind: 'fraction', num: a + b, den: d, allowWhole: true },
      hint: 'הסכום גדול מ־1. אפשר להשאיר שבר גדול מ־1 או לכתוב מספר מעורב.',
      solution: [`[[${fr(a, d)} + ${fr(b, d)} = ${fr(a + b, d)} = ${fr(a + b, d, true)}]]`],
    };
  }
  const [d1, d2] = pick([[2, 4], [2, 6], [2, 8], [3, 6], [4, 8], [5, 10], [2, 10]] as const);
  const a = 1, b = randInt(1, d2 - 1 - d2 / d1);
  const num = a * (d2 / d1) + b;
  if (chance(0.5)) {
    const p = person();
    return {
      prompt: `${p.name} ${p.v('אכל', 'אכלה')} ${frBoth(a, d1)} מהפיצה, ואחיו אכל ${frBoth(b, d2)} מהפיצה. איזה חלק מהפיצה אכלו יחד?`,
      answer: { kind: 'fraction', num, den: d2 },
      hint: `הרחיבו את [[${fr(a, d1)}]] למכנה ${d2}.`,
      solution: [`[[${fr(a, d1)} = ${fr(d2 / d1, d2)}]]`, `[[${fr(d2 / d1, d2)} + ${fr(b, d2)} = ${fr(num, d2)}]]`],
      wordProblem: true,
    };
  }
  return {
    prompt: 'פתרו:',
    expression: `${fr(a, d1)} + ${fr(b, d2)} = ?`,
    answer: { kind: 'fraction', num, den: d2 },
    hint: `המכנה ${d2} הוא כפולה של ${d1}. הרחיבו את [[${fr(a, d1)}]] למכנה ${d2}.`,
    solution: [`[[${fr(a, d1)} = ${fr(d2 / d1, d2)}]]`, `[[${fr(d2 / d1, d2)} + ${fr(b, d2)} = ${fr(num, d2)}]]`],
  };
}

/* =====================================================================
   Unit: numbers to a million (פרקים ב–ג)
   ===================================================================== */

const PLACE = ['יחידות', 'עשרות', 'מאות', 'אלפים', 'עשרות אלפים', 'מאות אלפים'];

/** A number with `digits` digits and no repeated digit, so "the digit 3" is unambiguous. */
function distinctDigits(digits: number): number[] {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
  const ds = pool.slice(0, digits);
  if (ds[0] === 0) [ds[0], ds[1]] = [ds[1], ds[0]];
  return ds;
}

function placeValueQ(level: Level): Question {
  if (level === 1) {
    const ds = distinctDigits(4);
    const n = Number(ds.join(''));
    const i = randInt(0, 3);
    const digit = ds[i] === 0 ? ds[(i + 1) % 4] : ds[i];
    const pos = ds.length - 1 - ds.indexOf(digit);
    const value = digit * 10 ** pos;
    return {
      prompt: `מה הערך של הספרה **${digit}** במספר [[${fmt(n, false)}]]?`,
      answer: { kind: 'number', value },
      hint: `הספרה ${digit} נמצאת במקום ה${PLACE[pos]}.`,
      solution: [`${digit} במקום ה${PLACE[pos]} ← [[${fmt(value)}]]`],
    };
  }
  if (level === 2) {
    if (chance(0.5)) {
      const ds = Array.from({ length: 6 }, (_, i) => (i === 0 ? randInt(1, 9) : chance(0.25) ? 0 : randInt(1, 9)));
      const parts = ds.map((d, i) => d * 10 ** (5 - i)).filter((x) => x > 0);
      const n = parts.reduce((s, x) => s + x, 0);
      return {
        prompt: 'איזה מספר זה?',
        expression: `${parts.map((x) => fmt(x)).join(' + ')} = ?`,
        answer: { kind: 'number', value: n },
        hint: 'כתבו כל ספרה במקום שלה, ואפס במקום שחסר.',
        solution: [`[[${fmt(n)}]]`],
      };
    }
    const a = randInt(10000, 999999);
    let b = a + pick([-1, 1]) * pick([1, 10, 100, 1000, 10000]);
    if (chance(0.1)) b = a;
    return {
      prompt: 'השוו: בחרו <, > או =',
      expression: `${fmt(a)}   ?   ${fmt(b)}`,
      answer: { kind: 'compare', correct: cmp(a, b) },
      hint: 'משווים ספרה אחרי ספרה, מהמקום הגבוה ביותר.',
      solution: [`[[${fmt(a)} ${cmp(a, b)} ${fmt(b)}]]`],
    };
  }
  if (chance(0.5)) {
    const to = pick([100, 1000, 10000]);
    const n = randInt(1000, 999999);
    const r = Math.round(n / to) * to;
    if (n % to === to / 2) return placeValueQ(level);
    return {
      prompt: `עגלו את [[${fmt(n)}]] ${to === 100 ? 'למאה הקרובה' : to === 1000 ? 'לאלף הקרוב' : 'לעשרת האלפים הקרובה'}:`,
      answer: { kind: 'number', value: r },
      hint: 'מסתכלים על הספרה שאחרי מקום העיגול: 5 ומעלה – מעגלים למעלה.',
      solution: [`[[${fmt(n)} ≈ ${fmt(r)}]]`],
    };
  }
  const n = randInt(1000, 990000), step = pick([1000, 10000, 100]), more = chance(0.5);
  return {
    prompt: `איזה מספר גדול ב־[[${fmt(step)}]] מ־[[${fmt(n)}]]?`.replace('גדול', more ? 'גדול' : 'קטן'),
    answer: { kind: 'number', value: more ? n + step : n - step },
    hint: 'שימו לב לאיזה מקום מוסיפים (או מחסירים) אחד.',
    solution: [`[[${fmt(n)} ${more ? '+' : '-'} ${fmt(step)} = ${fmt(more ? n + step : n - step)}]]`],
  };
}

/* ---------- Hebrew letters as numbers (שיטת האלף־בית) ---------- */

const LETTERS: [string, number][] = [
  ['ת', 400], ['ש', 300], ['ר', 200], ['ק', 100], ['צ', 90], ['פ', 80], ['ע', 70], ['ס', 60], ['נ', 50], ['מ', 40], ['ל', 30], ['כ', 20], ['י', 10],
  ['ט', 9], ['ח', 8], ['ז', 7], ['ו', 6], ['ה', 5], ['ד', 4], ['ג', 3], ['ב', 2], ['א', 1],
];

/** 248 → "רמ״ח", 15 → "ט״ו", 5 → "ה׳". Numbers 1–799. */
export function toHebrewNumeral(n: number): string {
  let rest = n;
  let s = '';
  while (rest >= 400) {
    s += 'ת';
    rest -= 400;
  }
  for (const [l, v] of LETTERS) {
    if (rest === 15) {
      s += 'טו';
      rest = 0;
    } else if (rest === 16) {
      s += 'טז';
      rest = 0;
    }
    if (v < 400 && rest >= v) {
      s += l;
      rest -= v;
    }
  }
  return s.length === 1 ? `${s}׳` : `${s.slice(0, -1)}״${s.slice(-1)}`;
}

function hebrewLettersQ(level: Level): Question {
  if (level === 1) {
    const n = pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400]);
    const h = toHebrewNumeral(n);
    if (chance(0.5)) {
      return {
        prompt: `מה הערך של האות **${h.replace('׳', '')}** בשיטת האלף־בית?`,
        answer: { kind: 'number', value: n },
        hint: 'א–ט: יחידות (1–9), י–צ: עשרות (10–90), ק–ת: מאות (100–400).',
        solution: [`${h} = [[${n}]]`],
      };
    }
    const others = [n + 1, n - 1, n * 10, n / 10, n + 10].filter((x) => Number.isInteger(x) && x >= 1 && x <= 400 && x !== n);
    return {
      prompt: `איזו אות מייצגת את המספר [[${n}]]?`,
      answer: choice(h, others.map(toHebrewNumeral)),
      hint: 'א–ט: יחידות, י–צ: עשרות, ק–ת: מאות.',
      solution: [`[[${n}]] = ${h}`],
    };
  }
  if (level === 2) {
    const n = chance(0.2) ? pick([15, 16]) : randInt(11, 99);
    if (n % 10 === 0) return hebrewLettersQ(level);
    const h = toHebrewNumeral(n);
    if (chance(0.5)) {
      return {
        prompt: `איזה מספר מייצגות האותיות **${h}**?`,
        answer: { kind: 'number', value: n },
        hint: 'מחברים את ערכי האותיות.',
        solution: [`${h} = [[${Math.floor(n / 10) * 10} + ${n % 10} = ${n}]]`, n === 15 || n === 16 ? 'את 15 ו־16 כותבים ט״ו וט״ז, ולא י״ה וי״ו.' : ''].filter(Boolean),
      };
    }
    return {
      prompt: `איך כותבים את [[${n}]] באותיות?`,
      answer: choice(h, [n + 1, n - 1, n + 10, n - 10].filter((x) => x > 0 && x < 100 && x % 10 !== 0).map(toHebrewNumeral)),
      hint: 'קודם העשרות, אחר כך היחידות.',
      solution: [`[[${n}]] = ${h}`],
    };
  }
  if (chance(0.3)) {
    const [word, value] = pick([
      ['תשפ״ז', 787],
      ['תשפ״ו', 786],
      ['תש״ח', 708],
      ['רמ״ח', 248],
      ['תרי״ג', 613],
    ] as const);
    return {
      prompt: `איזה מספר מייצגות האותיות **${word}**?`,
      answer: { kind: 'number', value },
      hint: 'מחברים את ערכי כל האותיות (ת = 400).',
      solution: [`${word} = [[${value}]]`],
    };
  }
  const n = randInt(101, 499);
  const h = toHebrewNumeral(n);
  if (chance(0.5)) {
    return {
      prompt: `איזה מספר מייצגות האותיות **${h}**?`,
      answer: { kind: 'number', value: n },
      hint: 'מאות, עשרות ויחידות – מחברים את ערכי האותיות.',
      solution: [`${h} = [[${n}]]`],
    };
  }
  return {
    prompt: `איך כותבים את [[${n}]] באותיות?`,
    answer: choice(h, [n + 100, n - 100, n + 10, n + 1].filter((x) => x > 100 && x < 500).map(toHebrewNumeral)),
    hint: 'קודם המאות, אחר כך העשרות ובסוף היחידות.',
    solution: [`[[${n}]] = ${h}`],
  };
}

/* =====================================================================
   Unit: operations (פרק ד – פעולות החשבון)
   ===================================================================== */

function addSubQ(level: Level): Question {
  const [lo, hi] = level === 1 ? [100, 9999] : level === 2 ? [1000, 99999] : [10000, 999999];
  if (level === 3 && chance(0.4)) {
    const x = randInt(lo, Math.floor(hi / 2)), a = randInt(lo, Math.floor(hi / 2));
    return {
      prompt: 'איזה מספר חסר?',
      expression: `? + ${fmt(a)} = ${fmt(x + a)}`,
      answer: { kind: 'number', value: x },
      hint: 'המספר החסר = הסכום פחות המחובר שידוע.',
      solution: [`[[${fmt(x + a)} - ${fmt(a)} = ${fmt(x)}]]`],
    };
  }
  const a = randInt(lo, hi), b = randInt(lo, hi);
  if (chance(0.5)) {
    return {
      prompt: 'פתרו (אפשר במאונך):',
      expression: `${fmt(a)} + ${fmt(b)} = ?`,
      answer: { kind: 'number', value: a + b },
      hint: 'כותבים יחידות מתחת ליחידות, עשרות מתחת לעשרות, ומתחילים מימין.',
      solution: [`[[${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}]]`],
    };
  }
  const [big, small] = a >= b ? [a, b] : [b, a];
  return {
    prompt: 'פתרו (אפשר במאונך):',
    expression: `${fmt(big)} - ${fmt(small)} = ?`,
    answer: { kind: 'number', value: big - small },
    hint: 'כשאי אפשר לחסר, "פורטים" עשרת אחת לעשר יחידות.',
    solution: [`[[${fmt(big)} - ${fmt(small)} = ${fmt(big - small)}]]`, `בדיקה: [[${fmt(big - small)} + ${fmt(small)} = ${fmt(big)}]]`],
  };
}

function multiplyQ(level: Level): Question {
  const [a, b] = level === 1 ? [randInt(12, 99), randInt(2, 9)] : level === 2 ? (chance(0.5) ? [randInt(100, 999), randInt(2, 9)] : [randInt(11, 49), randInt(11, 29)]) : [randInt(100, 999), randInt(11, 59)];
  const t = Math.floor(b / 10) * 10, o = b % 10;
  return {
    prompt: 'פתרו (אפשר במאונך):',
    expression: `${a} × ${b} = ?`,
    answer: { kind: 'number', value: a * b },
    hint: b < 10 ? `פרקו את ${a} למאות, עשרות ויחידות וכפלו כל חלק ב־${b}.` : `פרקו: [[${b} = ${t} + ${o}]]. כפלו ב־${t} וב־${o}, ואז חברו.`,
    solution:
      b < 10
        ? [`[[${a} × ${b} = ${fmt(a * b)}]]`]
        : [`[[${a} × ${t} = ${fmt(a * t)}]]`, `[[${a} × ${o} = ${fmt(a * o)}]]`, `[[${fmt(a * t)} + ${fmt(a * o)} = ${fmt(a * b)}]]`],
  };
}

function divideQ(level: Level): Question {
  if (level === 1) {
    const d = randInt(2, 9), q = randInt(11, 99);
    return {
      prompt: 'פתרו:',
      expression: `${d * q} : ${d} = ?`,
      answer: { kind: 'number', value: q },
      hint: 'בדיקה: התוצאה כפול המחלק צריכה לתת את המספר המחולק.',
      solution: [`[[${d * q} : ${d} = ${q}]]`, `בדיקה: [[${q} × ${d} = ${d * q}]]`],
    };
  }
  const d = level === 2 ? randInt(3, 9) : pick([20, 30, 40, 50, 60, 70, 80, 90]);
  const q = level === 2 ? randInt(21, 300) : randInt(3, 30), r = randInt(1, d - 1);
  const n = d * q + r;
  return {
    prompt: 'חלקו וכתבו את המנה ואת השארית:',
    expression: `${fmt(n)} : ${d} = ?`,
    answer: { kind: 'divRem', q, r },
    hint: `השארית תמיד קטנה מ־${d}.`,
    solution: [`[[${q} × ${d} = ${fmt(q * d)}]]`, `[[${fmt(n)} - ${fmt(q * d)} = ${r}]]`, `מנה ${q}, שארית ${r}`],
  };
}

function orderOpsQ(level: Level): Question {
  if (level === 1) {
    const a = randInt(2, 30), b = randInt(2, 9), c = randInt(2, 9);
    return {
      prompt: 'פתרו לפי סדר הפעולות:',
      expression: `${a} + ${b} × ${c} = ?`,
      answer: { kind: 'number', value: a + b * c },
      hint: 'כפל וחילוק קודמים לחיבור וחיסור.',
      solution: [`[[${b} × ${c} = ${b * c}]]`, `[[${a} + ${b * c} = ${a + b * c}]]`],
    };
  }
  if (level === 2) {
    const a = randInt(2, 15), b = randInt(2, 15), c = randInt(2, 9);
    return {
      prompt: 'פתרו:',
      expression: `(${a} + ${b}) × ${c} = ?`,
      answer: { kind: 'number', value: (a + b) * c },
      hint: 'מה שבסוגריים מחשבים ראשון.',
      solution: [`[[${a} + ${b} = ${a + b}]]`, `[[${a + b} × ${c} = ${(a + b) * c}]]`],
    };
  }
  const n = randInt(2, 999);
  const [expr, val, why] = pick([
    [`${n} × 0`, 0, 'כל מספר כפול 0 שווה 0.'],
    [`0 : ${n}`, 0, '0 מחולק בכל מספר (חוץ מ־0) שווה 0.'],
    [`${n} × 1`, n, 'כפל ב־1 לא משנה את המספר.'],
    [`${n} : 1`, n, 'חילוק ב־1 לא משנה את המספר.'],
    [`${n} : ${n}`, 1, 'מספר מחולק בעצמו שווה 1.'],
    [`${n} + 0`, n, 'הוספת 0 לא משנה את המספר.'],
  ] as const);
  return {
    prompt: 'פתרו בלי לחשב הרבה:',
    expression: `${expr} = ?`,
    answer: { kind: 'number', value: val },
    hint: 'חשבו על התכונות של 0 ושל 1.',
    solution: [why, `[[${expr} = ${val}]]`],
  };
}

const isPrime = (n: number) => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every((k) => n % k !== 0);
const digitSum = (n: number) => String(n).split('').reduce((s, d) => s + Number(d), 0);
const SUP: Record<string, string> = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };

function primesQ(level: Level): Question {
  if (level === 1) {
    const n = randInt(2, 50);
    const p = isPrime(n);
    const divs = Array.from({ length: n }, (_, i) => i + 1).filter((k) => n % k === 0);
    return {
      prompt: `האם [[${n}]] הוא מספר ראשוני או פריק?`,
      answer: { kind: 'choice', options: ['ראשוני', 'פריק'], correct: p ? 0 : 1 },
      hint: 'מספר ראשוני מתחלק רק ב־1 ובעצמו.',
      solution: [`המחלקים של ${n}: [[${divs.join(', ')}]]`, p ? 'יש לו רק שני מחלקים ← ראשוני.' : 'יש לו יותר משני מחלקים ← פריק.'],
    };
  }
  if (level === 2) {
    const k = pick([3, 6, 9]);
    const n = randInt(100, 9999);
    const yes = n % k === 0;
    const s = digitSum(n);
    return {
      prompt: `האם [[${fmt(n, false)}]] מתחלק ב־${k} בלי שארית?`,
      answer: { kind: 'choice', options: ['כן', 'לא'], correct: yes ? 0 : 1 },
      hint: k === 6 ? 'מתחלק ב־6 = זוגי וגם מתחלק ב־3 (סכום הספרות מתחלק ב־3).' : `בודקים אם סכום הספרות מתחלק ב־${k}.`,
      solution: [
        `סכום הספרות: [[${String(n).split('').join(' + ')} = ${s}]]`,
        k === 6 ? `${n % 2 === 0 ? 'זוגי' : 'לא זוגי'}, וסכום הספרות ${s % 3 === 0 ? 'מתחלק' : 'לא מתחלק'} ב־3 ← ${yes ? 'מתחלק' : 'לא מתחלק'} ב־6.` : `${s} ${s % k === 0 ? 'מתחלק' : 'לא מתחלק'} ב־${k} ← ${yes ? 'כן' : 'לא'}.`,
      ],
    };
  }
  if (chance(0.5)) {
    const [b, e] = pick([[2, 2], [2, 3], [2, 4], [2, 5], [3, 2], [3, 3], [4, 2], [5, 2], [5, 3], [10, 2], [10, 3], [10, 4], [6, 2], [7, 2]] as const);
    return {
      prompt: 'חשבו את החזקה:',
      expression: `${b}${SUP[e]} = ?`,
      answer: { kind: 'number', value: b ** e },
      hint: `[[${b}${SUP[e]}]] = ${b} כפול עצמו ${e} פעמים.`,
      solution: [`[[${Array(e).fill(b).join(' × ')} = ${fmt(b ** e)}]]`],
    };
  }
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
  const p = pick(primes);
  const comps = [4, 6, 8, 9, 10, 12, 14, 15, 21, 25, 27, 33, 39, 49, 51];
  return {
    prompt: 'איזה מהמספרים הוא **ראשוני**?',
    answer: choice(`[[${p}]]`, comps.sort(() => Math.random() - 0.5).slice(0, 3).map((c) => `[[${c}]]`)),
    hint: 'בדקו לכל מספר אם יש לו מחלק חוץ מ־1 ומעצמו.',
    solution: [`[[${p}]] מתחלק רק ב־1 ובעצמו.`],
  };
}

function wordProblemQ(level: Level): Question {
  const p = person();
  if (level === 1) {
    const n = randInt(2, 9), price = randInt(3, 15), paid = Math.ceil((n * price + 1) / 50) * 50;
    return {
      prompt: `${p.name} ${p.v('קנה', 'קנתה')} ${n} מחברות. כל מחברת עולה ${price} שקלים. ${p.v('הוא שילם', 'היא שילמה')} ב־${paid} שקלים. כמה עודף ${p.v('קיבל', 'קיבלה')}?`,
      answer: { kind: 'number', value: paid - n * price, unit: 'שקלים' },
      hint: 'קודם מחשבים כמה עלו כל המחברות.',
      solution: [`[[${n} × ${price} = ${n * price}]]`, `[[${paid} - ${n * price} = ${paid - n * price}]]`],
      wordProblem: true,
    };
  }
  if (level === 2) {
    const per = pick([40, 45, 50, 55]), kids = randInt(3, 8) * per + randInt(1, per - 1);
    const buses = Math.ceil(kids / per);
    return {
      prompt: `${kids} תלמידים יוצאים לטיול. בכל אוטובוס יש ${per} מקומות. כמה אוטובוסים צריך כדי שכל התלמידים ייסעו?`,
      answer: { kind: 'number', value: buses },
      hint: 'אם נשארים תלמידים אחרי החלוקה – צריך עוד אוטובוס.',
      solution: [`[[${kids} : ${per} = ${Math.floor(kids / per)}]] ושארית ${kids % per}`, `לתלמידים שנשארו צריך עוד אוטובוס: [[${Math.floor(kids / per)} + 1 = ${buses}]]`],
      wordProblem: true,
    };
  }
  const boxes = randInt(3, 9), each = randInt(12, 48), start = randInt(200, 900), lent = randInt(20, 150);
  const total = start + boxes * each - lent;
  return {
    prompt: `בספריית בית הספר היו ${start} ספרים. נתרמו לספרייה ${boxes} ארגזים, ובכל ארגז ${each} ספרים. אחר כך התלמידים שאלו ${lent} ספרים. כמה ספרים נשארו על המדפים?`,
    answer: { kind: 'number', value: total },
    hint: 'שלושה שלבים: כמה ספרים נתרמו, כמה היו יחד, וכמה נשארו.',
    solution: [`נתרמו: [[${boxes} × ${each} = ${boxes * each}]]`, `יחד: [[${start} + ${boxes * each} = ${start + boxes * each}]]`, `נשארו: [[${start + boxes * each} - ${lent} = ${total}]]`],
    wordProblem: true,
  };
}

export const fractionTopics: Topic[] = [
  {
    id: 'fraction-parts',
    unit: 'fractions',
    title: 'מהו שבר?',
    emoji: '🍕',
    lesson: [
      { kind: 'text', text: '**שבר** מתאר חלק משלם. מחלקים את השלם ל**חלקים שווים**.' },
      { kind: 'visual', visual: { type: 'fractionBar', parts: 4, shaded: 3 }, caption: 'שלושה רבעים: [[{3/4}]]' },
      { kind: 'text', text: '**המכנה** (למטה) – לכמה חלקים שווים חילקו. **המונה** (למעלה) – כמה חלקים לוקחים.' },
      { kind: 'example', text: 'רבע מ־20 תפוחים: מחלקים ל־4 קבוצות שוות.', expression: '20 : 4 = 5' },
      { kind: 'example', text: 'שלושה רבעים מ־20: קודם רבע, ואז כפול 3.', expression: '20 : 4 × 3 = 15' },
    ],
    generate: fractionPartsQ,
  },
  {
    id: 'fraction-compare',
    unit: 'fractions',
    title: 'השוואת שברים ומספר מעורב',
    emoji: '⚖️',
    lesson: [
      { kind: 'text', text: '**אותו מכנה:** משווים את המונים. [[{2/7} < {5/7}]]' },
      { kind: 'text', text: '**אותו מונה:** המכנה הגדול – החלקים קטנים יותר. [[{1/8} < {1/3}]]' },
      { kind: 'text', text: '**שבר גדול מ־1:** המונה גדול מהמכנה, למשל [[{7/4}]]. אפשר לכתוב אותו כ**מספר מעורב**: שלם ועוד שבר.' },
      { kind: 'example', text: '', expression: '7/4 = 1 3/4' },
      { kind: 'visual', visual: { type: 'numberLine', min: 0, max: 2, ticksPerUnit: 4, markAt: 7 / 4, labels: true }, caption: '[[{7/4} = {1 3/4}]] על ישר המספרים' },
    ],
    generate: fractionCompareQ,
  },
  {
    id: 'fraction-addsub',
    unit: 'fractions',
    title: 'חיבור וחיסור שברים',
    emoji: '➕',
    lesson: [
      { kind: 'text', text: '**מכנים שווים:** מחברים או מחסרים רק את המונים. המכנה לא משתנה.' },
      { kind: 'example', text: '', expression: '2/5 + 1/5 = 3/5' },
      { kind: 'text', text: '**מכנה אחד כפולה של השני:** קודם מרחיבים לאותו מכנה.' },
      { kind: 'example', text: '', expression: '1/2 + 1/4 = 2/4 + 1/4 = 3/4' },
      { kind: 'tip', text: 'הרחבה: כופלים מונה ומכנה באותו מספר – ערך השבר לא משתנה.' },
    ],
    generate: fractionAddSubQ,
  },
];

export const numberTopics: Topic[] = [
  {
    id: 'place-value',
    unit: 'numbers',
    title: 'מספרים עד מיליון',
    emoji: '🔢',
    lesson: [
      { kind: 'text', text: 'לכל ספרה יש **מקום**: יחידות, עשרות, מאות, אלפים, עשרות אלפים, מאות אלפים.' },
      { kind: 'example', text: 'ב־[[352,814]] הספרה 5 במקום עשרות האלפים, ולכן ערכה [[50,000]].', expression: '352,814 = 300,000 + 50,000 + 2,000 + 800 + 10 + 4' },
      { kind: 'text', text: '**השוואה:** למספר עם יותר ספרות – ערך גדול יותר. אם מספר הספרות שווה, משווים משמאל לימין.' },
      { kind: 'tip', text: '**עיגול:** מסתכלים על הספרה שאחרי מקום העיגול. 5 ומעלה – למעלה; 4 ומטה – למטה.' },
    ],
    generate: placeValueQ,
  },
  {
    id: 'hebrew-letters',
    unit: 'numbers',
    title: 'שיטת האלף־בית',
    emoji: '🔤',
    lesson: [
      { kind: 'text', text: 'בעברית אפשר לכתוב מספרים באותיות (גימטרייה):\n**א–ט** = 1–9\n**י, כ, ל, מ, נ, ס, ע, פ, צ** = 10, 20, ..., 90\n**ק, ר, ש, ת** = 100, 200, 300, 400' },
      { kind: 'example', text: 'כ״ג = 20 + 3 = 23\nרמ״ח = 200 + 40 + 8 = 248' },
      { kind: 'text', text: 'מספר באות אחת – עם גרש: ה׳ = 5. בכמה אותיות – גרשיים לפני האות האחרונה: י״ח = 18.' },
      { kind: 'tip', text: '15 ו־16 כותבים **ט״ו** ו**ט״ז** (ולא י״ה וי״ו). כך כותבים גם תאריכים: ט״ו בשבט.' },
    ],
    generate: hebrewLettersQ,
  },
];

export const operationTopics: Topic[] = [
  {
    id: 'add-sub',
    unit: 'operations',
    title: 'חיבור וחיסור',
    emoji: '🧮',
    lesson: [
      { kind: 'text', text: '**במאונך:** כותבים יחידות מתחת ליחידות, עשרות מתחת לעשרות, ומתחילים מימין.' },
      { kind: 'example', text: 'חיבור עם המרה: 10 יחידות הופכות לעשרת אחת.', expression: '4,587 + 2,736 = 7,323' },
      { kind: 'example', text: 'חיסור עם פריטה: עשרת אחת הופכת ל־10 יחידות.', expression: '6,204 - 1,857 = 4,347' },
      { kind: 'tip', text: 'בודקים חיסור בחיבור: [[4,347 + 1,857 = 6,204]] ✓' },
    ],
    generate: addSubQ,
  },
  {
    id: 'long-multiplication',
    unit: 'operations',
    title: 'כפל במאונך',
    emoji: '✖️',
    lesson: [
      { kind: 'text', text: 'כופלים כל ספרה, מימין לשמאל, ומעבירים את מה שעובר לעשרת הבאה.' },
      { kind: 'example', text: 'כפל בחד־ספרתי:', expression: '347 × 6 = 2,082' },
      { kind: 'text', text: 'כפל בדו־ספרתי: מפרקים את הגורם לעשרות ויחידות, כופלים בכל אחד ומחברים.' },
      { kind: 'example', text: '', expression: '125 × 23 = 125 × 20 + 125 × 3 = 2,500 + 375 = 2,875' },
      { kind: 'tip', text: 'אומדן לפני: [[125 × 23 ≈ 100 × 20 = 2,000]] – התשובה צריכה להיות קצת יותר.' },
    ],
    generate: multiplyQ,
  },
  {
    id: 'long-division',
    unit: 'operations',
    title: 'חילוק ארוך',
    emoji: '➗',
    lesson: [
      { kind: 'text', text: '**חילוק ארוך:** מחלקים משמאל לימין – קודם המאות, אחר כך העשרות ובסוף היחידות.' },
      { kind: 'example', text: '', expression: '852 : 4 = 213' },
      { kind: 'text', text: 'לפעמים נשארת **שארית** – מה שלא מתחלק. השארית תמיד קטנה מהמחלק.' },
      { kind: 'example', text: '', expression: '87 : 4 = 21  (שארית 3)' },
      { kind: 'tip', text: 'בדיקה: [[21 × 4 + 3 = 87]] ✓' },
    ],
    generate: divideQ,
  },
  {
    id: 'order-of-operations',
    unit: 'operations',
    title: 'סדר פעולות ותכונות 0 ו־1',
    emoji: '🧩',
    lesson: [
      { kind: 'text', text: '**סדר הפעולות:** 1️⃣ סוגריים ← 2️⃣ כפל וחילוק ← 3️⃣ חיבור וחיסור.' },
      { kind: 'example', text: '', expression: '5 + 3 × 4 = 5 + 12 = 17' },
      { kind: 'example', text: '', expression: '(5 + 3) × 4 = 8 × 4 = 32' },
      { kind: 'text', text: '**תכונות 0 ו־1:**\n[[n × 0 = 0]] · [[0 : n = 0]] · [[n × 1 = n]] · [[n : 1 = n]] · [[n : n = 1]]\nאסור לחלק ב־0!' },
    ],
    generate: orderOpsQ,
  },
  {
    id: 'primes-divisibility',
    unit: 'operations',
    title: 'ראשוניים, התחלקות וחזקות',
    emoji: '🔍',
    lesson: [
      { kind: 'text', text: '**מספר ראשוני** מתחלק רק ב־1 ובעצמו: 2, 3, 5, 7, 11, 13...\n**מספר פריק** – יש לו עוד מחלקים: 4, 6, 8, 9...\n(1 אינו ראשוני ואינו פריק.)' },
      { kind: 'text', text: '**סימני התחלקות:**\nב־3 – סכום הספרות מתחלק ב־3\nב־9 – סכום הספרות מתחלק ב־9\nב־6 – זוגי וגם מתחלק ב־3' },
      { kind: 'example', text: '[[738]]: [[7 + 3 + 8 = 18]] ← מתחלק ב־3, ב־9 וגם ב־6 (כי זוגי).' },
      { kind: 'text', text: '**חזקה:** כפל של מספר בעצמו כמה פעמים.' },
      { kind: 'example', text: '', expression: '2³ = 2 × 2 × 2 = 8' },
    ],
    generate: primesQ,
  },
  {
    id: 'word-problems',
    unit: 'operations',
    title: 'שאלות מילוליות',
    emoji: '📚',
    lesson: [
      { kind: 'text', text: '**שלבים בפתרון:**\n1. קוראים את כל השאלה.\n2. מסמנים: מה ידוע? מה שואלים?\n3. מחליטים על הפעולות ועל הסדר שלהן.\n4. פותרים ובודקים שהתשובה הגיונית.' },
      { kind: 'example', text: 'קנו 3 עטים ב־8 שקלים כל אחד ושילמו ב־50. העודף: [[50 - 3 × 8 = 26]] שקלים.' },
      { kind: 'tip', text: 'בשאלות חלוקה לקבוצות (אוטובוסים, שולחנות) – אם נשארת שארית, לפעמים צריך קבוצה נוספת.' },
    ],
    generate: wordProblemQ,
  },
];
