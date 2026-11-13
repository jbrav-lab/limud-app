import type { Level, Question, Topic } from '../../../engine/types';
import { choice, chance, fmt, person, pick, randInt, shuffle } from '../../../engine/math';

/* =====================================================================
   Unit: shapes and solids (פרקים ו–ז)
   ===================================================================== */

const POLYGONS: [string, number][] = [
  ['משולש', 3],
  ['מרובע', 4],
  ['מחומש', 5],
  ['משושה', 6],
  ['משובע', 7],
  ['מתומן', 8],
];

function polygonsQ(level: Level): Question {
  if (level === 1) {
    const [name, n] = pick(POLYGONS);
    if (chance(0.5)) {
      return {
        prompt: `כמה צלעות יש ל**${name}**?`,
        answer: { kind: 'number', value: n },
        hint: 'השם רומז: מחומש – 5, משושה – 6...',
        solution: [`ל${name} יש ${n} צלעות ו־${n} קדקודים.`],
      };
    }
    return {
      prompt: `איך נקרא מצולע עם [[${n}]] צלעות?`,
      answer: choice(name, POLYGONS.filter(([x]) => x !== name).map(([x]) => x)),
      hint: 'מספר הצלעות שווה למספר הקדקודים.',
      solution: [`מצולע עם ${n} צלעות הוא ${name}.`],
    };
  }
  if (level === 2) {
    if (chance(0.6)) {
      const a = randInt(20, 110), b = randInt(20, 160 - a);
      return {
        prompt: `במשולש יש זווית של [[${a}°]] וזווית של [[${b}°]]. מה גודל הזווית השלישית?`,
        answer: { kind: 'number', value: 180 - a - b, unit: 'מעלות' },
        hint: 'סכום הזוויות בכל משולש הוא [[180°]].',
        solution: [`[[180 - ${a} - ${b} = ${180 - a - b}]]`],
      };
    }
    const angles = (() => {
      const kind = pick(['acute', 'right', 'obtuse'] as const);
      const big = kind === 'right' ? 90 : kind === 'obtuse' ? randInt(95, 150) : randInt(61, 85);
      const rest = 180 - big;
      const x = kind === 'acute' ? randInt(Math.max(1, rest - 85), Math.min(85, rest - 1)) : randInt(10, rest - 10);
      return { kind, list: shuffle([big, x, rest - x]) };
    })();
    const label = { acute: 'חד־זווית', right: 'ישר־זווית', obtuse: 'קהה־זווית' }[angles.kind];
    return {
      prompt: `הזוויות במשולש הן [[${angles.list.map((x) => `${x}°`).join(', ')}]]. איזה משולש זה?`,
      answer: { kind: 'choice', options: ['חד־זווית', 'ישר־זווית', 'קהה־זווית'], correct: ['acute', 'right', 'obtuse'].indexOf(angles.kind) },
      hint: 'ישר־זווית – יש זווית של [[90°]]. קהה־זווית – יש זווית גדולה מ־[[90°]]. חד־זווית – כל הזוויות קטנות מ־[[90°]].',
      solution: [`הזווית הגדולה היא [[${Math.max(...angles.list)}°]] ← משולש ${label}.`],
    };
  }
  if (chance(0.5)) {
    const [name, n] = pick(POLYGONS.slice(1));
    const fromOne = chance(0.5);
    return {
      prompt: fromOne ? `כמה אלכסונים אפשר לשרטט **מקדקוד אחד** של ${name}?` : `כמה אלכסונים יש ל**${name}** בסך הכול?`,
      answer: { kind: 'number', value: fromOne ? n - 3 : (n * (n - 3)) / 2 },
      hint: 'אלכסון מחבר שני קדקודים שאינם שכנים. מקדקוד אחד אי אפשר לשרטט אלכסון לעצמו ולשני השכנים.',
      solution: fromOne
        ? [`[[${n} - 3 = ${n - 3}]] אלכסונים מכל קדקוד.`]
        : [`מכל קדקוד ${n - 3} אלכסונים: [[${n} × ${n - 3} = ${n * (n - 3)}]]`, `כל אלכסון נספר פעמיים: [[${n * (n - 3)} : 2 = ${(n * (n - 3)) / 2}]]`],
    };
  }
  const [q, a, d] = pick([
    ['איזו תכונה נכונה לכל **ריבוע**?', 'כל הצלעות שוות וכל הזוויות ישרות', ['רק שתי צלעות שוות', 'אין לו זוויות ישרות', 'יש לו 3 צלעות']],
    ['איזו תכונה נכונה לכל **מלבן**?', 'כל הזוויות ישרות והצלעות הנגדיות שוות', ['כל הצלעות שוות תמיד', 'יש לו זווית קהה', 'האלכסונים שלו תמיד מאונכים']],
    ['למשולש שבו **כל הצלעות שוות** קוראים:', 'משולש שווה־צלעות', ['משולש שווה־שוקיים בלבד', 'משולש שונה־צלעות', 'משולש קהה־זווית']],
    ['למשולש שבו **שתי צלעות שוות** קוראים:', 'משולש שווה־שוקיים', ['משולש שווה־צלעות', 'משולש שונה־צלעות', 'משולש ישר־זווית']],
    ['האם כל ריבוע הוא גם מלבן?', 'כן – יש לו ארבע זוויות ישרות', ['לא – ריבוע ומלבן הם צורות שונות', 'רק ריבוע גדול', 'רק כשהוא עומד על הצלע']],
  ] as const);
  return { prompt: q, answer: choice(a, [...d]), hint: 'חשבו על הצלעות ועל הזוויות.', solution: [a] };
}

function boxQ(level: Level): Question {
  if (level === 1) {
    const [what, n] = pick([['פאות', 6], ['מקצועות', 12], ['קדקודים', 8]] as const);
    return {
      prompt: `כמה **${what}** יש לתיבה?`,
      answer: { kind: 'number', value: n },
      hint: 'פאה – מלבן שמקיף את התיבה. מקצוע – קו שבו נפגשות שתי פאות. קדקוד – פינה.',
      solution: ['לתיבה 6 פאות, 12 מקצועות ו־8 קדקודים.'],
    };
  }
  const a = randInt(2, 10), b = randInt(2, 10), c = randInt(2, 10);
  if (level === 2) {
    if (chance(0.3)) {
      const e = randInt(2, 10);
      return {
        prompt: `אורך המקצוע של קובייה הוא [[${e}]] ס״מ. מה נפח הקובייה?`,
        answer: { kind: 'number', value: e ** 3, unit: 'סמ״ק' },
        hint: 'בקובייה כל המקצועות שווים: אורך × רוחב × גובה.',
        solution: [`[[${e} × ${e} × ${e} = ${e ** 3}]] סמ״ק`],
      };
    }
    return {
      prompt: `מה הנפח של תיבה שאורכה [[${a}]] ס״מ, רוחבה [[${b}]] ס״מ וגובהה [[${c}]] ס״מ?`,
      answer: { kind: 'number', value: a * b * c, unit: 'סמ״ק' },
      hint: 'נפח תיבה = אורך × רוחב × גובה.',
      solution: [`[[${a} × ${b} × ${c} = ${a * b * c}]] סמ״ק`],
    };
  }
  if (chance(0.5)) {
    const s = 2 * (a * b + b * c + a * c);
    return {
      prompt: `מה שטח הפנים של תיבה שמידותיה [[${a}]] ס״מ, [[${b}]] ס״מ ו־[[${c}]] ס״מ?`,
      answer: { kind: 'number', value: s, unit: 'סמ״ר' },
      hint: 'לתיבה 3 זוגות של פאות שוות. מחשבים שטח של כל זוג וכופלים ב־2.',
      solution: [`[[${a} × ${b} = ${a * b}]], [[${b} × ${c} = ${b * c}]], [[${a} × ${c} = ${a * c}]]`, `[[2 × (${a * b} + ${b * c} + ${a * c}) = ${s}]] סמ״ר`],
    };
  }
  const v = a * b * c;
  return {
    prompt: `נפח של תיבה הוא [[${v}]] סמ״ק. אורכה [[${a}]] ס״מ ורוחבה [[${b}]] ס״מ. מה גובהה?`,
    answer: { kind: 'number', value: c, unit: 'ס״מ' },
    hint: 'שטח הבסיס כפול הגובה = הנפח.',
    solution: [`שטח הבסיס: [[${a} × ${b} = ${a * b}]]`, `[[${v} : ${a * b} = ${c}]] ס״מ`],
  };
}

function areaPerimeterQ(level: Level): Question {
  if (level === 1) {
    const w = randInt(2, 12), h = randInt(2, 9);
    const area = chance(0.5);
    return {
      prompt: area ? 'מה השטח של המלבן?' : 'מה ההיקף של המלבן?',
      visual: { type: 'rect', w, h, unit: 'ס״מ', showLabels: { w: true, h: true } },
      answer: { kind: 'number', value: area ? w * h : 2 * (w + h), unit: area ? 'סמ״ר' : 'ס״מ' },
      hint: area ? 'שטח מלבן = אורך × רוחב.' : 'היקף = סכום כל הצלעות.',
      solution: area ? [`[[${w} × ${h} = ${w * h}]] סמ״ר`] : [`[[${w} + ${h} + ${w} + ${h} = ${2 * (w + h)}]] ס״מ`],
    };
  }
  if (level === 2) {
    if (chance(0.5)) {
      const s = randInt(2, 15), byArea = chance(0.5);
      return {
        prompt: byArea ? `שטח של ריבוע הוא [[${s * s}]] סמ״ר. מה אורך הצלע שלו?` : `היקף של ריבוע הוא [[${4 * s}]] ס״מ. מה אורך הצלע שלו?`,
        answer: { kind: 'number', value: s, unit: 'ס״מ' },
        hint: byArea ? 'איזה מספר כפול עצמו נותן את השטח?' : 'לריבוע 4 צלעות שוות.',
        solution: byArea ? [`[[${s} × ${s} = ${s * s}]] ← הצלע ${s} ס״מ`] : [`[[${4 * s} : 4 = ${s}]] ס״מ`],
      };
    }
    const w = randInt(3, 15), h = randInt(2, 12);
    return {
      prompt: `שטח של מלבן הוא [[${w * h}]] סמ״ר, ואורכו [[${w}]] ס״מ. מה רוחבו?`,
      answer: { kind: 'number', value: h, unit: 'ס״מ' },
      hint: 'שטח = אורך × רוחב, ולכן רוחב = שטח : אורך.',
      solution: [`[[${w * h} : ${w} = ${h}]] ס״מ`],
    };
  }
  if (chance(0.4)) {
    const m = randInt(2, 9);
    return {
      prompt: `כמה סמ״ר יש ב־[[${m}]] מ״ר?`,
      answer: { kind: 'number', value: m * 10000, unit: 'סמ״ר' },
      hint: '1 מ״ר הוא ריבוע של [[100]] ס״מ על [[100]] ס״מ.',
      solution: ['[[1 = 100 × 100 = 10,000]] סמ״ר במ״ר אחד', `[[${m} × 10,000 = ${fmt(m * 10000)}]] סמ״ר`],
    };
  }
  const p = person();
  const w = randInt(3, 9), h = randInt(2, 6);
  const price = randInt(20, 90);
  return {
    prompt: `${p.name} רוצה לרצף חדר באורך ${w} מטרים וברוחב ${h} מטרים. מטר רבוע של מרצפות עולה ${price} שקלים. כמה יעלו המרצפות לכל החדר?`,
    answer: { kind: 'number', value: w * h * price, unit: 'שקלים' },
    hint: 'קודם מחשבים את שטח החדר במטרים רבועים.',
    solution: [`שטח: [[${w} × ${h} = ${w * h}]] מ״ר`, `מחיר: [[${w * h} × ${price} = ${fmt(w * h * price)}]] שקלים`],
    wordProblem: true,
  };
}

function symmetryQ(level: Level): Question {
  if (level === 1) {
    const [shape, n, d] = pick([
      ['ריבוע', '4', ['2', '1', '0']],
      ['מלבן (שאינו ריבוע)', '2', ['4', '1', '0']],
      ['משולש שווה־צלעות', '3', ['1', '2', '0']],
      ['משולש שווה־שוקיים (שאינו שווה־צלעות)', '1', ['3', '2', '0']],
      ['משולש שונה־צלעות', '0', ['1', '2', '3']],
      ['עיגול', 'אינסוף', ['1', '2', '4']],
    ] as const);
    return {
      prompt: `כמה צירי סימטרייה יש ל**${shape}**?`,
      answer: choice(n, [...d]),
      hint: 'ציר סימטרייה מחלק את הצורה לשני חלקים שמתלכדים כשמקפלים לאורכו.',
      solution: [`ל${shape} יש ${n === 'אינסוף' ? 'אינסוף צירי סימטרייה – כל קוטר הוא ציר' : `${n} צירי סימטרייה`}.`],
    };
  }
  if (level === 2) {
    const [q, a, d] = pick([
      ['לאיזו צורה יש **ציר סימטרייה אחד בדיוק**?', 'משולש שווה־שוקיים', ['ריבוע', 'מלבן', 'משולש שונה־צלעות']],
      ['לאיזו צורה **אין** ציר סימטרייה?', 'משולש שונה־צלעות', ['ריבוע', 'עיגול', 'מלבן']],
      ['לאיזו ספרה יש ציר סימטרייה אופקי (קו שוכב)?', '8', ['7', '4', '2']],
      ['לאיזו אות אנגלית יש ציר סימטרייה אנכי (קו עומד)?', 'A', ['F', 'G', 'J']],
    ] as const);
    return { prompt: q, answer: choice(a, [...d]), hint: 'דמיינו שמקפלים את הצורה לאורך הציר.', solution: [a] };
  }
  const k = randInt(1, 6), side = pick(['משמאל', 'מימין'] as const);
  const other = side === 'משמאל' ? 'מימין' : 'משמאל';
  return {
    prompt: `נקודה נמצאת [[${k}]] משבצות ${side} לציר סימטרייה אנכי. איפה תהיה הנקודה אחרי שיקוף בציר?`,
    answer: choice(`${k} משבצות ${other} לציר`, [`${k} משבצות ${side} לציר`, `${k + 1} משבצות ${other} לציר`, `${2 * k} משבצות ${other} לציר`]),
    hint: 'בשיקוף, הנקודה עוברת לצד השני של הציר – באותו מרחק.',
    solution: [`אותו מרחק (${k} משבצות), בצד השני: ${other} לציר.`],
  };
}

/* =====================================================================
   Unit: measurement and data (פרקים ה, ח)
   ===================================================================== */

const MONTHS: [string, number][] = [
  ['ינואר', 31], ['מרץ', 31], ['אפריל', 30], ['מאי', 31], ['יוני', 30], ['יולי', 31], ['אוגוסט', 31], ['ספטמבר', 30], ['אוקטובר', 31], ['נובמבר', 30], ['דצמבר', 31],
];
const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

function timeQ(level: Level): Question {
  if (level === 1) {
    if (chance(0.5)) {
      const [m, d] = pick(MONTHS);
      return {
        prompt: `כמה ימים יש בחודש **${m}**?`,
        answer: { kind: 'number', value: d },
        hint: 'בחודשים אפריל, יוני, ספטמבר ונובמבר יש 30 ימים. בפברואר 28 (או 29). בכל השאר 31.',
        solution: [`ב${m} יש ${d} ימים.`],
      };
    }
    const [q, v] = pick([
      ['כמה דקות יש בשעה?', 60],
      ['כמה שעות יש ביממה?', 24],
      ['כמה ימים יש בשבוע?', 7],
      ['כמה חודשים יש בשנה?', 12],
      ['כמה שניות יש בדקה?', 60],
    ] as const);
    return { prompt: q, answer: { kind: 'number', value: v }, hint: 'יחידות זמן שכדאי לזכור.', solution: [`התשובה: ${v}`] };
  }
  if (level === 2) {
    if (chance(0.5)) {
      const h = randInt(2, 6), m = pick([0, 15, 30, 45]);
      return {
        prompt: `כמה דקות הן [[${h}]] שעות${m ? ` ו־[[${m}]] דקות` : ''}?`,
        answer: { kind: 'number', value: h * 60 + m, unit: 'דקות' },
        hint: 'בכל שעה 60 דקות.',
        solution: [`[[${h} × 60${m ? ` + ${m}` : ''} = ${h * 60 + m}]] דקות`],
      };
    }
    const w = randInt(2, 5), d = randInt(1, 6);
    return {
      prompt: `כמה ימים הם [[${w}]] שבועות ו־[[${d}]] ימים?`,
      answer: { kind: 'number', value: w * 7 + d, unit: 'ימים' },
      hint: 'בכל שבוע 7 ימים.',
      solution: [`[[${w} × 7 + ${d} = ${w * 7 + d}]] ימים`],
    };
  }
  const start = randInt(7 * 4, 16 * 4) * 15, len = randInt(3, 14) * 5 + 30;
  const end = start + len;
  if (chance(0.5)) {
    return {
      prompt: `הסרט התחיל בשעה [[${hhmm(start)}]] ונגמר בשעה [[${hhmm(end)}]]. כמה דקות נמשך הסרט?`,
      answer: { kind: 'number', value: len, unit: 'דקות' },
      hint: 'חשבו כמה דקות עד השעה העגולה הבאה, ואז כמה אחריה.',
      solution: [`מ־[[${hhmm(start)}]] עד [[${hhmm(end)}]] עברו ${len} דקות.`],
      wordProblem: true,
    };
  }
  return {
    prompt: `השיעור התחיל בשעה [[${hhmm(start)}]] ונמשך [[${len}]] דקות. מתי הוא נגמר?`,
    answer: choice(`[[${hhmm(end)}]]`, [`[[${hhmm(end + 10)}]]`, `[[${hhmm(end - 10)}]]`, `[[${hhmm(start + len + 60)}]]`]),
    hint: `[[${len}]] דקות הן ${Math.floor(len / 60) ? `שעה ו־${len % 60} דקות` : `${len} דקות`}.`,
    solution: [`[[${hhmm(start)}]] ועוד ${len} דקות ← [[${hhmm(end)}]]`],
    wordProblem: true,
  };
}

const CHART_SETS: { title: string; labels: string[]; unit: string }[] = [
  { title: 'פרי אהוב בכיתה', labels: ['תפוח', 'בננה', 'ענבים', 'אבטיח'], unit: 'תלמידים' },
  { title: 'ספרים שנקראו בחודש', labels: ['דנה', 'יואב', 'מאיה', 'איתי'], unit: 'ספרים' },
  { title: 'חיית מחמד בבית', labels: ['כלב', 'חתול', 'דג', 'תוכי'], unit: 'תלמידים' },
];

function dataQ(level: Level): Question {
  const set = pick(CHART_SETS);
  const values = set.labels.map(() => randInt(1, 12));
  const visual = { type: 'barChart' as const, labels: set.labels, values, title: set.title, showValues: level === 1 };
  if (level === 1) {
    const i = randInt(0, 3);
    return {
      prompt: `לפי הדיאגרמה, כמה ${set.unit} יש בעמודה **${set.labels[i]}**?`,
      visual,
      answer: { kind: 'number', value: values[i] },
      hint: 'מסתכלים על גובה העמודה.',
      solution: [`העמודה של ${set.labels[i]} מגיעה ל־${values[i]}.`],
    };
  }
  if (level === 2) {
    const [i, j] = shuffle([0, 1, 2, 3]).slice(0, 2);
    if (values[i] === values[j] || chance(0.4)) {
      const total = values.reduce((s, x) => s + x, 0);
      return {
        prompt: `לפי הדיאגרמה, כמה ${set.unit} יש בסך הכול?`,
        visual,
        answer: { kind: 'number', value: total },
        hint: 'מחברים את הגבהים של כל העמודות.',
        solution: [`[[${values.join(' + ')} = ${total}]]`],
      };
    }
    const [hi, lo] = values[i] > values[j] ? [i, j] : [j, i];
    return {
      prompt: `לפי הדיאגרמה, בכמה גדולה העמודה **${set.labels[hi]}** מהעמודה **${set.labels[lo]}**?`,
      visual,
      answer: { kind: 'number', value: values[hi] - values[lo] },
      hint: 'מוצאים את שני הערכים ומחסרים.',
      solution: [`[[${values[hi]} - ${values[lo]} = ${values[hi] - values[lo]}]]`],
    };
  }
  const r = randInt(1, 6), b = randInt(1, 6);
  const kind = pick(['certain', 'impossible', 'likely'] as const);
  if (kind === 'likely' && r === b) return dataQ(level);
  const more = r > b ? 'אדום' : 'כחול';
  const [q, a, d] =
    kind === 'certain'
      ? ['שולפים כדור בלי להסתכל. מה **ודאי** (בטוח)?', 'הכדור יהיה אדום או כחול', ['הכדור יהיה ירוק', 'הכדור יהיה אדום', 'הכדור יהיה כחול']]
      : kind === 'impossible'
        ? ['שולפים כדור בלי להסתכל. מה **בלתי אפשרי**?', 'הכדור יהיה ירוק', ['הכדור יהיה אדום', 'הכדור יהיה כחול', 'הכדור יהיה אדום או כחול']]
        : ['שולפים כדור בלי להסתכל. איזה צבע **סביר יותר**?', more, [more === 'אדום' ? 'כחול' : 'אדום', 'ירוק', 'הסיכוי שווה']];
  return {
    prompt: `בשקית יש [[${r}]] כדורים אדומים ו־[[${b}]] כדורים כחולים. ${q}`,
    answer: choice(a, d),
    hint: 'ודאי – תמיד קורה. בלתי אפשרי – אף פעם לא קורה. סביר יותר – יש ממנו יותר.',
    solution: [a],
  };
}

export const shapeTopics: Topic[] = [
  {
    id: 'polygons',
    unit: 'geometry',
    title: 'מצולעים ומשולשים',
    emoji: '🔺',
    lesson: [
      { kind: 'text', text: '**מצולע** – צורה סגורה שכל צלעותיה ישרות: משולש (3), מרובע (4), מחומש (5), משושה (6), מתומן (8).' },
      { kind: 'text', text: '**אלכסון** – קטע שמחבר שני קדקודים שאינם שכנים. מכל קדקוד יוצאים (מספר הצלעות פחות 3) אלכסונים.' },
      { kind: 'text', text: '**משולשים לפי זוויות:** חד־זווית, ישר־זווית (זווית של [[90°]]), קהה־זווית.\n**לפי צלעות:** שווה־צלעות, שווה־שוקיים, שונה־צלעות.' },
      { kind: 'tip', text: 'סכום הזוויות בכל משולש הוא [[180°]].' },
      { kind: 'visual', visual: { type: 'quad', kind: 'rectangle' }, caption: 'מלבן: ארבע זוויות ישרות, צלעות נגדיות שוות. ריבוע הוא מלבן שכל צלעותיו שוות.' },
    ],
    generate: polygonsQ,
  },
  {
    id: 'symmetry',
    unit: 'geometry',
    title: 'סימטרייה',
    emoji: '🦋',
    lesson: [
      { kind: 'text', text: '**ציר סימטרייה** מחלק צורה לשני חלקים זהים: אם מקפלים לאורכו, החלקים מתלכדים.' },
      { kind: 'example', text: 'לריבוע 4 צירים, למלבן 2, למשולש שווה־צלעות 3, ולעיגול – אינסוף.' },
      { kind: 'text', text: '**שיקוף:** כל נקודה עוברת לצד השני של הציר, **באותו מרחק** ממנו.' },
    ],
    generate: symmetryQ,
  },
  {
    id: 'boxes',
    unit: 'geometry',
    title: 'תיבה: נפח ושטח פנים',
    emoji: '📦',
    lesson: [
      { kind: 'text', text: 'לתיבה **6 פאות** (מלבנים), **12 מקצועות** ו**8 קדקודים**. קובייה היא תיבה שכל מקצועותיה שווים.' },
      { kind: 'text', text: '**נפח** – כמה קוביות של סנטימטר אחד (סמ״ק) נכנסות בתיבה:' },
      { kind: 'example', text: '', expression: 'נפח = אורך × רוחב × גובה' },
      { kind: 'text', text: '**שטח פנים** – סכום השטחים של כל 6 הפאות (בסמ״ר).' },
      { kind: 'example', text: 'תיבה 2 × 3 × 4:', expression: '2 × (2×3 + 3×4 + 2×4) = 2 × 26 = 52' },
    ],
    generate: boxQ,
  },
];

export const measureTopics: Topic[] = [
  {
    id: 'area-perimeter',
    unit: 'measure',
    title: 'שטח והיקף של מלבן',
    emoji: '📐',
    lesson: [
      { kind: 'visual', visual: { type: 'rect', w: 5, h: 3, unit: 'ס״מ', showLabels: { w: true, h: true } }, caption: 'מלבן 5 על 3' },
      { kind: 'text', text: '**היקף** – אורך הקו מסביב: [[5 + 3 + 5 + 3 = 16]] ס״מ.\n**שטח** – כמה ריבועים של סנטימטר מכסים את המלבן: [[5 × 3 = 15]] סמ״ר.' },
      { kind: 'tip', text: 'מטר רבוע (מ״ר) הוא ריבוע של מטר על מטר: [[1]] מ״ר = [[10,000]] סמ״ר.' },
    ],
    generate: areaPerimeterQ,
  },
  {
    id: 'time-calendar',
    unit: 'measure',
    title: 'זמן ולוח השנה',
    emoji: '🗓️',
    lesson: [
      { kind: 'text', text: '[[1]] שעה = [[60]] דקות · [[1]] יממה = [[24]] שעות · [[1]] שבוע = [[7]] ימים · [[1]] שנה = [[12]] חודשים' },
      { kind: 'text', text: 'ימים בחודש: 30 – אפריל, יוני, ספטמבר, נובמבר. 28 (ובשנה מעוברת 29) – פברואר. 31 – כל השאר.' },
      { kind: 'example', text: 'מ־[[9:40]] עד [[11:15]]: עד [[10:00]] – 20 דקות, עד [[11:00]] – עוד 60, ועוד 15. סך הכול [[95]] דקות.' },
    ],
    generate: timeQ,
  },
  {
    id: 'data',
    unit: 'measure',
    title: 'דיאגרמות וסיכוי',
    emoji: '📊',
    lesson: [
      { kind: 'visual', visual: { type: 'barChart', labels: ['כלב', 'חתול', 'דג'], values: [7, 5, 2], title: 'חיית מחמד', showValues: true }, caption: 'דיאגרמת עמודות: גובה העמודה מראה את הכמות.' },
      { kind: 'text', text: '**סיכוי:**\n**ודאי** – תמיד קורה.\n**בלתי אפשרי** – אף פעם לא קורה.\n**אפשרי** – יכול לקרות. אם יש יותר מסוג אחד – הוא **סביר יותר**.' },
    ],
    generate: dataQ,
  },
];
