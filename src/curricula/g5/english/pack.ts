import type { PackContent } from '../../types';
import { vocabularyTopics } from './vocabulary';
import { grammarTopics } from './grammar';
import { literacyTopics } from './literacy';

/**
 * Grade 5 English, following the English Curriculum 2020 for Elementary School
 * (Foundation level, Band I, grade 5 grammar) – see docs/curriculum-g5-english.md.
 * Questions and examples are in English; lessons and explanations are in Hebrew.
 */
const pack: PackContent = {
  units: [
    { id: 'vocab', title: 'Vocabulary · אוצר מילים', color: 'var(--unit-fractions)' },
    { id: 'grammar', title: 'Grammar · דקדוק', color: 'var(--unit-naturals)' },
    { id: 'literacy', title: 'Reading & Writing · קריאה וכתיבה', color: 'var(--unit-decimals)' },
  ],
  topics: [...vocabularyTopics, ...grammarTopics, ...literacyTopics],
};

export default pack;
