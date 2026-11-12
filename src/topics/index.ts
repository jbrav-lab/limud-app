import type { Topic, Unit } from '../engine/types';
import { fractionTopics } from './fractions';
import { decimalTopics } from './decimals';
import { naturalTopics } from './naturals';
import { dataTopics } from './data';
import { geometryTopics } from './geometry';

/** Grade 5 math, following the Ministry of Education curriculum (see docs/curriculum-grade5.md). */
export const UNITS: Unit[] = [
  // colors come from the design system tokens (design/tokens.json)
  { id: 'fractions', title: 'שברים פשוטים', color: 'var(--unit-fractions)' },
  { id: 'decimals', title: 'שברים עשרוניים', color: 'var(--unit-decimals)' },
  { id: 'naturals', title: 'פעולות במספרים טבעיים', color: 'var(--unit-naturals)' },
  { id: 'data', title: 'חקר נתונים וממוצע', color: 'var(--unit-data)' },
  { id: 'geometry', title: 'גאומטריה ושטחים', color: 'var(--unit-geometry)' },
];

export const TOPICS: Topic[] = [...fractionTopics, ...decimalTopics, ...naturalTopics, ...dataTopics, ...geometryTopics];

export const topicById = (id: string) => TOPICS.find((t) => t.id === id);
export const unitById = (id: string) => UNITS.find((u) => u.id === id)!;
