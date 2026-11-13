import type { PackContent } from '../../types';
import { matterTopics } from './matter';
import { ecologyTopics, lifeTopics } from './life';
import { technologyTopics } from './technology';

/** Grade 4 science & technology, following the Ministry's תשפ"ז content specification (see docs/curriculum-g4-science.md). */
const pack: PackContent = {
  units: [
    { id: 'matter', title: 'חומרים, מים ואוויר', color: 'var(--unit-decimals)' },
    { id: 'life', title: 'יצורים חיים וגוף האדם', color: 'var(--unit-naturals)' },
    { id: 'ecology', title: 'המגוון בטבע', color: 'var(--unit-data)' },
    { id: 'technology', title: 'טכנולוגיה וחקר מדעי', color: 'var(--unit-geometry)' },
  ],
  topics: [...matterTopics, ...lifeTopics, ...ecologyTopics, ...technologyTopics],
};

export default pack;
