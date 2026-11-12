import type { Level, Question, Topic } from '../../../engine/types';
import { choice, cmp, fmt, pick, randInt, chance, person } from '../../../engine/math';

const UNIT = 'naturals';

/* ---------------- ב1. סדר פעולות וסוגריים ---------------- */

function orderQ(level: Level): Question {
  if (level === 1) {
    if (chance(0.5)) {
      const a = randInt(2, 30), b = randInt(2, 9), c = randInt(2, 9);
      const plus = chance(0.5);
      // subtraction variant is built so the result stays positive
      const expr = plus ? `${a} + ${b} × ${c}` : `${b * c + a} - ${b} × ${c}`;
      const val = plus ? a + b * c : a;
      return {
        prompt: 'פתרו לפי סדר הפעולות:',
        expression: `${expr} = ?`,
        answer: { kind: 'number', value: val },
        hint: 'כפל וחילוק קודמים לחיבור וחיסור.',
        solution: [`קודם הכפל: [[${b} × ${c} = ${b * c}]]`, plus ? `[[${a} + ${b * c} = ${val}]]` : `[[${b * c + a} - ${b * c} = ${val}]]`],
      };
    }
    const c = randInt(2, 9), q = randInt(2, 12), a = randInt(1, 40);
    return {
      prompt: 'פתרו לפי סדר הפעולות:',
      expression: `${a} + ${c * q} : ${c} = ?`,
      answer: { kind: 'number', value: a + q },
      hint: 'חילוק קודם לחיבור.',
      solution: [`קודם החילוק: [[${c * q} : ${c} = ${q}]]`, `[[${a} + ${q} = ${a + q}]]`],
    };
  }
  if (level === 2) {
    const k = pick(['paren', 'twoProducts'] as const);
    if (k === 'paren') {
      const a = randInt(2, 20), b = randInt(2, 20), c = randInt(2, 9);
      const plus = chance(0.6);
      const [x, y] = plus ? [a, b] : [Math.max(a, b) + 1, Math.min(a, b)];
      const inner = plus ? x + y : x - y;
      const op = plus ? '+' : '-';
      return {
        prompt: 'פתרו:',
        expression: `(${x} ${op} ${y}) × ${c} = ?`,
        answer: { kind: 'number', value: inner * c },
        hint: 'מה שבסוגריים – מחשבים ראשון.',
        solution: [`סוגריים: [[${x} ${op} ${y} = ${inner}]]`, `[[${inner} × ${c} = ${inner * c}]]`],
      };
    }
    const a = randInt(2, 9), b = randInt(2, 12), c = randInt(2, 9), d = randInt(2, 9);
    const p1 = a * b, p2 = c * d;
    const plus = chance(0.5) || p1 < p2;
    return {
      prompt: 'פתרו לפי סדר הפעולות:',
      expression: `${a} × ${b} ${plus ? '+' : '-'} ${c} × ${d} = ?`,
      answer: { kind: 'number', value: plus ? p1 + p2 : p1 - p2 },
      hint: 'קודם שני תרגילי הכפל, ואחר כך החיבור או החיסור.',
      solution: [`[[${a} × ${b} = ${p1}]] , [[${c} × ${d} = ${p2}]]`, `[[${p1} ${plus ? '+' : '-'} ${p2} = ${plus ? p1 + p2 : p1 - p2}]]`],
    };
  }
  const k = pick(['mix', 'outer', 'which'] as const);
  if (k === 'mix') {
    const b = randInt(2, 15), a = b + randInt(1, 15), c = randInt(2, 9), e = randInt(2, 9), q = randInt(2, 10);
    const r = (a - b) * c + (e * q) / e;
    return {
      prompt: 'פתרו:',
      expression: `(${a} - ${b}) × ${c} + ${e * q} : ${e} = ?`,
      answer: { kind: 'number', value: r },
      hint: 'סוגריים ← כפל וחילוק ← חיבור וחיסור.',
      solution: [`[[${a} - ${b} = ${a - b}]]`, `[[${a - b} × ${c} = ${(a - b) * c}]] , [[${e * q} : ${e} = ${q}]]`, `[[${(a - b) * c} + ${q} = ${r}]]`],
    };
  }
  if (k === 'outer') {
    const b = randInt(2, 9), c = randInt(2, 9), d = randInt(2, 6);
    const inner = (b + c) * d;
    const a = inner + randInt(5, 100);
    return {
      prompt: 'פתרו:',
      expression: `${a} - (${b} + ${c}) × ${d} = ?`,
      answer: { kind: 'number', value: a - inner },
      hint: 'קודם הסוגריים, אחר כך הכפל, ובסוף החיסור.',
      solution: [`[[${b} + ${c} = ${b + c}]]`, `[[${b + c} × ${d} = ${inner}]]`, `[[${a} - ${inner} = ${a - inner}]]`],
    };
  }
  const a = randInt(2, 9), b = randInt(2, 9), c = randInt(2, 9);
  const target = (a + b) * c;
  const opts = [`(${a} + ${b}) × ${c}`, `${a} + ${b} × ${c}`, `${a} × (${b} + ${c})`, `${a} + (${b} × ${c})`];
  if (new Set([target, a + b * c, a * (b + c)]).size < 3) return orderQ(level);
  return {
    prompt: `באיזה תרגיל התוצאה היא ${target}?`,
    answer: { kind: 'choice', options: opts.map((o) => `[[${o}]]`), correct: 0 },
    hint: 'חשבו כל תרגיל לפי סדר הפעולות.',
    solution: [`[[(${a} + ${b}) × ${c} = ${a + b} × ${c} = ${target}]]`, `[[${a} + ${b} × ${c} = ${a + b * c}]]`, `[[${a} × (${b} + ${c}) = ${a * (b + c)}]]`],
  };
}

/* ---------------- ב1. כפל ---------------- */

function multQ(level: Level): Question {
  if (level === 1) {
    if (chance(0.5)) {
      const a = randInt(2, 9) * pick([10, 100]), b = randInt(2, 9) * pick([1, 10, 100]);
      return {
        prompt: 'פתרו בעל פה:',
        expression: `${fmt(a)} × ${fmt(b)} = ?`,
        answer: { kind: 'number', value: a * b },
        hint: 'כפלו את הספרות שאינן אפס, ואז הוסיפו את כל האפסים.',
        solution: [`[[${String(a).replace(/0+$/, '')} × ${String(b).replace(/0+$/, '')} = ${Number(String(a).replace(/0+$/, '')) * Number(String(b).replace(/0+$/, ''))}]]`, `מוסיפים את האפסים: [[${fmt(a * b)}]]`],
      };
    }
    const a = randInt(12, 99), b = randInt(3, 9);
    const t = Math.floor(a / 10) * 10, o = a % 10;
    return {
      prompt: 'פתרו:',
      expression: `${a} × ${b} = ?`,
      answer: { kind: 'number', value: a * b },
      hint: `פרקו: [[${a} = ${t} + ${o}]].`,
      solution: [`[[${t} × ${b} = ${t * b}]] , [[${o} × ${b} = ${o * b}]]`, `[[${t * b} + ${o * b} = ${a * b}]]`],
    };
  }
  if (level === 3 && chance(0.4)) {
    const a = randInt(12, 49), b = randInt(12, 49);
    const p = a * b;
    const k = pick(['plus1', 'double', 'times10'] as const);
    if (k === 'plus1')
      return {
        prompt: `ידוע ש-[[${a} × ${b} = ${fmt(p)}]]. בלי לחשב בכתב – כמה זה:`,
        expression: `${a} × ${b + 1} = ?`,
        answer: { kind: 'number', value: p + a },
        hint: `[[${a} × ${b + 1}]] זה עוד ${a} אחד יותר מ-[[${a} × ${b}]].`,
        solution: [`[[${a} × ${b + 1} = ${a} × ${b} + ${a} = ${fmt(p)} + ${a} = ${fmt(p + a)}]]`],
      };
    if (k === 'double')
      return {
        prompt: `ידוע ש-[[${a} × ${b} = ${fmt(p)}]]. בלי לחשב בכתב – כמה זה:`,
        expression: `${a * 2} × ${b} = ?`,
        answer: { kind: 'number', value: p * 2 },
        hint: `${a * 2} הוא פי 2 מ-${a}.`,
        solution: [`הכפלנו גורם אחד פי 2, לכן גם המכפלה גדלה פי 2: [[${fmt(p)} × 2 = ${fmt(p * 2)}]]`],
      };
    return {
      prompt: `ידוע ש-[[${a} × ${b} = ${fmt(p)}]]. בלי לחשב בכתב – כמה זה:`,
      expression: `${a} × ${b} × 10 = ?`,
      answer: { kind: 'number', value: p * 10 },
      hint: 'כפל ב-10 מוסיף אפס.',
      solution: [`[[${fmt(p)} × 10 = ${fmt(p * 10)}]]`],
    };
  }
  const a = level === 2 ? randInt(12, 99) : randInt(102, 999);
  const b = level === 2 ? randInt(12, 99) : randInt(12, 99);
  const bt = Math.floor(b / 10) * 10, bo = b % 10;
  return {
    prompt: 'פתרו (אפשר בכפל ארוך על דף):',
    expression: `${a} × ${b} = ?`,
    answer: { kind: 'number', value: a * b },
    hint: `פרקו את ${b} לעשרות ויחידות: [[${b} = ${bt} + ${bo}]].`,
    solution: [`[[${a} × ${bo} = ${fmt(a * bo)}]]`, `[[${a} × ${bt} = ${fmt(a * bt)}]]`, `[[${fmt(a * bo)} + ${fmt(a * bt)} = ${fmt(a * b)}]]`],
  };
}

/* ---------------- ב2. חילוק במספר דו-ספרתי ---------------- */

function divisionQ(level: Level): Question {
  if (level === 3 && chance(0.35)) {
    const n = randInt(1000, 3000);
    const d1 = randInt(12, 30);
    let d2 = randInt(12, 30);
    if (d2 === d1) d2 += 3;
    const bigger = d1 < d2 ? `[[${fmt(n)} : ${d1}]]` : `[[${fmt(n)} : ${d2}]]`;
    return {
      prompt: `בלי לחשב: איזה תרגיל תוצאתו **גדולה יותר**?`,
      answer: choice(bigger, [`[[${fmt(n)} : ${d1}]]`, `[[${fmt(n)} : ${d2}]]`, 'התוצאות שוות']),
      hint: 'אם מחלקים את אותה כמות ליותר חלקים – כל חלק קטן יותר.',
      solution: [`המחולק זהה (${fmt(n)}). מחלק קטן יותר ← מנה גדולה יותר.`, `לכן ${bigger} גדול יותר.`],
    };
  }
  const d = randInt(11, level === 1 ? 25 : 60);
  const q = level === 1 ? randInt(5, 40) : randInt(21, 180);
  const r = level === 3 ? randInt(1, d - 1) : 0;
  const n = d * q + r;
  if (r) {
    return {
      prompt: 'חלקו: מה המנה ומה השארית?',
      expression: `${fmt(n)} : ${d} = ?`,
      answer: { kind: 'divRem', q, r },
      hint: `הכינו "לוח עזר" של כפולות של ${d}: ${d}, ${d * 2}, ${d * 3}...`,
      solution: [`[[${d} × ${q} = ${fmt(d * q)}]]`, `[[${fmt(n)} - ${fmt(d * q)} = ${r}]] – זו השארית (קטנה מ-${d} ✓).`, `התשובה: ${q} ושארית ${r}.`],
    };
  }
  return {
    prompt: 'פתרו (אפשר בחילוק ארוך על דף):',
    expression: `${fmt(n)} : ${d} = ?`,
    answer: { kind: 'number', value: q },
    hint: `נסו לאמוד: ${d} קרוב ל-${Math.round(d / 10) * 10}. כמה פעמים ${Math.round(d / 10) * 10} נכנס ב-${fmt(n)}?`,
    solution: [`[[${fmt(n)} : ${d} = ${q}]]`, `בדיקה: [[${q} × ${d} = ${fmt(n)}]] ✓`],
  };
}

/* ---------------- ב3. אומדן ---------------- */

const roundTo = (n: number, p: number) => Math.round(n / p) * p;

function estimationQ(level: Level): Question {
  if (level === 1) {
    const p = pick([10, 100, 1000]);
    const n = randInt(p === 1000 ? 10000 : 1000, p === 1000 ? 99999 : 9999);
    const name = p === 10 ? 'לעשרות' : p === 100 ? 'למאות' : 'לאלפים';
    return {
      prompt: `עגלו ${name}:`,
      expression: fmt(n),
      answer: { kind: 'number', value: roundTo(n, p) },
      hint: `מסתכלים על הספרה שמימין למקום ה${name.slice(1)}: 5 ומעלה – מעגלים למעלה.`,
      solution: [`[[${fmt(n)} ≈ ${fmt(roundTo(n, p))}]]`],
    };
  }
  if (level === 2) {
    const a = randInt(1, 9) * pick([10, 100]) + pick([-2, -1, 1, 2]);
    const b = randInt(2, 9) * pick([10, 100]) + pick([-1, 1, 2]);
    const est = roundTo(a, a > 100 ? 100 : 10) * roundTo(b, b > 100 ? 100 : 10);
    const opts = [est / 100, est / 10, est, est * 10].filter((x) => x >= 1);
    return {
      prompt: `מה האומדן הטוב ביותר לתוצאה של [[${a} × ${b}]]?`,
      answer: choice(`[[${fmt(est)}]]`, opts.filter((x) => x !== est).map((x) => `[[${fmt(x)}]]`)),
      hint: 'עגלו כל מספר למספר "עגול" קרוב וכפלו.',
      solution: [`[[${a} ≈ ${roundTo(a, a > 100 ? 100 : 10)}]] , [[${b} ≈ ${roundTo(b, b > 100 ? 100 : 10)}]]`, `אומדן: [[${fmt(est)}]] (התוצאה המדויקת: ${fmt(a * b)}).`],
    };
  }
  if (chance(0.5)) {
    const a = randInt(12, 90), b = randInt(12, 90);
    const p = a * b, s = a * 10 + b;
    return {
      prompt: 'בלי לחשב בדיוק – השלימו את הסימן: [[> , < , =]]',
      expression: `${a} × ${b} ? ${a * 10} + ${b}`,
      answer: { kind: 'compare', correct: cmp(p, s) },
      hint: `[[${a} × ${b}]] זה כמו ${b} פעמים ${a}. ו-[[${a * 10}]] זה רק 10 פעמים ${a}.`,
      solution: [`[[${a} × ${b} = ${fmt(p)}]] , [[${a * 10} + ${b} = ${fmt(s)}]]`, `[[${a} × ${b} ${cmp(p, s)} ${a * 10} + ${b}]]`],
    };
  }
  const n = randInt(2000, 9000), x = randInt(100, 900);
  let y = randInt(100, 900);
  if (y === x) y += 7;
  const plus = chance(0.5);
  const A = plus ? n + x : n - x, B = plus ? n + y : n - y;
  const op = plus ? '+' : '-';
  return {
    prompt: 'בלי לחשב – השלימו את הסימן: [[> , < , =]]',
    expression: `${fmt(n)} ${op} ${x} ? ${fmt(n)} ${op} ${y}`,
    answer: { kind: 'compare', correct: cmp(A, B) },
    hint: plus ? 'המספר הראשון זהה. מוסיפים יותר ← מקבלים יותר.' : 'המספר הראשון זהה. מחסרים יותר ← נשאר פחות!',
    solution: [plus ? `${x} ${x > y ? '>' : '<'} ${y}, לכן התוצאה הראשונה ${x > y ? 'גדולה' : 'קטנה'} יותר.` : `מחסרים ${x} לעומת ${y}. מי שמחסר יותר – נשאר עם פחות.`, `[[${fmt(n)} ${op} ${x} ${cmp(A, B)} ${fmt(n)} ${op} ${y}]]`],
  };
}

/* ---------------- ב4. שאלות רב-שלביות ---------------- */

function wordQ(level: Level): Question {
  const big = level >= 2;
  const t = pick(level === 3 ? ['shelves', 'tables', 'shop', 'trucks'] : ['crates', 'shop', 'tables', 'trucks']);
  if (t === 'crates') {
    const a = randInt(2, big ? 15 : 6), b = randInt(4, big ? 24 : 10), c = randInt(2, big ? 12 : 5), d = randInt(4, big ? 24 : 8);
    return {
      wordProblem: true,
      prompt: `למסיבה הביאו ${a} ארגזים של מים, ${b} בקבוקים בכל ארגז, וגם ${c} ארגזים של מיץ, ${d} בקבוקים בכל ארגז. כמה בקבוקים הביאו בסך הכול?`,
      answer: { kind: 'number', value: a * b + c * d },
      hint: 'חשבו כמה בקבוקי מים, כמה בקבוקי מיץ, וחברו.',
      solution: [`מים: [[${a} × ${b} = ${a * b}]]`, `מיץ: [[${c} × ${d} = ${c * d}]]`, `סך הכול: [[${a * b} + ${c * d} = ${a * b + c * d}]]`],
    };
  }
  if (t === 'shop') {
    const { name, v } = person();
    const n = randInt(2, big ? 9 : 5), p = randInt(3, big ? 15 : 9), m = randInt(1, 3), q = randInt(5, 20);
    const total = n * p + m * q;
    const bill = total <= 50 ? 50 : total <= 100 ? 100 : 200;
    return {
      wordProblem: true,
      prompt: `${name} ${v('קנה', 'קנתה')} ${n} מחברות ב-${p} ₪ כל אחת ו-${m} ${m === 1 ? 'ספר' : 'ספרים'} ב-${q} ₪ ${m === 1 ? '' : 'כל אחד'}. ${v('הוא שילם', 'היא שילמה')} בשטר של ${bill} ₪. כמה עודף ${v('קיבל', 'קיבלה')}?`,
      answer: { kind: 'number', value: bill - total },
      hint: 'קודם חשבו כמה עלו כל הקניות, ואז החסירו מהשטר.',
      solution: [`מחברות: [[${n} × ${p} = ${n * p}]]`, `ספרים: [[${m} × ${q} = ${m * q}]]`, `סך הכול: [[${n * p} + ${m * q} = ${total}]] ₪`, `עודף: [[${bill} - ${total} = ${bill - total}]] ₪`],
    };
  }
  if (t === 'tables') {
    const tables = randInt(3, big ? 15 : 8), per = randInt(4, 12), kids = randInt(20, 60);
    const total = kids + tables * per;
    return {
      wordProblem: true,
      prompt: `במסיבת סיום השתתפו ${total} הורים וילדים, מהם ${kids} תלמידים. התלמידים ישבו בנפרד, ושאר המשתתפים ישבו סביב ${tables} שולחנות, אותו מספר אנשים סביב כל שולחן. כמה אנשים ישבו סביב כל שולחן?`,
      answer: { kind: 'number', value: per },
      hint: 'כמה משתתפים אינם תלמידים? ואז – חלקו בין השולחנות.',
      solution: [`[[${total} - ${kids} = ${total - kids}]] הורים.`, `[[${total - kids} : ${tables} = ${per}]] אנשים סביב כל שולחן.`],
    };
  }
  if (t === 'trucks') {
    const per = randInt(3, big ? 25 : 9), trucks = randInt(2, big ? 12 : 6);
    const left = randInt(5, 200);
    const total = per * trucks + left;
    return {
      wordProblem: true,
      prompt: `במחסן היו ${fmt(total)} טונות חיטה. העמיסו ${trucks} משאיות, ${per} טונות על כל משאית. כמה טונות נשארו במחסן?`,
      answer: { kind: 'number', value: left },
      hint: 'כמה טונות הועמסו בסך הכול?',
      solution: [`הועמסו: [[${trucks} × ${per} = ${per * trucks}]]`, `נשארו: [[${fmt(total)} - ${per * trucks} = ${left}]]`],
    };
  }
  // shelves chain (level 3)
  const s4 = randInt(3, 9), m3 = randInt(2, 6), m2 = randInt(2, 6), l1 = randInt(1, 4);
  const s3 = s4 + m3, s2 = s3 + m2, s1 = s2 - l1;
  return {
    wordProblem: true,
    prompt: `על המדף הראשון יש ${l1} ספרים **פחות** מאשר על המדף השני. על המדף השני יש ${m2} ספרים **יותר** מאשר על השלישי. על השלישי יש ${m3} ספרים **יותר** מאשר על הרביעי. על המדף הרביעי יש ${s4} ספרים. כמה ספרים על המדף הראשון?`,
    answer: { kind: 'number', value: s1 },
    hint: 'התחילו מהסוף – מהמדף הרביעי – ועלו למעלה.',
    solution: [`רביעי: ${s4}`, `שלישי: [[${s4} + ${m3} = ${s3}]]`, `שני: [[${s3} + ${m2} = ${s2}]]`, `ראשון: [[${s2} - ${l1} = ${s1}]]`],
  };
}

export const naturalTopics: Topic[] = [
  {
    id: 'order-of-operations',
    unit: UNIT,
    title: 'סדר פעולות וסוגריים',
    emoji: '🧩',
    lesson: [
      { kind: 'text', text: 'כשיש כמה פעולות בתרגיל, יש **סדר קבוע**:' },
      { kind: 'text', text: '1️⃣ **סוגריים** ← 2️⃣ **כפל וחילוק** (משמאל לימין) ← 3️⃣ **חיבור וחיסור** (משמאל לימין).' },
      { kind: 'example', text: 'בלי סוגריים – הכפל קודם:', expression: '5 + 3 × 4 = 5 + 12 = 17' },
      { kind: 'example', text: 'עם סוגריים – הסוגריים קודם:', expression: '(5 + 3) × 4 = 8 × 4 = 32' },
      { kind: 'tip', text: 'סמנו בעיפרון את הפעולה הראשונה לפני שמתחילים.' },
    ],
    generate: orderQ,
  },
  {
    id: 'multiplication',
    unit: UNIT,
    title: 'כפל במספרים גדולים',
    emoji: '✖️',
    lesson: [
      { kind: 'text', text: '**כפל בעשרות ומאות**: כופלים את הספרות ומוסיפים את האפסים.' },
      { kind: 'example', text: '', expression: '40 × 300 = 12,000   (4 × 3 = 12, ועוד 3 אפסים)' },
      { kind: 'text', text: '**כפל דו-ספרתי**: מפרקים אחד המספרים לעשרות ויחידות.' },
      { kind: 'example', text: '', expression: '46 × 23 = 46 × 20 + 46 × 3 = 920 + 138 = 1,058' },
      { kind: 'tip', text: 'תובנה מספרית: אם [[27 × 36 = 972]], אז [[27 × 37 = 972 + 27 = 999]].' },
    ],
    generate: multQ,
  },
  {
    id: 'long-division',
    unit: UNIT,
    title: 'חילוק במספר דו-ספרתי',
    emoji: '➗',
    lesson: [
      { kind: 'text', text: 'מחלקים בחילוק ארוך, צעד אחר צעד. כדאי להכין **לוח עזר** עם כפולות של המחלק.' },
      { kind: 'example', text: 'למשל [[828 : 23]]. לוח עזר: [[23, 46, 69, 92...]]', expression: '82 : 23 = 3  (69), שארית 13  →  138 : 23 = 6  →  36' },
      { kind: 'text', text: '**שארית** היא מה שנשאר. היא תמיד קטנה מהמחלק.' },
      { kind: 'example', text: '', expression: '100 : 15 = 6  ושארית 10   (6 × 15 = 90)' },
      { kind: 'tip', text: 'בדיקה: מנה × מחלק + שארית = המחולק.' },
    ],
    generate: divisionQ,
  },
  {
    id: 'estimation',
    unit: UNIT,
    title: 'אומדן ועיגול',
    emoji: '🎯',
    lesson: [
      { kind: 'text', text: '**עיגול**: מסתכלים על הספרה שמימין למקום שאליו מעגלים. 5 ומעלה – למעלה; פחות מ-5 – למטה.' },
      { kind: 'example', text: '', expression: '4,768 ≈ 4,800 (למאות)   ,   4,768 ≈ 5,000 (לאלפים)' },
      { kind: 'text', text: '**אומדן** – תשובה בערך, מהירה, בעזרת מספרים עגולים. עוזר לבדוק שהתשובה הגיונית.' },
      { kind: 'example', text: '', expression: '498 × 21 ≈ 500 × 20 = 10,000' },
      { kind: 'tip', text: '[[75 × 22]] זה הרבה יותר מ-[[750 + 22]] – כי כפל ב-22 זה כמו לחבר 22 פעמים!' },
    ],
    generate: estimationQ,
  },
  {
    id: 'word-problems',
    unit: UNIT,
    title: 'שאלות רב-שלביות',
    emoji: '🧠',
    lesson: [
      { kind: 'text', text: 'שאלה רב-שלבית צריכה **כמה תרגילים** בזה אחר זה.' },
      { kind: 'text', text: '1. מה ידוע? 2. מה שואלים? 3. מה צריך לחשב קודם? 4. פותרים שלב-שלב. 5. בודקים שהתשובה הגיונית.' },
      { kind: 'example', text: '5 ארגזים עם 8 בקבוקים ו-4 ארגזים עם 6 בקבוקים:', expression: '5 × 8 + 4 × 6 = 40 + 24 = 64' },
      { kind: 'tip', text: 'לפעמים כדאי להתחיל מהסוף – ממה שכבר ידוע.' },
    ],
    generate: wordQ,
  },
];
