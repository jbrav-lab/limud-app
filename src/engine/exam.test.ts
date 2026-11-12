import { describe, expect, it } from 'vitest';
import { allocatePoints, buildExam, verbalGrade } from './exam';
import { TOPICS } from '../topics';

describe('exam', () => {
  it('splits exactly 100 points, more for harder questions', () => {
    for (const w of [[1, 1, 1], [1, 2, 3], Array(7).fill(2), Array(25).fill(1), [3, 3, 1, 1, 2]]) {
      const p = allocatePoints(w);
      expect(p.reduce((s, x) => s + x, 0)).toBe(100);
      w.forEach((wi, i) => w.forEach((wj, j) => { if (wi > wj) expect(p[i]).toBeGreaterThanOrEqual(p[j]); }));
    }
  });

  it('builds the requested number of distinct questions, spread over the chosen topics', () => {
    const topics = TOPICS.filter((t) => t.unit === 'fractions');
    for (const n of [5, 13, 25]) {
      const exam = buildExam(topics, 'medium', n, () => 1);
      expect(exam).toHaveLength(n);
      expect(exam.every((e) => e.level === 2)).toBe(true);
      expect(exam.reduce((s, e) => s + e.points, 0)).toBe(100);
      const per = topics.map((t) => exam.filter((e) => e.topicId === t.id).length);
      expect(Math.max(...per) - Math.min(...per)).toBeLessThanOrEqual(1);
    }
  });

  it('clamps the length to 5–25 and follows the child level when adaptive', () => {
    expect(buildExam(TOPICS, 'easy', 2, () => 1)).toHaveLength(5);
    expect(buildExam(TOPICS, 'easy', 99, () => 1)).toHaveLength(25);
    const exam = buildExam(TOPICS.slice(0, 2), 'adaptive', 6, (id) => (id === TOPICS[0].id ? 3 : 1));
    for (const e of exam) expect(e.level).toBe(e.topicId === TOPICS[0].id ? 3 : 1);
  });

  it('uses the Israeli verbal grades', () => {
    expect(verbalGrade(100).label).toBe('מצוין');
    expect(verbalGrade(85).label).toBe('טוב מאוד');
    expect(verbalGrade(74).label).toBe('כמעט טוב');
    expect(verbalGrade(40).label).toBe('לא מספיק');
  });
});
