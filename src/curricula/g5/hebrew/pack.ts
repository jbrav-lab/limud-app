import type { PackContent } from '../../types';
import { formsTopics } from './forms';
import { syntaxTopics } from './syntax';
import { meaningTopics } from './meaning';

/**
 * Grade 5 Hebrew language (שפה ולשון), following the Ministry's language-education curriculum
 * (חינוך לשוני, תשס"ג) and its required achievements for grades 5–6 – see docs/curriculum-g5-hebrew.md.
 */
const pack: PackContent = {
  units: [
    { id: 'forms', title: 'מילים וצורות', color: 'var(--unit-fractions)' },
    { id: 'syntax', title: 'משפט, קישור ופיסוק', color: 'var(--unit-naturals)' },
    { id: 'meaning', title: 'משמעות והבנת הנקרא', color: 'var(--unit-data)' },
  ],
  topics: [...formsTopics, ...syntaxTopics, ...meaningTopics],
};

export default pack;
