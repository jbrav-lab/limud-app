import type { Level, Question, Topic } from './types';
import { shuffle } from './math';

/** "הכנה למבחן": a simulated test built from chosen topics, graded out of 100. */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

export const DIFFICULTIES: { id: Difficulty; label: string; hint: string; defaultCount: number }[] = [
  { id: 'easy', label: 'קל', hint: 'שאלות ברמה 1', defaultCount: 20 },
  { id: 'medium', label: 'בינוני', hint: 'שאלות ברמה 2', defaultCount: 15 },
  { id: 'hard', label: 'קשה', hint: 'שאלות ברמה 3', defaultCount: 10 },
  { id: 'adaptive', label: 'מותאם אליי', hint: 'כל נושא ברמה שלי', defaultCount: 15 },
];

export const MIN_QUESTIONS = 5;
export const MAX_QUESTIONS = 25;

export interface ExamQuestion {
  topicId: string;
  level: Level;
  q: Question;
  points: number;
}

/** Split 100 points by weight (the question's level), as whole numbers that add up to exactly 100. */
export function allocatePoints(weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  const raw = weights.map((w) => (100 * w) / total);
  const pts = raw.map(Math.floor);
  let left = 100 - pts.reduce((s, p) => s + p, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) pts[order[k][1]]++;
  return pts;
}

/**
 * Build a test: topics take turns (in a shuffled order) so they are spread evenly,
 * no two questions repeat, and harder questions are worth more points.
 */
export function buildExam(topics: Topic[], difficulty: Difficulty, count: number, levelFor: (topicId: string) => Level): ExamQuestion[] {
  const n = Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, Math.round(count)));
  const fixed: Record<Difficulty, Level | null> = { easy: 1, medium: 2, hard: 3, adaptive: null };
  const seen = new Set<string>();
  const out: Omit<ExamQuestion, 'points'>[] = [];
  let order = shuffle(topics);
  for (let i = 0; out.length < n && i < n * 4; i++) {
    if (i > 0 && i % order.length === 0) order = shuffle(topics);
    const topic = order[i % order.length];
    const level = fixed[difficulty] ?? levelFor(topic.id);
    // A topic keeps its turn until it produces a question not already in the test.
    for (let tries = 0; tries < 30; tries++) {
      const q = topic.generate(level);
      const key = q.prompt + '|' + (q.expression ?? '') + '|' + JSON.stringify(q.visual ?? '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ topicId: topic.id, level, q });
      break;
    }
  }
  const points = allocatePoints(out.map((x) => x.level));
  return shuffle(out.map((x, i) => ({ ...x, points: points[i] })));
}

/** The Israeli school verbal grade for a score out of 100. */
export function verbalGrade(score: number): { label: string; emoji: string; cheer: string } {
  if (score >= 95) return { label: 'מצוין', emoji: '🏆', cheer: 'מושלם כמעט! אתם מוכנים למבחן.' };
  if (score >= 85) return { label: 'טוב מאוד', emoji: '🌟', cheer: 'עבודה מעולה! עוד קצת חזרה וזה מושלם.' };
  if (score >= 75) return { label: 'טוב', emoji: '👍', cheer: 'יפה! כדאי לחזור על השאלות שטעיתם בהן.' };
  if (score >= 65) return { label: 'כמעט טוב', emoji: '💪', cheer: 'בדרך הנכונה. תרגלו את הנושאים החלשים ונסו שוב.' };
  if (score >= 55) return { label: 'מספיק', emoji: '📚', cheer: 'עברתם! עכשיו כדאי לתרגל עוד לפני המבחן.' };
  return { label: 'לא מספיק', emoji: '🌱', cheer: 'זה בדיוק בשביל זה מתאמנים. נתרגל ונצליח!' };
}
