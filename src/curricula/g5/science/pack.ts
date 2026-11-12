import type { PackContent } from '../../types';
import { materialTopics } from './materials';
import { bodyTopics } from './body';
import { earthTopics } from './earth';
import { spaceTopics } from './space';
import { technologyTopics } from './technology';

/** Grade 5 science & technology, following the Ministry's תשפ"ז content specification (see docs/curriculum-g5-science.md). */
const pack: PackContent = {
  units: [
    // unit colors reuse the design system's five unit tokens
    { id: 'materials', title: 'חומרים', color: 'var(--unit-fractions)' },
    { id: 'body', title: 'גוף האדם: הזנה ונשימה', color: 'var(--unit-naturals)' },
    { id: 'earth', title: 'סלעים, קרקעות וסביבה', color: 'var(--unit-decimals)' },
    { id: 'space', title: 'אסטרונומיה וחקר החלל', color: 'var(--unit-data)' },
    { id: 'technology', title: 'טכנולוגיה וחקר מדעי', color: 'var(--unit-geometry)' },
  ],
  topics: [...materialTopics, ...bodyTopics, ...earthTopics, ...spaceTopics, ...technologyTopics],
};

export default pack;
