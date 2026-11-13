import type { PackContent } from '../../types';
import { wordsTopics } from './words';
import { formsTopics, sentenceTopics } from './grammar';

/**
 * Grade 4 Hebrew language (שפה ולשון), following the language-education curriculum's milestones for the end of
 * grade 4 and the grade 4 assessment specification – see docs/curriculum-g4-hebrew.md.
 */
const pack: PackContent = {
  units: [
    { id: 'words', title: 'מילים, משמעות וקריאה', color: 'var(--unit-data)' },
    { id: 'forms', title: 'צורות המילים', color: 'var(--unit-fractions)' },
    { id: 'sentence', title: 'המשפט, הקישור והפיסוק', color: 'var(--unit-naturals)' },
  ],
  topics: [...wordsTopics, ...formsTopics, ...sentenceTopics],
};

export default pack;
