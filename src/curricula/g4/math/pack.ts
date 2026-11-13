import type { PackContent } from '../../types';
import { fractionTopics, numberTopics, operationTopics } from './numbers';
import { measureTopics, shapeTopics } from './shapes';

/** Grade 4 math, following the Ministry of Education 2006 program, grade 4 chapter (see docs/curriculum-g4-math.md). */
const pack: PackContent = {
  units: [
    { id: 'fractions', title: 'השבר הפשוט', color: 'var(--unit-fractions)' },
    { id: 'numbers', title: 'מספרים עד מיליון', color: 'var(--unit-decimals)' },
    { id: 'operations', title: 'פעולות החשבון', color: 'var(--unit-naturals)' },
    { id: 'geometry', title: 'צורות, גופים וסימטרייה', color: 'var(--unit-geometry)' },
    { id: 'measure', title: 'מדידות ונתונים', color: 'var(--unit-data)' },
  ],
  topics: [...fractionTopics, ...numberTopics, ...operationTopics, ...shapeTopics, ...measureTopics],
};

export default pack;
