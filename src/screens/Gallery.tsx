import { Visual } from '../components/Visual';
import type { Visual as V } from '../engine/types';

/** Dev-only page (open the dev server with ?gallery) showing every visual type. */
const SAMPLES: V[] = [
  { type: 'fractionBar', parts: 8, shaded: 3 },
  { type: 'numberLine', min: 0, max: 3, ticksPerUnit: 4, markAt: 2.25, labels: true },
  { type: 'decimalGrid', shaded: 47 },
  { type: 'angle', degrees: 35, showArc: true },
  { type: 'angle', degrees: 180, showArc: true },
  { type: 'barChart', labels: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳'], values: [3, 8, 5, 10, 4], title: 'ספרים שהושאלו', showValues: true },
  { type: 'quad', kind: 'square' },
  { type: 'quad', kind: 'rhombus' },
  { type: 'quad', kind: 'trapezoid' },
  { type: 'quad', kind: 'kite' },
  { type: 'triangleHeight', apexX: 0.3, isHeight: true },
  { type: 'triangleHeight', apexX: 0.6, isHeight: false },
  { type: 'rect', w: 12, h: 3, unit: 'ס"מ' },
  { type: 'parallelogram', base: 10, height: 5, side: 7, unit: 'ס"מ' },
  { type: 'triangleArea', base: 8, height: 6, unit: 'ס"מ' },
  { type: 'triangleArea', base: 6, height: 7, unit: 'ס"מ', obtuse: true },
  { type: 'lShape', W: 10, H: 8, cutW: 4, cutH: 3, unit: 'ס"מ' },
  { type: 'compass' },
];

export function Gallery() {
  return (
    <div className="screen">
      {SAMPLES.map((v, i) => (
        <div key={i} className="card">
          <code>{JSON.stringify(v)}</code>
          <Visual v={v} />
        </div>
      ))}
    </div>
  );
}
