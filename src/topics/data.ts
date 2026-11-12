import type { Level, Question, Topic } from '../engine/types';
import { choice, fmt, pick, randInt, shuffle, sum, chance, person } from '../engine/math';

const UNIT = 'data';

/** n integers in [lo,hi] whose sum is divisible by n (integer average). */
function intAvgSet(n: number, lo: number, hi: number): number[] {
  for (;;) {
    const xs = Array.from({ length: n }, () => randInt(lo, hi));
    if (sum(xs) % n === 0) return xs;
  }
}

function averageQ(level: Level): Question {
  if (level === 1) {
    const n = randInt(3, 5);
    const xs = intAvgSet(n, 1, 20);
    const s = sum(xs);
    return {
      prompt: 'מה הממוצע של המספרים?',
      expression: xs.join(' , '),
      answer: { kind: 'number', value: s / n },
      hint: 'מחברים את כל המספרים ומחלקים בכמות המספרים.',
      solution: [`סכום: [[${xs.join(' + ')} = ${s}]]`, `יש ${n} מספרים: [[${s} : ${n} = ${s / n}]]`],
    };
  }
  if (level === 2) {
    if (chance(0.55)) {
      const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳'];
      const n = randInt(4, 5);
      const vals = intAvgSet(n, 2, 12);
      return {
        prompt: 'בדיאגרמה – מספר הספרים שהשאילו בספרייה בכל יום. מה הממוצע ליום?',
        visual: { type: 'barChart', labels: days.slice(0, n), values: vals, title: 'ספרים שהושאלו', showValues: true },
        answer: { kind: 'number', value: sum(vals) / n },
        hint: 'קראו את גובה כל עמודה, חברו, וחלקו במספר הימים.',
        solution: [`[[${vals.join(' + ')} = ${sum(vals)}]]`, `[[${sum(vals)} : ${n} = ${sum(vals) / n}]]`],
      };
    }
    const n = randInt(3, 8), avg = randInt(4, 25);
    return {
      prompt: `הממוצע של ${n} מספרים הוא ${avg}. מה הסכום שלהם?`,
      answer: { kind: 'number', value: n * avg },
      hint: 'ממוצע = סכום : כמות. אז סכום = ?',
      solution: [`סכום = ממוצע × כמות: [[${avg} × ${n} = ${n * avg}]]`],
    };
  }
  const kind = pick(['missing', 'property', 'effect', 'decimal'] as const);
  if (kind === 'missing') {
    const n = randInt(4, 6), avg = randInt(5, 20);
    const known = Array.from({ length: n - 1 }, () => randInt(Math.max(1, avg - 8), avg + 8));
    const last = n * avg - sum(known);
    if (last < 1) return averageQ(level);
    return {
      prompt: `הממוצע של ${n} מספרים הוא ${avg}. ${n - 1} מהם הם: [[${known.join(' , ')}]]. מה המספר החסר?`,
      answer: { kind: 'number', value: last },
      hint: 'חשבו מה צריך להיות הסכום של כל המספרים.',
      solution: [`סכום כולם: [[${avg} × ${n} = ${n * avg}]]`, `סכום הידועים: [[${sum(known)}]]`, `החסר: [[${n * avg} - ${sum(known)} = ${last}]]`],
    };
  }
  if (kind === 'property') {
    const xs = intAvgSet(4, 3, 30).sort((a, b) => a - b);
    const avg = sum(xs) / 4;
    const lies = [`${xs[3] + randInt(2, 10)}`, `${Math.max(0, xs[0] - randInt(1, 3))}`];
    const { name, v } = person();
    return {
      prompt: `${name} ${v('חישב', 'חישבה')} את הממוצע של [[${xs.join(' , ')}]]. איזו תוצאה יכולה להיות נכונה?`,
      answer: choice(fmt(avg), [...lies, `${sum(xs)}`]),
      hint: 'הממוצע תמיד בין המספר הקטן ביותר לגדול ביותר.',
      solution: [`הממוצע חייב להיות בין ${xs[0]} ל-${xs[3]}.`, `[[${xs.join(' + ')} = ${sum(xs)}]] , [[${sum(xs)} : 4 = ${fmt(avg)}]]`],
    };
  }
  if (kind === 'effect') {
    const avg = randInt(10, 40);
    const add = pick([avg + randInt(5, 30), Math.max(0, avg - randInt(5, 9)), avg]);
    const correct = add > avg ? 'הממוצע יגדל' : add < avg ? 'הממוצע יקטן' : 'הממוצע לא ישתנה';
    return {
      prompt: `הממוצע של קבוצת מספרים הוא ${avg}. מוסיפים לקבוצה את המספר ${add}. מה יקרה לממוצע?`,
      answer: { kind: 'choice', options: ['הממוצע יגדל', 'הממוצע יקטן', 'הממוצע לא ישתנה'], correct: ['הממוצע יגדל', 'הממוצע יקטן', 'הממוצע לא ישתנה'].indexOf(correct) },
      hint: 'האם המספר החדש גדול מהממוצע, קטן ממנו או שווה לו?',
      solution: [add === avg ? `המספר החדש שווה לממוצע – הממוצע לא משתנה.` : `המספר החדש ${add > avg ? 'גדול' : 'קטן'} מהממוצע, לכן ${correct.replace('הממוצע ', 'הממוצע ')}.`],
    };
  }
  // non-integer average
  const n = pick([2, 4]);
  let xs = Array.from({ length: n }, () => randInt(1, 20));
  if (sum(xs) % n === 0) xs = [...xs.slice(0, -1), xs[n - 1] + 1];
  xs = shuffle(xs);
  return {
    prompt: 'מה הממוצע? (התשובה יכולה להיות מספר עשרוני)',
    expression: xs.join(' , '),
    answer: { kind: 'number', value: sum(xs) / n },
    hint: 'הממוצע לא חייב להיות מספר שלם.',
    solution: [`[[${xs.join(' + ')} = ${sum(xs)}]]`, `[[${sum(xs)} : ${n} = ${fmt(sum(xs) / n)}]]`],
  };
}

export const dataTopics: Topic[] = [
  {
    id: 'average',
    unit: UNIT,
    title: 'ממוצע ודיאגרמות',
    emoji: '📊',
    lesson: [
      { kind: 'text', text: '**ממוצע** – "עושים שיהיה שווה". אם נחלק את הכול שווה בשווה – כמה יקבל כל אחד?' },
      { kind: 'example', text: 'הממוצע של 10, 7, 7, 5, 3, 3:', expression: '(10 + 7 + 7 + 5 + 3 + 3) : 6 = 35 : 6 = {5 5/6}' },
      { kind: 'visual', visual: { type: 'barChart', labels: ['א׳', 'ב׳', 'ג׳', 'ד׳'], values: [2, 6, 4, 8], title: 'הממוצע הוא 5', showValues: true }, caption: '[[(2 + 6 + 4 + 8) : 4 = 5]]' },
      { kind: 'text', text: '**תכונות הממוצע:**' },
      { kind: 'text', text: '• הממוצע תמיד **בין** המספר הקטן ביותר לגדול ביותר.\n• הוא לא חייב להיות אחד המספרים, ולא חייב להיות שלם.\n• מוסיפים מספר גדול מהממוצע ← הממוצע גדל. קטן מהממוצע ← קטן.' },
      { kind: 'tip', text: 'סכום = ממוצע × כמות. שימושי כשחסר מספר!' },
    ],
    generate: averageQ,
  },
];
