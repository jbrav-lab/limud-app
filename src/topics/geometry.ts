import type { Level, QuadKind, Question, Topic } from '../engine/types';
import { choice, fmt, pick, randInt, chance } from '../engine/math';

const UNIT = 'geometry';

/* ---------------- ד1. זוויות ---------------- */

const angleType = (d: number) => (d < 90 ? 'חדה' : d === 90 ? 'ישרה' : d < 180 ? 'קהה' : 'שטוחה');

function anglesQ(level: Level): Question {
  if (level === 1) {
    const deg = pick([pick([25, 35, 45, 60, 70]), 90, 90, pick([110, 125, 140, 155]), 180]);
    const t = angleType(deg);
    return {
      prompt: 'איזו זווית זו?',
      visual: { type: 'angle', degrees: deg },
      answer: { kind: 'choice', options: ['חדה', 'ישרה', 'קהה', 'שטוחה'], correct: ['חדה', 'ישרה', 'קהה', 'שטוחה'].indexOf(t) },
      hint: 'השוו לפינה של דף (זווית ישרה = 90°).',
      solution: [`הזווית היא ${deg}°.`, `${deg < 90 ? 'קטנה מ-90° ← חדה' : deg === 90 ? 'בדיוק 90° ← ישרה' : deg < 180 ? 'בין 90° ל-180° ← קהה' : '180° ← שטוחה'}.`],
    };
  }
  if (level === 2) {
    const deg = pick([30, 45, 60, 90, 120, 135, 150]);
    const all = [30, 45, 60, 90, 120, 135, 150, 170];
    const distract = all.filter((x) => Math.abs(x - deg) >= 30);
    return {
      prompt: 'אמדו: בערך כמה מעלות יש בזווית?',
      visual: { type: 'angle', degrees: deg, showArc: true },
      answer: choice(`${deg}°`, shuffleTake(distract, 3).map((x) => `${x}°`)),
      hint: 'זווית ישרה = 90°, חצי ממנה = 45°. האם הזווית גדולה מישרה או קטנה ממנה?',
      solution: [`הזווית היא בערך ${deg}° – ${deg < 90 ? 'קטנה' : deg === 90 ? 'שווה' : 'גדולה'} מזווית ישרה.`],
    };
  }
  const kind = pick(['straight', 'compass', 'runway'] as const);
  if (kind === 'straight') {
    const a = randInt(20, 160);
    return {
      prompt: `שתי זוויות יחד יוצרות זווית שטוחה. אחת מהן ${a}°. כמה מעלות בזווית השנייה?`,
      answer: { kind: 'number', value: 180 - a },
      hint: 'זווית שטוחה = 180°.',
      solution: [`[[180 - ${a} = ${180 - a}]]°`],
    };
  }
  if (kind === 'compass') {
    const dirs = ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'];
    const s = randInt(0, 7);
    const turn = pick([45, 90, 135, 180]);
    const cw = chance(0.5);
    const e = (s + (cw ? 1 : -1) * (turn / 45) + 8) % 8;
    return {
      prompt: `אתם עומדים ופניכם ל${dirs[s]}. מסתובבים ${turn}° ${cw ? 'עם' : 'נגד'} כיוון השעון. לאיזה כיוון אתם פונים עכשיו?`,
      visual: { type: 'compass' },
      answer: choice(dirs[e], [dirs[(e + 2) % 8], dirs[(e + 6) % 8], dirs[(e + 4) % 8], dirs[(e + 1) % 8]]),
      hint: 'בשושנת הרוחות, בין כל שני כיוונים סמוכים יש 45°.',
      solution: [`${turn}° זה ${turn / 45} צעדים של 45° ${cw ? 'עם' : 'נגד'} כיוון השעון.`, `מ${dirs[s]} מגיעים ל${dirs[e]}.`],
    };
  }
  const r = randInt(1, 36);
  const other = r > 18 ? r - 18 : r + 18;
  const pad = (x: number) => String(x).padStart(2, '0');
  return {
    prompt: `מסלולי המראה נקראים לפי הזווית שלהם עם הצפון, בלי האפס האחרון (מסלול ${pad(r)} פונה ל-${r * 10}°). מה מספר המסלול כשנוסעים עליו בכיוון ההפוך?`,
    answer: { kind: 'number', value: other },
    hint: 'כיוון הפוך = סיבוב של 180°. כמה זה במספר מסלול?',
    solution: [`[[${r * 10}° + 180° = ${r * 10 + 180}°]]`, `מספר המסלול: ${pad(other)}.`],
  };
}

function shuffleTake<T>(a: T[], n: number): T[] {
  return [...a].sort(() => Math.random() - 0.5).slice(0, n);
}

/* ---------------- ד2-3. מרובעים וריצוף ---------------- */

const QUAD_NAMES: Record<QuadKind, string> = {
  square: 'ריבוע',
  rectangle: 'מלבן',
  rhombus: 'מעוין',
  parallelogram: 'מקבילית',
  trapezoid: 'טרפז',
  kite: 'דלתון',
};

const TRUE_FALSE: { s: string; t: boolean; why: string }[] = [
  { s: 'בכל מלבן האלכסונים שווים זה לזה.', t: true, why: 'במלבן האלכסונים שווים באורכם.' },
  { s: 'בכל מעוין כל הצלעות שוות.', t: true, why: 'זו ההגדרה של מעוין.' },
  { s: 'בכל מעוין כל הזוויות ישרות.', t: false, why: 'רק במעוין שהוא גם ריבוע. מעוין "נטוי" אין לו זוויות ישרות.' },
  { s: 'בכל מקבילית הצלעות הנגדיות שוות.', t: true, why: 'במקבילית כל זוג צלעות נגדיות מקבילות ושוות.' },
  { s: 'לטרפז יש בדיוק זוג אחד של צלעות מקבילות.', t: true, why: 'זו ההגדרה של טרפז (בתכנית בית הספר).' },
  { s: 'במעוין האלכסונים מאונכים זה לזה.', t: true, why: 'אלכסוני המעוין מאונכים.' },
  { s: 'בכל מקבילית האלכסונים מאונכים זה לזה.', t: false, why: 'רק במעוין (ובריבוע). במקבילית רגילה – לא.' },
  { s: 'לדלתון יש שני זוגות של צלעות סמוכות שוות.', t: true, why: 'זו ההגדרה של דלתון.' },
  { s: 'בכל מלבן כל הצלעות שוות.', t: false, why: 'רק אם המלבן הוא ריבוע.' },
  { s: 'במקבילית הזוויות הנגדיות שוות.', t: true, why: 'במקבילית זוויות נגדיות שוות.' },
  { s: 'לטרפז יש שתי זוויות ישרות תמיד.', t: false, why: 'רק לטרפז ישר-זווית.' },
];

const INCLUSION: { s: string; t: boolean; why: string }[] = [
  { s: 'כל ריבוע הוא מלבן.', t: true, why: 'לריבוע 4 זוויות ישרות – לכן הוא מלבן.' },
  { s: 'כל מלבן הוא ריבוע.', t: false, why: 'למלבן לא תמיד כל הצלעות שוות.' },
  { s: 'כל ריבוע הוא מעוין.', t: true, why: 'לריבוע 4 צלעות שוות – לכן הוא מעוין.' },
  { s: 'כל מעוין הוא ריבוע.', t: false, why: 'למעוין לא תמיד יש זוויות ישרות.' },
  { s: 'כל מלבן הוא מקבילית.', t: true, why: 'במלבן הצלעות הנגדיות מקבילות.' },
  { s: 'כל מקבילית היא מלבן.', t: false, why: 'למקבילית לא תמיד יש זוויות ישרות.' },
  { s: 'כל מעוין הוא מקבילית.', t: true, why: 'במעוין הצלעות הנגדיות מקבילות.' },
  { s: 'כל מעוין הוא דלתון.', t: true, why: 'במעוין כל הצלעות שוות, אז בוודאי יש שני זוגות צלעות סמוכות שוות.' },
  { s: 'כל טרפז הוא מקבילית.', t: false, why: 'בטרפז יש רק זוג אחד של צלעות מקבילות.' },
];

function tf(item: { s: string; t: boolean; why: string }, prompt: string): Question {
  return {
    prompt: `${prompt}\n**${item.s}**`,
    answer: { kind: 'choice', options: ['נכון ✔', 'לא נכון ✘'], correct: item.t ? 0 : 1 },
    hint: 'נסו לצייר דוגמה – ואם אפשר, גם דוגמה נגדית.',
    solution: [item.why],
  };
}

function quadsQ(level: Level): Question {
  if (level === 1) {
    const kind = pick(Object.keys(QUAD_NAMES) as QuadKind[]);
    return {
      prompt: 'איך נקרא המרובע? (בחרו את השם המדויק ביותר)',
      visual: { type: 'quad', kind },
      answer: choice(QUAD_NAMES[kind], Object.values(QUAD_NAMES).filter((n) => n !== QUAD_NAMES[kind]).sort(() => Math.random() - 0.5)),
      hint: 'בדקו: כמה זוגות של צלעות מקבילות? האם הצלעות שוות? האם יש זוויות ישרות?',
      solution: [
        {
          square: 'ריבוע: 4 צלעות שוות ו-4 זוויות ישרות.',
          rectangle: 'מלבן: 4 זוויות ישרות, צלעות נגדיות שוות.',
          rhombus: 'מעוין: 4 צלעות שוות, הזוויות לא ישרות.',
          parallelogram: 'מקבילית: שני זוגות של צלעות מקבילות.',
          trapezoid: 'טרפז: זוג אחד בלבד של צלעות מקבילות.',
          kite: 'דלתון: שני זוגות של צלעות סמוכות שוות.',
        }[kind],
      ],
    };
  }
  if (level === 2) {
    if (chance(0.5)) return tf(pick(TRUE_FALSE), 'נכון או לא נכון?');
    const qs: [string, QuadKind][] = [
      ['באיזה מרובע כל הצלעות שוות, אבל הזוויות לא חייבות להיות ישרות?', 'rhombus'],
      ['באיזה מרובע יש בדיוק זוג אחד של צלעות מקבילות?', 'trapezoid'],
      ['לאיזה מרובע 4 זוויות ישרות, אבל הצלעות לא חייבות להיות שוות?', 'rectangle'],
      ['לאיזה מרובע יש שני זוגות של צלעות סמוכות שוות (ולא כל הצלעות שוות)?', 'kite'],
      ['לאיזה מרובע 4 צלעות שוות ו-4 זוויות ישרות?', 'square'],
    ];
    const [q, k] = pick(qs);
    return {
      prompt: q,
      answer: choice(QUAD_NAMES[k], Object.values(QUAD_NAMES).filter((n) => n !== QUAD_NAMES[k]).sort(() => Math.random() - 0.5)),
      hint: 'חשבו על התכונות של כל מרובע.',
      solution: [`${QUAD_NAMES[k]}.`],
    };
  }
  if (chance(0.65)) return tf(pick(INCLUSION), 'נכון או לא נכון?');
  const polys = ['משולש שווה צלעות', 'ריבוע', 'משושה משוכלל'];
  const nots = ['מחומש משוכלל', 'מתומן משוכלל', 'משובע משוכלל'];
  const good = pick(polys);
  return {
    prompt: 'באיזה מצולע משוכלל אפשר לרצף משטח (בלי רווחים ובלי חפיפות), כשכל המרצפות זהות?',
    answer: choice(good, nots),
    hint: 'אפשר לרצף רק אם הזוויות שנפגשות בנקודה אחת משלימות בדיוק סיבוב שלם (360°).',
    solution: ['רק שלושה מצולעים משוכללים מרצפים: משולש שווה צלעות, ריבוע ומשושה משוכלל.', `לכן התשובה: ${good}.`],
  };
}

/* ---------------- ד4. משולשים וגבהים ---------------- */

function trianglesQ(level: Level): Question {
  if (level === 1) {
    if (chance(0.5)) {
      const kind = pick(['eq', 'iso', 'sca'] as const);
      const a = randInt(3, 12);
      const s = Math.max(a, 5); // keeps the scalene triangle valid (triangle inequality)
      const sides = kind === 'eq' ? [a, a, a] : kind === 'iso' ? [a, a, randInt(2, 2 * a - 1)] : [s, s + randInt(1, 2), s + randInt(3, 4)];
      if (kind === 'iso' && sides[2] === a) sides[2] = a + 1;
      const name = { eq: 'שווה צלעות', iso: 'שווה שוקיים', sca: 'שונה צלעות' }[kind];
      return {
        prompt: `אורכי הצלעות של משולש: [[${sides.join(' , ')}]] ס"מ. איזה משולש זה?`,
        answer: { kind: 'choice', options: ['שווה צלעות', 'שווה שוקיים', 'שונה צלעות'], correct: ['שווה צלעות', 'שווה שוקיים', 'שונה צלעות'].indexOf(name) },
        hint: 'כמה צלעות שוות זו לזו?',
        solution: [kind === 'eq' ? 'כל שלוש הצלעות שוות.' : kind === 'iso' ? 'שתי צלעות שוות (השוקיים).' : 'כל הצלעות שונות.', `לכן: משולש ${name}.`],
      };
    }
    const kind = pick(['acute', 'right', 'obtuse'] as const);
    const big = kind === 'acute' ? randInt(61, 85) : kind === 'right' ? 90 : randInt(100, 140);
    const rest = 180 - big;
    const b = randInt(Math.max(10, rest - big + 1), Math.min(big - 1, rest - 10));
    const angles = [big, b, rest - b].sort(() => Math.random() - 0.5);
    const name = { acute: 'חד זוויות', right: 'ישר זווית', obtuse: 'קהה זווית' }[kind];
    return {
      prompt: `הזוויות של משולש: [[${angles.map((x) => x + '°').join(' , ')}]]. איזה משולש זה?`,
      answer: { kind: 'choice', options: ['חד זוויות', 'ישר זווית', 'קהה זווית'], correct: ['חד זוויות', 'ישר זווית', 'קהה זווית'].indexOf(name) },
      hint: 'חפשו את הזווית הגדולה ביותר: האם היא חדה, ישרה או קהה?',
      solution: [`הזווית הגדולה היא ${big}° – ${angleType(big)}.`, `לכן: משולש ${name}.`],
    };
  }
  if (level === 2) {
    if (chance(0.55)) {
      const isHeight = chance(0.5);
      const apexX = pick([0.3, 0.45, 0.6, 0.75]);
      return {
        prompt: 'האם הקו המקווקו הוא **גובה** במשולש?',
        visual: { type: 'triangleHeight', apexX, isHeight },
        answer: { kind: 'choice', options: ['כן, זה גובה', 'לא, זה לא גובה'], correct: isHeight ? 0 : 1 },
        hint: 'גובה יוצא מקדקוד ו**מאונך** לצלע שמולו (יוצר זווית ישרה).',
        solution: [isHeight ? 'הקו יוצא מהקדקוד ויוצר זווית ישרה עם הצלע שמולו – זה גובה.' : 'הקו לא מאונך לצלע (הזווית אינה ישרה) – לכן זה לא גובה.'],
      };
    }
    const qs: { q: string; a: string; d: string[]; why: string }[] = [
      { q: 'כמה גבהים יש לכל משולש?', a: '3', d: ['1', '2', '4'], why: 'מכל קדקוד אפשר להוריד גובה לצלע שמולו – 3 גבהים.' },
      { q: 'במשולש ישר זווית, שניים מהגבהים הם...', a: 'הניצבים (הצלעות שליד הזווית הישרה)', d: ['היתר והניצב', 'מחוץ למשולש', 'אלכסונים'], why: 'הניצבים מאונכים זה לזה, לכן כל אחד מהם הוא גובה לשני.' },
      { q: 'במשולש קהה זווית, כמה גבהים נמצאים מחוץ למשולש?', a: '2', d: ['0', '1', '3'], why: 'שני הגבהים שיוצאים מהזוויות החדות נופלים מחוץ למשולש (על המשך הצלע).' },
      { q: 'גובה במקבילית הוא קטע...', a: 'מאונך לשתי צלעות מקבילות, שמחבר ביניהן', d: ['שמחבר שני קדקודים נגדיים', 'ששווה לצלע הקצרה', 'שיוצא תמיד מאמצע הצלע'], why: 'גובה במקבילית הוא המרחק בין שתי צלעות מקבילות – קטע מאונך לשתיהן.' },
    ];
    const it = pick(qs);
    return { prompt: it.q, answer: choice(it.a, it.d), hint: 'גובה = קטע מאונך מקדקוד לצלע שמולו (או להמשכה).', solution: [it.why] };
  }
  // level 3 – height via area
  const area2 = pick([60, 72, 84, 96, 120, 144, 180]);
  const divisors = [];
  for (let i = 4; i <= 20; i++) if (area2 % i === 0 && area2 / i >= 3 && area2 / i <= 30) divisors.push(i);
  const s1 = pick(divisors);
  let s2 = pick(divisors);
  if (s2 === s1) s2 = divisors[(divisors.indexOf(s1) + 1) % divisors.length];
  if (s1 === s2) return trianglesQ(level);
  const h1 = area2 / s1, h2 = area2 / s2;
  return {
    prompt: `במשולש, אורכה של צלע אחת ${s1} ס"מ ואורכה של צלע אחרת ${s2} ס"מ. הגובה לצלע שאורכה ${s1} ס"מ הוא ${h1} ס"מ. מה אורך הגובה לצלע שאורכה ${s2} ס"מ?`,
    answer: { kind: 'number', value: h2, unit: 'ס"מ' },
    hint: 'שטח המשולש לא משתנה, לא משנה לפי איזו צלע מחשבים. חשבו את השטח קודם.',
    solution: [`שטח: [[(${s1} × ${h1}) : 2 = ${area2 / 2}]] סמ"ר.`, `[[(${s2} × ?) : 2 = ${area2 / 2}]] ← [[${s2} × ? = ${area2}]]`, `[[? = ${area2} : ${s2} = ${h2}]] ס"מ.`],
  };
}

/* ---------------- ה. שטחים והיקפים ---------------- */

function areaQ(level: Level): Question {
  if (level === 1) {
    const w = randInt(3, 15), h = randInt(2, 12);
    const perim = chance(0.45);
    return {
      prompt: `מה ${perim ? 'ההיקף' : 'השטח'} של המלבן?`,
      visual: { type: 'rect', w, h, unit: 'ס"מ' },
      answer: { kind: 'number', value: perim ? 2 * (w + h) : w * h, unit: perim ? 'ס"מ' : 'סמ"ר' },
      hint: perim ? 'היקף = סכום כל הצלעות.' : 'שטח מלבן = אורך × רוחב.',
      solution: perim ? [`[[${w} + ${h} + ${w} + ${h} = ${2 * (w + h)}]] ס"מ`] : [`[[${w} × ${h} = ${w * h}]] סמ"ר`],
    };
  }
  if (level === 2) {
    const kind = pick(['para', 'tri', 'tri', 'missing'] as const);
    if (kind === 'para') {
      const base = randInt(4, 15), height = randInt(3, 10), side = height + randInt(1, 4);
      return {
        prompt: 'מה השטח של המקבילית?',
        visual: { type: 'parallelogram', base, height, side, unit: 'ס"מ' },
        answer: { kind: 'number', value: base * height, unit: 'סמ"ר' },
        hint: 'שטח מקבילית = צלע × הגובה לצלע הזו (לא הצלע המשופעת!).',
        solution: [`[[${base} × ${height} = ${base * height}]] סמ"ר`, `(הצלע המשופעת ${side} לא משתתפת בחישוב השטח.)`],
      };
    }
    if (kind === 'tri') {
      let base = randInt(4, 16), height = randInt(3, 12);
      if ((base * height) % 2) base++;
      const obtuse = chance(0.3);
      return {
        prompt: 'מה השטח של המשולש?',
        visual: { type: 'triangleArea', base, height, unit: 'ס"מ', obtuse },
        answer: { kind: 'number', value: (base * height) / 2, unit: 'סמ"ר' },
        hint: 'שטח משולש = (צלע × הגובה לצלע) : 2. משולש הוא חצי ממלבן/מקבילית.',
        solution: [`[[(${base} × ${height}) : 2 = ${base * height} : 2 = ${(base * height) / 2}]] סמ"ר`],
      };
    }
    const w = randInt(3, 12), h = randInt(3, 12);
    return {
      prompt: `שטח מלבן הוא ${w * h} סמ"ר. אורך צלע אחת ${w} ס"מ. מה אורך הצלע השנייה?`,
      answer: { kind: 'number', value: h, unit: 'ס"מ' },
      hint: `איזה מספר כפול ${w} נותן ${w * h}?`,
      solution: [`[[${w * h} : ${w} = ${h}]] ס"מ`],
    };
  }
  const kind = pick(['L', 'L', 'units', 'square'] as const);
  if (kind === 'L') {
    const W = randInt(6, 14), H = randInt(6, 12), cutW = randInt(2, W - 3), cutH = randInt(2, H - 3);
    const perim = chance(0.4);
    const area = W * H - cutW * cutH;
    return {
      prompt: `מה ${perim ? 'ההיקף' : 'השטח'} של הצורה? (כל הזוויות ישרות)`,
      visual: { type: 'lShape', W, H, cutW, cutH, unit: 'ס"מ' },
      answer: { kind: 'number', value: perim ? 2 * (W + H) : area, unit: perim ? 'ס"מ' : 'סמ"ר' },
      hint: perim ? 'חשבו את אורכי הצלעות החסרות. טריק: ההיקף שווה להיקף המלבן השלם!' : 'חשבו את המלבן הגדול, והחסירו את המלבן שנחתך.',
      solution: perim
        ? [`הצלעות החסרות: [[${W} - ${cutW} = ${W - cutW}]] ו-[[${H} - ${cutH} = ${H - cutH}]].`, `[[${W} + ${H} + ${W - cutW} + ${cutH} + ${cutW} + ${H - cutH} = ${2 * (W + H)}]] ס"מ`]
        : [`מלבן גדול: [[${W} × ${H} = ${W * H}]]`, `החלק החסר: [[${cutW} × ${cutH} = ${cutW * cutH}]]`, `[[${W * H} - ${cutW * cutH} = ${area}]] סמ"ר`],
    };
  }
  if (kind === 'units') {
    const items: { q: string; a: number; why: string }[] = [
      { q: 'כמה סמ"ר יש במ"ר אחד?', a: 10000, why: 'מ"ר = ריבוע של 100 ס"מ על 100 ס"מ: [[100 × 100 = 10,000]] סמ"ר.' },
      { q: 'כמה מ"ר יש בדונם אחד?', a: 1000, why: 'דונם = 1,000 מ"ר.' },
      { q: 'כמה ממ"ר יש בסמ"ר אחד?', a: 100, why: 'סמ"ר = 10 מ"מ על 10 מ"מ: [[10 × 10 = 100]] ממ"ר.' },
      { q: 'כמה סמ"ר יש בדצמ"ר אחד?', a: 100, why: 'דצמ"ר = 10 ס"מ על 10 ס"מ: [[10 × 10 = 100]] סמ"ר.' },
      { q: `מגרש בשטח ${randInt(2, 9)} דונם. כמה מ"ר זה?`, a: 0, why: '' },
    ];
    const it = pick(items);
    if (it.a === 0) {
      const n = Number(it.q.match(/\d+/)![0]);
      return { prompt: it.q, answer: { kind: 'number', value: n * 1000, unit: 'מ"ר' }, hint: 'דונם = 1,000 מ"ר.', solution: [`[[${n} × 1,000 = ${fmt(n * 1000)}]] מ"ר`] };
    }
    return { prompt: it.q, answer: { kind: 'number', value: it.a }, hint: 'ציירו ריבוע וחשבו כמה יחידות קטנות נכנסות בכל צלע.', solution: [it.why] };
  }
  const s = randInt(3, 12);
  return {
    prompt: `היקף של ריבוע הוא ${4 * s} ס"מ. מה השטח שלו?`,
    answer: { kind: 'number', value: s * s, unit: 'סמ"ר' },
    hint: 'מצאו קודם את אורך הצלע (לריבוע 4 צלעות שוות).',
    solution: [`צלע: [[${4 * s} : 4 = ${s}]] ס"מ`, `שטח: [[${s} × ${s} = ${s * s}]] סמ"ר`],
  };
}

export const geometryTopics: Topic[] = [
  {
    id: 'angles',
    unit: UNIT,
    title: 'זוויות ושושנת הרוחות',
    emoji: '📐',
    lesson: [
      { kind: 'text', text: 'זווית נמדדת ב**מעלות** (°). סיבוב שלם = 360°.' },
      { kind: 'visual', visual: { type: 'angle', degrees: 45, showArc: true }, caption: '**חדה** – פחות מ-90°' },
      { kind: 'visual', visual: { type: 'angle', degrees: 90, showArc: true }, caption: '**ישרה** – בדיוק 90° (כמו פינת דף)' },
      { kind: 'visual', visual: { type: 'angle', degrees: 130, showArc: true }, caption: '**קהה** – בין 90° ל-180°' },
      { kind: 'text', text: '**שטוחה** – 180°, נראית כמו קו ישר.' },
      { kind: 'visual', visual: { type: 'compass' }, caption: 'שושנת הרוחות: 4 כיוונים ראשיים ו-4 משניים. בין כל שניים סמוכים – 45°.' },
    ],
    generate: anglesQ,
  },
  {
    id: 'quadrilaterals',
    unit: UNIT,
    title: 'מרובעים וריצוף',
    emoji: '🔷',
    lesson: [
      { kind: 'visual', visual: { type: 'quad', kind: 'parallelogram' }, caption: '**מקבילית** – שני זוגות של צלעות מקבילות' },
      { kind: 'visual', visual: { type: 'quad', kind: 'rectangle' }, caption: '**מלבן** – מקבילית עם 4 זוויות ישרות' },
      { kind: 'visual', visual: { type: 'quad', kind: 'rhombus' }, caption: '**מעוין** – מקבילית עם 4 צלעות שוות' },
      { kind: 'visual', visual: { type: 'quad', kind: 'square' }, caption: '**ריבוע** – גם מלבן וגם מעוין!' },
      { kind: 'visual', visual: { type: 'quad', kind: 'trapezoid' }, caption: '**טרפז** – זוג אחד בלבד של צלעות מקבילות' },
      { kind: 'visual', visual: { type: 'quad', kind: 'kite' }, caption: '**דלתון** – שני זוגות של צלעות סמוכות שוות' },
      { kind: 'tip', text: '**קשרי הכלה**: כל ריבוע הוא מלבן, אבל לא כל מלבן הוא ריבוע.' },
      { kind: 'text', text: '**ריצוף**: מבין המצולעים המשוכללים, רק משולש שווה צלעות, ריבוע ומשושה משוכלל מרצפים משטח.' },
    ],
    generate: quadsQ,
  },
  {
    id: 'triangles-heights',
    unit: UNIT,
    title: 'משולשים וגבהים',
    emoji: '🔺',
    lesson: [
      { kind: 'text', text: 'לפי **צלעות**: שווה צלעות (3 שוות), שווה שוקיים (2 שוות), שונה צלעות.' },
      { kind: 'text', text: 'לפי **זוויות**: חד זוויות (כל הזוויות חדות), ישר זווית (זווית אחת ישרה), קהה זווית (זווית אחת קהה).' },
      { kind: 'visual', visual: { type: 'triangleHeight', apexX: 0.4, isHeight: true }, caption: '**גובה** – קטע מקדקוד, **מאונך** לצלע שמולו' },
      { kind: 'text', text: 'בכל משולש יש **3 גבהים**. במשולש ישר זווית – שניים מהם הם הניצבים. במשולש קהה זווית – שניים נופלים **מחוץ** למשולש.' },
      { kind: 'tip', text: 'גם במקבילית יש גובה: קטע מאונך בין שתי צלעות מקבילות.' },
    ],
    generate: trianglesQ,
  },
  {
    id: 'area-perimeter',
    unit: UNIT,
    title: 'שטח והיקף',
    emoji: '🟩',
    lesson: [
      { kind: 'text', text: '**היקף** – אורך המסגרת (ס"מ). **שטח** – כמה משטח הצורה מכסה (סמ"ר).' },
      { kind: 'visual', visual: { type: 'rect', w: 6, h: 4, unit: 'ס"מ' }, caption: 'מלבן: שטח [[6 × 4 = 24]] סמ"ר, היקף [[6 + 4 + 6 + 4 = 20]] ס"מ' },
      { kind: 'visual', visual: { type: 'parallelogram', base: 6, height: 4, side: 5, unit: 'ס"מ' }, caption: 'מקבילית: שטח = צלע × גובה = [[6 × 4 = 24]]' },
      { kind: 'visual', visual: { type: 'triangleArea', base: 6, height: 4, unit: 'ס"מ' }, caption: 'משולש: שטח = (צלע × גובה) : 2 = [[24 : 2 = 12]]' },
      { kind: 'text', text: 'יחידות שטח: [[1]] מ"ר = [[10,000]] סמ"ר. [[1]] דונם = [[1,000]] מ"ר. [[1]] סמ"ר = [[100]] ממ"ר.' },
      { kind: 'tip', text: 'צורה מורכבת – מפרקים למלבנים, או מחסירים חלק חסר ממלבן גדול.' },
    ],
    generate: areaQ,
  },
];
