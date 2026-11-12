import type { Level, Question, Topic } from '../engine/types';
import { choice, cmp, fr, frBoth, gcd, lcm, pick, randInt, shuffle, simplify, chance, person } from '../engine/math';

const UNIT = 'fractions';

/* ---------------- א1. משמעויות השבר ---------------- */

function meaningQ(level: Level): Question {
  const kind =
    level === 1 ? pick(['bar', 'bar', 'quantity'] as const) : level === 2 ? pick(['toMixed', 'toImproper', 'between'] as const) : pick(['line', 'quantity', 'division'] as const);

  if (kind === 'bar') {
    const parts = pick([3, 4, 5, 6, 8, 10]);
    const shaded = randInt(1, parts - 1);
    return {
      prompt: 'איזה חלק מהמלבן צבוע?',
      visual: { type: 'fractionBar', parts, shaded },
      answer: { kind: 'fraction', num: shaded, den: parts },
      hint: `ספרו לכמה חלקים שווים מחולק המלבן (זה המכנה), וכמה מהם צבועים (זה המונה).`,
      solution: [`המלבן מחולק ל-${parts} חלקים שווים, ${shaded} מהם צבועים.`, `לכן החלק הצבוע הוא [[${fr(shaded, parts)}]].`],
    };
  }
  if (kind === 'quantity') {
    const d = level === 1 ? pick([2, 3, 4, 5, 10]) : pick([3, 4, 5, 6, 8]);
    let n = level === 1 ? 1 : randInt(2, d - 1);
    while (gcd(n, d) !== 1) n = randInt(2, d - 1); // reduced fractions read naturally in a story
    const k = randInt(2, level === 1 ? 10 : 12);
    const total = d * k;
    const [item, them] = pick([['תפוחים', 'מהם'], ['גולות', 'מהן'], ['מדבקות', 'מהן'], ['קלפים', 'מהם'], ['עפרונות', 'מהם']] as const);
    return {
      prompt: `לנועה יש ${total} ${item}. היא נתנה לחברה ${frBoth(n, d)} ${them}. כמה ${item} נתנה?`,
      wordProblem: true,
      answer: { kind: 'number', value: n * k },
      hint: `קודם מצאו כמה זה [[${fr(1, d)}]] מ-${total}: מחלקים ל-${d} חלקים שווים.`,
      solution: [`[[${fr(1, d)}]] מ-${total} הוא [[${total} : ${d} = ${k}]].`, ...(n > 1 ? [`[[${fr(n, d)}]] הוא ${n} חלקים כאלה: [[${n} × ${k} = ${n * k}]].`] : []), `התשובה: ${n * k}.`],
    };
  }
  if (kind === 'toMixed') {
    const d = pick([2, 3, 4, 5, 6, 8, 10]);
    const w = randInt(1, 5);
    let r = randInt(1, d - 1);
    while (gcd(r, d) !== 1) r = randInt(1, d - 1);
    const n = w * d + r;
    return {
      prompt: `כתבו את השבר כמספר מעורב:`,
      expression: fr(n, d),
      answer: { kind: 'fraction', num: n, den: d, form: 'mixed', allowWhole: true },
      hint: `כמה פעמים ${d} נכנס ב-${n}? זה החלק השלם. מה שנשאר – הוא המונה.`,
      solution: [`[[${n} : ${d} = ${w}]] ושארית ${r}.`, `כלומר ${w} שלמים ועוד [[${fr(r, d)}]].`, `[[${fr(n, d)} = ${fr(n, d, true)}]]`],
    };
  }
  if (kind === 'toImproper') {
    const d = pick([2, 3, 4, 5, 6, 8]);
    const w = randInt(1, 6);
    const r = randInt(1, d - 1);
    const n = w * d + r;
    return {
      prompt: `כתבו את המספר המעורב כשבר (גדול מ-1):`,
      expression: `{${w} ${r}/${d}}`,
      answer: { kind: 'fraction', num: n, den: d },
      hint: `בכל שלם יש ${d} חלקים של [[${fr(1, d)}]]. כמה חלקים יש ב-${w} שלמים?`,
      solution: [`ב-${w} שלמים יש [[${w} × ${d} = ${w * d}]] חלקים של [[${fr(1, d)}]].`, `ועוד ${r} חלקים: [[${w * d} + ${r} = ${n}]].`, `[[{${w} ${r}/${d}} = ${fr(n, d)}]]`],
    };
  }
  if (kind === 'between') {
    const d = pick([3, 4, 5, 6, 7, 8]);
    const w = randInt(1, 8);
    const r = randInt(1, d - 1);
    const n = w * d + r;
    const correct = `${w} ו-${w + 1}`;
    return {
      prompt: `בין אילו שני מספרים שלמים נמצא השבר [[${fr(n, d)}]]?`,
      answer: choice(correct, [`${w - 1} ו-${w}`, `${w + 1} ו-${w + 2}`, `${n} ו-${n + 1}`, `${d} ו-${d + 1}`].filter((s) => !s.startsWith('-'))),
      hint: `חשבו כמה שלמים יש ב-[[${fr(n, d)}]]: כמה פעמים ${d} נכנס ב-${n}?`,
      solution: [`[[${w} × ${d} = ${w * d}]] ו-[[${w + 1} × ${d} = ${(w + 1) * d}]].`, `${n} נמצא בין ${w * d} ל-${(w + 1) * d}, לכן [[${fr(n, d)}]] נמצא בין ${w} ל-${w + 1}.`],
    };
  }
  if (kind === 'line') {
    const d = pick([2, 3, 4, 5, 6, 8]);
    const max = pick([1, 2, 2, 3]);
    let n = randInt(1, d * max - 1);
    if (n % d === 0) n++;
    return {
      prompt: `איזה שבר מסומן בחץ על ישר המספרים?`,
      visual: { type: 'numberLine', min: 0, max, ticksPerUnit: d, markAt: n / d, labels: true },
      answer: { kind: 'fraction', num: n, den: d, allowWhole: true },
      hint: `לכמה חלקים שווים מחולק כל קטע בין שני שלמים? כל קפיצה היא [[${fr(1, d)}]].`,
      solution: [`כל שלם מחולק ל-${d} חלקים, כל קפיצה היא [[${fr(1, d)}]].`, `החץ נמצא אחרי ${n} קפיצות מ-0, כלומר [[${fr(n, d)}]]${n > d ? ` (או [[${fr(n, d, true)}]])` : ''}.`],
    };
  }
  // division meaning
  const kids = pick([3, 4, 5, 6, 8]);
  let pizzas = randInt(1, kids * 2);
  if (pizzas % kids === 0) pizzas++;
  return {
    prompt: `${pizzas} פיצות חולקו שווה בשווה בין ${kids} ילדים. כמה פיצה קיבל כל ילד?`,
    wordProblem: true,
    answer: { kind: 'fraction', num: pizzas, den: kids, allowWhole: true },
    hint: `שבר הוא גם תוצאה של חילוק: [[${pizzas} : ${kids}]] אפשר לכתוב כשבר.`,
    solution: [`[[${pizzas} : ${kids} = ${fr(pizzas, kids)}]]`, ...(pizzas > kids ? [`כמספר מעורב: [[${fr(pizzas, kids, true)}]]`] : []), `כל ילד קיבל [[${fr(pizzas, kids)}]] פיצה.`],
  };
}

/* ---------------- א2. צמצום והרחבה ---------------- */

function equivalentQ(level: Level): Question {
  if (level === 1 || (level === 2 && chance(0.4))) {
    const d = pick([2, 3, 4, 5, 6]);
    const n = randInt(1, d - 1);
    const k = randInt(2, level === 1 ? 5 : 9);
    const askNum = chance(0.6);
    return {
      prompt: 'השלימו את המספר החסר:',
      expression: askNum ? `${fr(n, d)} = {?/${d * k}}` : `${fr(n, d)} = {${n * k}/?}`,
      answer: { kind: 'number', value: askNum ? n * k : d * k },
      hint: askNum ? `פי כמה גדל המכנה? (מ-${d} ל-${d * k}). גם המונה צריך לגדול פי אותו מספר.` : `פי כמה גדל המונה? (מ-${n} ל-${n * k}). גם המכנה צריך לגדול פי אותו מספר.`,
      solution: [`זו הרחבה פי ${k}: כופלים את המונה ואת המכנה ב-${k}.`, `[[${fr(n, d)} = {${n} × ${k}/${d} × ${k}} = ${fr(n * k, d * k)}]]`],
    };
  }
  if (level === 2) {
    const d = pick([3, 4, 5, 6, 7, 8, 9]);
    let n = randInt(1, d - 1);
    while (gcd(n, d) !== 1) n = randInt(1, d - 1);
    const k = randInt(2, 6);
    return {
      prompt: 'צמצמו את השבר עד הסוף:',
      expression: fr(n * k, d * k),
      answer: { kind: 'fraction', num: n, den: d, form: 'simplest' },
      hint: `חפשו מספר שמחלק גם את ${n * k} וגם את ${d * k}.`,
      solution: [`גם ${n * k} וגם ${d * k} מתחלקים ב-${k}.`, `[[${fr(n * k, d * k)} = {${n * k} : ${k}/${d * k} : ${k}} = ${fr(n, d)}]]`, `אי אפשר לצמצם יותר.`],
    };
  }
  // level 3
  if (chance(0.5)) {
    const d = pick([4, 5, 6, 8, 9, 12]);
    let n = randInt(1, d - 1);
    while (gcd(n, d) !== 1) n = randInt(1, d - 1);
    const k = pick([4, 6, 8, 9, 12]);
    return {
      prompt: 'צמצמו את השבר עד הסוף:',
      expression: fr(n * k, d * k),
      answer: { kind: 'fraction', num: n, den: d, form: 'simplest' },
      hint: `אפשר לצמצם בכמה שלבים: קודם ב-2, אחר כך שוב...`,
      solution: [`המחלק המשותף הגדול ביותר של ${n * k} ו-${d * k} הוא ${k}.`, `[[${fr(n * k, d * k)} = ${fr(n, d)}]]`],
    };
  }
  const d = pick([3, 4, 5, 6]);
  const n = randInt(1, d - 1);
  const [sn, sd] = simplify(n, d);
  const mults = shuffle([2, 3, 4, 5, 6]).slice(0, 3);
  const equal = mults.map((k) => fr(sn * k, sd * k));
  const odd = fr(sn * mults[0] + 1, sd * mults[0]);
  const options = shuffle([...equal, odd]);
  return {
    prompt: 'איזה שבר **אינו** שווה לשאר?',
    answer: { kind: 'choice', options: options.map((o) => `[[${o}]]`), correct: options.indexOf(odd) },
    hint: 'צמצמו כל אחד מהשברים עד הסוף והשוו.',
    solution: [`שלושה מהשברים מצטמצמים ל-[[${fr(sn, sd)}]].`, `[[${odd}]] אינו שווה ל-[[${fr(sn, sd)}]].`],
  };
}

/* ---------------- א3. השוואת שברים ---------------- */

function compareQ(level: Level): Question {
  if (level === 1) {
    if (chance(0.5)) {
      const d = pick([5, 6, 7, 8, 9, 10, 12]);
      const a = randInt(1, d);
      let b = randInt(1, d);
      if (chance(0.15)) b = a;
      return {
        prompt: 'השלימו את הסימן: [[> , < , =]]',
        expression: `${fr(a, d)} ? ${fr(b, d)}`,
        answer: { kind: 'compare', correct: cmp(a, b) },
        hint: 'למכנים שווים – משווים את המונים.',
        solution: [`המכנים שווים (${d}), לכן משווים את המונים: ${a} ו-${b}.`, `[[${fr(a, d)} ${cmp(a, b)} ${fr(b, d)}]]`],
      };
    }
    const n = randInt(1, 5);
    const d1 = randInt(n + 1, 12);
    let d2 = randInt(n + 1, 12);
    if (d2 === d1) d2 = d1 === 12 ? 11 : d1 + 1;
    return {
      prompt: 'השלימו את הסימן: [[> , < , =]]',
      expression: `${fr(n, d1)} ? ${fr(n, d2)}`,
      answer: { kind: 'compare', correct: cmp(n / d1, n / d2) },
      hint: 'המונים שווים. מה גדול יותר – חלק ממשהו שחולק להרבה חלקים, או למעט חלקים?',
      solution: [`המונים שווים. ככל שהמכנה גדול יותר – כל חלק קטן יותר.`, `[[${fr(n, d1)} ${cmp(n / d1, n / d2)} ${fr(n, d2)}]]`],
    };
  }
  if (level === 2) {
    const d1 = pick([2, 3, 4, 5, 6]);
    const k = pick([2, 3, 4]);
    const d2 = d1 * k;
    const a = randInt(1, d1 - 1 || 1);
    let b = randInt(1, d2 - 1);
    if (chance(0.2)) b = a * k;
    const [x, y] = chance(0.5) ? [[a, d1], [b, d2]] : [[b, d2], [a, d1]];
    const r = cmp(x[0] / x[1], y[0] / y[1]);
    return {
      prompt: 'השלימו את הסימן: [[> , < , =]]',
      expression: `${fr(x[0], x[1])} ? ${fr(y[0], y[1])}`,
      answer: { kind: 'compare', correct: r },
      hint: `הרחיבו את [[${fr(a, d1)}]] למכנה ${d2}.`,
      solution: [`[[${fr(a, d1)} = ${fr(a * k, d2)}]]`, `עכשיו משווים [[${fr(a * k, d2)}]] ו-[[${fr(b, d2)}]].`, `[[${fr(x[0], x[1])} ${r} ${fr(y[0], y[1])}]]`],
    };
  }
  const kind = pick(['general', 'between', 'largest'] as const);
  if (kind === 'general') {
    const d1 = pick([3, 4, 5, 6, 7, 8]);
    let d2 = pick([3, 4, 5, 6, 7, 8, 9, 10]);
    if (d2 === d1) d2++;
    const a = randInt(1, d1 + 2);
    const b = randInt(1, d2 + 2);
    const L = lcm(d1, d2);
    const r = cmp(a / d1, b / d2);
    return {
      prompt: 'השלימו את הסימן: [[> , < , =]]',
      expression: `${fr(a, d1)} ? ${fr(b, d2)}`,
      answer: { kind: 'compare', correct: r },
      hint: `מצאו מכנה משותף ל-${d1} ול-${d2} (למשל ${L}).`,
      solution: [`מכנה משותף: ${L}.`, `[[${fr(a, d1)} = ${fr(a * (L / d1), L)}]] , [[${fr(b, d2)} = ${fr(b * (L / d2), L)}]]`, `[[${fr(a, d1)} ${r} ${fr(b, d2)}]]`],
    };
  }
  if (kind === 'between') {
    const d = pick([3, 4, 5, 6]);
    const a = randInt(1, d - 2);
    // between a/d and (a+1)/d: expand by 2 -> (2a+1)/(2d)
    const good = fr(2 * a + 1, 2 * d);
    const bad = [fr(2 * a - 1 > 0 ? 2 * a - 1 : 1, 2 * d), fr(2 * a + 3, 2 * d), fr(a + 2, d)];
    return {
      prompt: `איזה שבר נמצא בין [[${fr(a, d)}]] ל-[[${fr(a + 1, d)}]]?`,
      answer: choice(`[[${good}]]`, bad.map((b) => `[[${b}]]`)),
      hint: `הרחיבו את שני השברים פי 2: למכנה ${2 * d}.`,
      solution: [`[[${fr(a, d)} = ${fr(2 * a, 2 * d)}]] ו-[[${fr(a + 1, d)} = ${fr(2 * a + 2, 2 * d)}]].`, `ביניהם נמצא [[${good}]].`],
    };
  }
  const fracs: [number, number][] = [];
  while (fracs.length < 4) {
    const d = randInt(2, 10);
    const n = randInt(1, d - 1);
    if (!fracs.some(([x, y]) => Math.abs(x / y - n / d) < 0.02)) fracs.push([n, d]);
  }
  const best = fracs.reduce((m, f) => (f[0] / f[1] > m[0] / m[1] ? f : m));
  const opts = fracs.map(([n, d]) => `[[${fr(n, d)}]]`);
  return {
    prompt: 'איזה שבר הוא הגדול ביותר?',
    answer: { kind: 'choice', options: opts, correct: fracs.indexOf(best) },
    hint: 'השוו כל שבר לחצי: האם המונה גדול מחצי המכנה? ואז השוו בין הגדולים מחצי.',
    solution: [`[[${fr(best[0], best[1])}]] הוא הגדול ביותר.`, `אפשר לבדוק בעזרת מכנה משותף, או לבדוק מי הכי קרוב ל-1.`],
  };
}

/* ---------------- א3. חיבור וחיסור שברים ---------------- */

function addsubQ(level: Level): Question {
  const plus = chance(0.55);
  let d1: number, d2: number;
  let w1 = 0;
  let w2 = 0;
  if (level === 1) {
    d1 = d2 = pick([3, 4, 5, 6, 7, 8, 9, 10]);
  } else if (level === 2) {
    d1 = pick([2, 3, 4, 5]);
    d2 = d1 * pick([2, 3]);
    if (chance(0.5)) [d1, d2] = [d2, d1];
  } else {
    const pairs = [[2, 3], [3, 4], [2, 5], [4, 6], [3, 5], [4, 5], [6, 8], [3, 8], [2, 7]];
    [d1, d2] = pick(pairs);
    if (chance(0.5)) [d1, d2] = [d2, d1];
    if (chance(0.5)) {
      w1 = randInt(1, 4);
      w2 = randInt(0, w1 - (plus ? 0 : 1));
    }
  }
  let n1 = randInt(1, d1 - 1);
  let n2 = randInt(1, d2 - 1);
  const L = lcm(d1, d2);
  let A = (w1 * d1 + n1) * (L / d1);
  let B = (w2 * d2 + n2) * (L / d2);
  if (!plus && A < B) {
    [w1, w2] = [w2, w1];
    [d1, d2] = [d2, d1];
    [n1, n2] = [n2, n1];
    [A, B] = [B, A];
  }
  if (!plus && A === B) return addsubQ(level);
  const R = plus ? A + B : A - B;
  const op = plus ? '+' : '-';
  const a = w1 ? `{${w1} ${n1}/${d1}}` : fr(n1, d1);
  const b = w2 ? `{${w2} ${n2}/${d2}}` : fr(n2, d2);
  const [sn, sd] = simplify(R, L);
  const steps: string[] = [];
  if (d1 !== d2) steps.push(`מכנה משותף: ${L}.`);
  if (w1 || w2) steps.push(`נכתוב כשברים: [[${fr(A, L)} ${op} ${fr(B, L)}]]`);
  else if (d1 !== d2) steps.push(`[[${fr(n1, d1)} = ${fr(A, L)}]] , [[${fr(n2, d2)} = ${fr(B, L)}]]`);
  steps.push(`[[${fr(A, L)} ${op} ${fr(B, L)} = ${fr(R, L)}]]`);
  if (sd !== L || sn >= sd) steps.push(`ואפשר לכתוב: [[${fr(R, L)} = ${sn % sd === 0 ? sn / sd : fr(sn, sd, true)}]]`);
  return {
    prompt: 'פתרו (אפשר לענות כשבר או כמספר מעורב):',
    expression: `${a} ${op} ${b} = ?`,
    answer: { kind: 'fraction', num: R, den: L, allowWhole: true },
    hint: d1 === d2 ? 'כשהמכנים שווים – מחברים או מחסרים רק את המונים.' : `הביאו את השברים למכנה משותף – למשל ${L}.`,
    solution: steps,
  };
}

/* ---------------- א4. שאלות מילוליות בשברים ---------------- */

function wordQ(level: Level): Question {
  const { name, v } = person();
  if (level === 1) {
    if (chance(0.5)) {
      const d = pick([3, 4, 5, 6, 10]);
      let n = randInt(1, d - 1);
      while (gcd(n, d) !== 1) n = randInt(1, d - 1); // reduced fractions read naturally in a story
      const total = d * randInt(3, 8);
      return {
        prompt: `בכיתה ${total} תלמידים. ${frBoth(n, d)} מהם הגיעו באופניים. כמה תלמידים הגיעו באופניים?`,
        wordProblem: true,
        answer: { kind: 'number', value: (total / d) * n },
        hint: `מצאו קודם כמה זה [[${fr(1, d)}]] מהכיתה.`,
        solution: [`[[${total} : ${d} = ${total / d}]] – זה [[${fr(1, d)}]].`, `[[${n} × ${total / d} = ${(total / d) * n}]]`],
      };
    }
    const d = pick([5, 6, 8, 10, 12]);
    const a = randInt(1, d - 2);
    const b = randInt(1, d - a - 1);
    return {
      prompt: `${name} ${v('אכל', 'אכלה')} ${frBoth(a, d)} מהעוגה בבוקר ו${frBoth(b, d)} מהעוגה בערב. איזה חלק מהעוגה נאכל?`,
      wordProblem: true,
      answer: { kind: 'fraction', num: a + b, den: d },
      hint: 'מחברים את שני החלקים. המכנים שווים.',
      solution: [`[[${fr(a, d)} + ${fr(b, d)} = ${fr(a + b, d)}]]`],
    };
  }
  if (level === 2) {
    const pairs = [[8, 4], [5, 10], [3, 6], [4, 12], [6, 3], [8, 2], [10, 5], [3, 4], [5, 2]];
    const [d1, d2] = pick(pairs);
    const L = lcm(d1, d2);
    let n1 = randInt(1, d1 - 1);
    let n2 = randInt(1, d2 - 1);
    while (n1 * (L / d1) + n2 * (L / d2) >= L) {
      n1 = randInt(1, d1 - 1);
      n2 = randInt(1, d2 - 1);
    }
    const spent = n1 * (L / d1) + n2 * (L / d2);
    const askLeft = chance(0.5);
    const val = askLeft ? L - spent : spent;
    return {
      wordProblem: true,
      prompt: `${name} ${v('הוציא', 'הוציאה')} ${frBoth(n1, d1)} ${v('מכספו', 'מכספה')} על ספרים ו${frBoth(n2, d2)} ${v('מכספו', 'מכספה')} על מחברות. ${askLeft ? 'איזה חלק מהכסף נשאר?' : `איזה חלק מהכסף ${v('הוציא', 'הוציאה')} בסך הכול?`}`,
      answer: { kind: 'fraction', num: val, den: L },
      hint: askLeft ? `קודם חשבו כמה ${v('הוציא', 'הוציאה')} בסך הכול, ואז החסירו מהשלם (1 = [[${fr(L, L)}]]).` : `מחברים את שני השברים בעזרת מכנה משותף: ${L}.`,
      solution: [
        `[[${fr(n1, d1)} + ${fr(n2, d2)} = ${fr(n1 * (L / d1), L)} + ${fr(n2 * (L / d2), L)} = ${fr(spent, L)}]]`,
        ...(askLeft ? [`נשאר: [[1 - ${fr(spent, L)} = ${fr(L, L)} - ${fr(spent, L)} = ${fr(L - spent, L)}]]`] : []),
      ],
    };
  }
  // level 3 – mixed numbers, two steps
  if (chance(0.5)) {
    const d = pick([2, 4, 8]);
    const total = randInt(4, 7) * d + randInt(1, d - 1);
    const cut1 = randInt(1, 2) * d + randInt(1, d - 1);
    const cut2 = randInt(0, 1) * d + randInt(1, d - 1);
    if (cut1 + cut2 >= total) return wordQ(level);
    const left = total - cut1 - cut2;
    return {
      prompt: `לחבל באורך ${frBoth(total, d, true)} מטר. חתכו ממנו חתיכה של ${frBoth(cut1, d, true)} מטר ועוד חתיכה של ${frBoth(cut2, d, true)} מטר. כמה מטרים נשארו?`,
      wordProblem: true,
      answer: { kind: 'fraction', num: left, den: d, allowWhole: true },
      hint: 'חברו קודם את שתי החתיכות, ואז החסירו מאורך החבל.',
      solution: [`נחתך: [[${fr(cut1, d, true)} + ${fr(cut2, d, true)} = ${fr(cut1 + cut2, d, true)}]]`, `נשאר: [[${fr(total, d, true)} - ${fr(cut1 + cut2, d, true)} = ${fr(left, d, true)}]] מטר.`],
    };
  }
  const d = pick([3, 4, 5, 6]);
  const n = randInt(1, d - 1);
  const part = randInt(2, 9);
  const total = part * d;
  return {
    wordProblem: true,
    prompt: `${name} ${v('קרא', 'קראה')} ${frBoth(n, d)} מהספר. ${v('נשארו לו', 'נשארו לה')} ${(d - n) * part} עמודים לקרוא. כמה עמודים יש בספר?`,
    answer: { kind: 'number', value: total },
    hint: `אם ${v('קרא', 'קראה')} [[${fr(n, d)}]], איזה חלק נשאר? כמה עמודים יש בכל [[${fr(1, d)}]]?`,
    solution: [`נשאר [[${fr(d - n, d)}]] מהספר = ${(d - n) * part} עמודים.`, `[[${fr(1, d)}]] מהספר = [[${(d - n) * part} : ${d - n} = ${part}]] עמודים.`, `כל הספר: [[${part} × ${d} = ${total}]] עמודים.`],
  };
}

export const fractionTopics: Topic[] = [
  {
    id: 'fraction-meaning',
    unit: UNIT,
    title: 'מהו שבר? מספרים מעורבים',
    emoji: '🍕',
    lesson: [
      { kind: 'text', text: 'שבר מתאר **חלק משלם**. המכנה (למטה) אומר לכמה חלקים **שווים** חילקנו, והמונה (למעלה) אומר כמה חלקים לקחנו.' },
      { kind: 'visual', visual: { type: 'fractionBar', parts: 4, shaded: 3 }, caption: 'שלושה רבעים: [[{3/4}]]' },
      { kind: 'text', text: 'שבר יכול להיות **גדול מ-1**. למשל [[{7/4}]] זה 7 רבעים – שלם אחד (4 רבעים) ועוד 3 רבעים. כותבים אותו כ**מספר מעורב**: [[{1 3/4}]].' },
      { kind: 'visual', visual: { type: 'numberLine', min: 0, max: 2, ticksPerUnit: 4, markAt: 7 / 4, labels: true }, caption: '[[{7/4} = {1 3/4}]] על ישר המספרים' },
      { kind: 'tip', text: 'שבר הוא גם **חילוק**: 3 פיצות ל-4 ילדים → כל ילד מקבל [[3 : 4 = {3/4}]] פיצה.' },
      { kind: 'example', text: 'כמה זה [[{2/5}]] מ-30? קודם [[30 : 5 = 6]] (חמישית), ואז [[2 × 6 = 12]].' },
    ],
    generate: meaningQ,
  },
  {
    id: 'fraction-equivalent',
    unit: UNIT,
    title: 'הרחבה וצמצום',
    emoji: '🔍',
    lesson: [
      { kind: 'text', text: 'לאותו שבר יש הרבה שמות! [[{1/2} = {2/4} = {4/8}]] – כולם אותו חלק.' },
      { kind: 'visual', visual: { type: 'fractionBar', parts: 2, shaded: 1 }, caption: '[[{1/2}]]' },
      { kind: 'visual', visual: { type: 'fractionBar', parts: 8, shaded: 4 }, caption: '[[{4/8}]] – אותו גודל' },
      { kind: 'text', text: '**הרחבה**: כופלים את המונה **ואת** המכנה באותו מספר (לא 0).' },
      { kind: 'example', text: 'הרחבה פי 3:', expression: '{2/7} = {2 × 3/7 × 3} = {6/21}' },
      { kind: 'text', text: '**צמצום**: מחלקים את המונה **ואת** המכנה באותו מספר.' },
      { kind: 'example', text: 'צמצום ב-4:', expression: '{8/12} = {8 : 4/12 : 4} = {2/3}' },
      { kind: 'tip', text: '"צמצום עד הסוף" – ממשיכים עד שאין מספר (חוץ מ-1) שמחלק גם את המונה וגם את המכנה.' },
    ],
    generate: equivalentQ,
  },
  {
    id: 'fraction-compare',
    unit: UNIT,
    title: 'השוואת שברים',
    emoji: '⚖️',
    lesson: [
      { kind: 'text', text: '**מכנים שווים** – הגדול הוא זה עם המונה הגדול: [[{5/8} > {3/8}]].' },
      { kind: 'text', text: '**מונים שווים** – הגדול הוא זה עם המכנה **הקטן** (חלקים גדולים יותר): [[{2/5} > {2/7}]].' },
      { kind: 'text', text: '**שונים** – מביאים ל**מכנה משותף** בעזרת הרחבה, ואז משווים.' },
      { kind: 'example', text: 'מה גדול יותר, [[{2/3}]] או [[{3/4}]]? מכנה משותף 12:', expression: '{2/3} = {8/12}   ,   {3/4} = {9/12}   →   {3/4} > {2/3}' },
      { kind: 'tip', text: 'טריקים: השוו לחצי או ל-1. [[{3/5}]] גדול מחצי ו-[[{1/3}]] קטן מחצי, לכן [[{3/5} > {1/3}]].' },
    ],
    generate: compareQ,
  },
  {
    id: 'fraction-addsub',
    unit: UNIT,
    title: 'חיבור וחיסור שברים',
    emoji: '➕',
    lesson: [
      { kind: 'text', text: 'כשהמכנים **שווים** – מחברים (או מחסרים) רק את המונים. המכנה נשאר.' },
      { kind: 'example', text: '', expression: '{2/7} + {3/7} = {5/7}' },
      { kind: 'text', text: 'כשהמכנים **שונים** – קודם מביאים למכנה משותף.' },
      { kind: 'example', text: '', expression: '{1/2} + {1/3} = {3/6} + {2/6} = {5/6}' },
      { kind: 'text', text: '**מספרים מעורבים**: אפשר לחבר שלמים עם שלמים ושברים עם שברים, או להפוך הכול לשבר.' },
      { kind: 'example', text: '', expression: '{2 1/4} + {1 1/2} = {2 1/4} + {1 2/4} = {3 3/4}' },
      { kind: 'tip', text: 'בסוף – בדקו אם אפשר לצמצם את התשובה.' },
    ],
    generate: addsubQ,
  },
  {
    id: 'fraction-word',
    unit: UNIT,
    title: 'בעיות מילוליות בשברים',
    emoji: '📖',
    lesson: [
      { kind: 'text', text: 'בבעיה מילולית: קראו לאט, סמנו מה **ידוע** ומה **שואלים**.' },
      { kind: 'text', text: '"איזה חלק נשאר?" – השלם הוא 1. מחסרים מ-1 את מה שהשתמשו בו.' },
      { kind: 'example', text: 'רנה הוציאה [[{3/8}]] מכספה על ספרים ו-[[{1/4}]] על מחברות. כמה נשאר?', expression: '{3/8} + {2/8} = {5/8}   →   1 - {5/8} = {3/8}' },
      { kind: 'tip', text: '"[[{2/5}]] מ-30" – מחלקים ל-5 וכופלים ב-2.' },
    ],
    generate: wordQ,
  },
];
