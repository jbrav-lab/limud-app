import type { QuadKind, Visual as V } from '../engine/types';

const STROKE = 'var(--ink)';
const FILL = 'var(--accent-soft)';
const SHADE = 'var(--accent)';

function Svg({ w, h, children, label }: { w: number; h: number; children: React.ReactNode; label?: string }) {
  return (
    <svg className="visual" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} style={{ maxWidth: w * 1.15 }}>
      {children}
    </svg>
  );
}

function RightMark({ x, y, dx, dy, s = 12 }: { x: number; y: number; dx: number; dy: number; s?: number }) {
  // small square at corner (x,y) pointing towards (+dx, +dy)
  return <path d={`M${x + dx * s} ${y} L${x + dx * s} ${y + dy * s} L${x} ${y + dy * s}`} fill="none" stroke={STROKE} strokeWidth={1.5} />;
}

function Label({ x, y, children, size = 15 }: { x: number; y: number; children: React.ReactNode; size?: number }) {
  // Hebrew gershayim (״) keeps "6 ס״מ" in the right order inside SVG text.
  const text = typeof children === 'string' ? children.replace(/"/g, '״') : children;
  return (
    <text x={x} y={y} fontSize={size} textAnchor="middle" dominantBaseline="middle" fill="var(--ink)" fontWeight={600} direction="rtl">
      {text}
    </text>
  );
}

const QUADS: Record<QuadKind, [number, number][]> = {
  square: [[90, 30], [210, 30], [210, 150], [90, 150]],
  rectangle: [[50, 45], [250, 45], [250, 145], [50, 145]],
  rhombus: [[150, 20], [230, 90], [150, 160], [70, 90]],
  parallelogram: [[90, 40], [270, 40], [210, 140], [30, 140]],
  trapezoid: [[100, 40], [210, 40], [270, 145], [30, 145]],
  kite: [[150, 20], [215, 70], [150, 165], [85, 70]],
};

export function Visual({ v }: { v: V }) {
  switch (v.type) {
    case 'fractionBar': {
      const W = 300, H = 56, cw = W / v.parts;
      return (
        <Svg w={W + 4} h={H + 4} label="מלבן מחולק">
          {Array.from({ length: v.parts }, (_, i) => (
            <rect key={i} x={2 + i * cw} y={2} width={cw} height={H} fill={i < v.shaded ? SHADE : 'var(--card)'} stroke={STROKE} strokeWidth={2} />
          ))}
        </Svg>
      );
    }
    case 'numberLine': {
      const W = 330, x0 = 20, x1 = W - 20, y = 60;
      const n = (v.max - v.min) * v.ticksPerUnit;
      const step = (x1 - x0) / n;
      const markX = v.markAt !== undefined ? x0 + (v.markAt - v.min) * v.ticksPerUnit * step : null;
      return (
        <Svg w={W} h={95} label="ישר מספרים">
          <line x1={x0 - 10} y1={y} x2={x1 + 10} y2={y} stroke={STROKE} strokeWidth={2} />
          {Array.from({ length: n + 1 }, (_, i) => {
            const major = i % v.ticksPerUnit === 0;
            return <line key={i} x1={x0 + i * step} y1={y - (major ? 12 : 7)} x2={x0 + i * step} y2={y + (major ? 12 : 7)} stroke={STROKE} strokeWidth={major ? 2.5 : 1.5} />;
          })}
          {v.labels &&
            Array.from({ length: v.max - v.min + 1 }, (_, k) => (
              <Label key={k} x={x0 + k * v.ticksPerUnit * step} y={y + 26}>
                {v.min + k}
              </Label>
            ))}
          {markX !== null && (
            <g>
              <path d={`M${markX} ${y - 14} l-7 -14 h14 z`} fill="var(--warn)" />
              <Label x={markX} y={y - 40} size={17}>
                ?
              </Label>
            </g>
          )}
        </Svg>
      );
    }
    case 'decimalGrid': {
      const c = 22, s = 10 * c;
      return (
        <Svg w={s + 4} h={s + 4} label="ריבוע של מאה משבצות">
          {Array.from({ length: 100 }, (_, i) => {
            const col = Math.floor(i / 10), row = i % 10; // fill column by column (each column = 0.1)
            return <rect key={i} x={2 + col * c} y={2 + row * c} width={c} height={c} fill={i < v.shaded ? SHADE : 'var(--card)'} stroke="var(--line)" strokeWidth={0.8} />;
          })}
          <rect x={2} y={2} width={s} height={s} fill="none" stroke={STROKE} strokeWidth={2} />
        </Svg>
      );
    }
    case 'angle': {
      const cx = v.degrees > 100 ? 170 : 60, cy = 150, L = 140;
      const rad = (v.degrees * Math.PI) / 180;
      const ex = cx + L * Math.cos(rad), ey = cy - L * Math.sin(rad);
      const r = 34;
      const ax = cx + r * Math.cos(rad), ay = cy - r * Math.sin(rad);
      return (
        <Svg w={320} h={170} label={`זווית`}>
          {v.degrees === 90 ? (
            <RightMark x={cx} y={cy} dx={1} dy={-1} s={18} />
          ) : (
            v.showArc !== false && <path d={`M${cx + r} ${cy} A${r} ${r} 0 0 0 ${ax} ${ay}`} fill={FILL} stroke={SHADE} strokeWidth={2} />
          )}
          <line x1={cx} y1={cy} x2={cx + L} y2={cy} stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
          <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={STROKE} strokeWidth={3} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={4} fill={STROKE} />
        </Svg>
      );
    }
    case 'barChart': {
      // Right-to-left chart: y axis on the right, first category on the right (Hebrew reading order).
      const W = 320, H = 200, axis = W - 34, bottom = 170, top = 28;
      const max = Math.max(...v.values);
      const scaleMax = Math.ceil(max / 2) * 2 + 2;
      const bw = (axis - 10) / v.values.length;
      const xOf = (i: number) => axis - (i + 1) * bw; // left edge of slot i
      const yOf = (val: number) => bottom - (val / scaleMax) * (bottom - top);
      return (
        <Svg w={W} h={H} label="דיאגרמת עמודות">
          {v.title && (
            <text x={W / 2} y={14} fontSize={14} textAnchor="middle" fill="var(--ink)" fontWeight={700}>
              {v.title}
            </text>
          )}
          {Array.from({ length: scaleMax / 2 + 1 }, (_, i) => (
            <g key={`y${i}`}>
              <line x1={8} x2={axis} y1={yOf(i * 2)} y2={yOf(i * 2)} stroke="var(--line)" />
              <Label x={axis + 14} y={yOf(i * 2)} size={11}>
                {String(i * 2)}
              </Label>
            </g>
          ))}
          {v.values.map((val, i) => (
            <g key={i}>
              <rect x={xOf(i) + bw * 0.18} y={yOf(val)} width={bw * 0.64} height={bottom - yOf(val)} rx={4} fill={SHADE} />
              {v.showValues && (
                <Label x={xOf(i) + bw / 2} y={yOf(val) - 9} size={12}>
                  {String(val)}
                </Label>
              )}
              <text x={xOf(i) + bw / 2} y={bottom + 16} fontSize={13} textAnchor="middle" fill="var(--ink)">
                {v.labels[i]}
              </text>
            </g>
          ))}
          <line x1={8} x2={axis} y1={bottom} y2={bottom} stroke={STROKE} strokeWidth={2} />
          <line x1={axis} x2={axis} y1={top - 6} y2={bottom} stroke={STROKE} strokeWidth={2} />
        </Svg>
      );
    }
    case 'quad': {
      const pts = QUADS[v.kind];
      const right = v.kind === 'square' || v.kind === 'rectangle';
      return (
        <Svg w={300} h={180} label="מרובע">
          <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={FILL} stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
          {right && (
            <>
              <RightMark x={pts[0][0]} y={pts[0][1]} dx={1} dy={1} />
              <RightMark x={pts[1][0]} y={pts[1][1]} dx={-1} dy={1} />
              <RightMark x={pts[2][0]} y={pts[2][1]} dx={-1} dy={-1} />
              <RightMark x={pts[3][0]} y={pts[3][1]} dx={1} dy={-1} />
            </>
          )}
        </Svg>
      );
    }
    case 'triangleHeight': {
      const bx0 = 30, bx1 = 290, by = 150, ay = 25;
      const axp = bx0 + v.apexX * (bx1 - bx0);
      const foot = v.isHeight ? axp : axp + (v.apexX < 0.5 ? 55 : -55);
      return (
        <Svg w={320} h={170} label="משולש">
          <polygon points={`${bx0},${by} ${bx1},${by} ${axp},${ay}`} fill={FILL} stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
          <line x1={axp} y1={ay} x2={foot} y2={by} stroke="var(--warn)" strokeWidth={3} strokeDasharray="7 5" />
          {v.isHeight && <RightMark x={foot} y={by} dx={1} dy={-1} />}
        </Svg>
      );
    }
    case 'rect': {
      const maxW = 240, maxH = 130;
      const k = Math.min(maxW / v.w, maxH / v.h);
      const w = v.w * k, h = v.h * k, x = (320 - w) / 2, y = 15;
      return (
        <Svg w={320} h={h + 50} label="מלבן">
          <rect x={x} y={y} width={w} height={h} fill={FILL} stroke={STROKE} strokeWidth={3} />
          <Label x={x + w / 2} y={y + h + 18}>{`${v.w} ${v.unit}`}</Label>
          <Label x={x - 30} y={y + h / 2}>{`${v.h} ${v.unit}`}</Label>
        </Svg>
      );
    }
    case 'parallelogram': {
      const k = Math.min(200 / v.base, 110 / v.height);
      const b = v.base * k, h = v.height * k;
      const off = Math.min(60, Math.sqrt(Math.max(0, (v.side ?? v.height + 2) ** 2 - v.height ** 2)) * k);
      const x0 = (320 - b - off) / 2, y0 = 20 + h;
      const hx = x0 + off + 6;
      return (
        <Svg w={320} h={h + 60} label="מקבילית">
          <polygon points={`${x0},${y0} ${x0 + b},${y0} ${x0 + b + off},${y0 - h} ${x0 + off},${y0 - h}`} fill={FILL} stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
          <line x1={hx} y1={y0 - h} x2={hx} y2={y0} stroke="var(--warn)" strokeWidth={2.5} strokeDasharray="6 4" />
          <RightMark x={hx} y={y0} dx={1} dy={-1} />
          <Label x={hx + 22} y={y0 - h / 2}>{`${v.height}`}</Label>
          <Label x={x0 + b / 2} y={y0 + 18}>{`${v.base} ${v.unit}`}</Label>
          {v.side && <Label x={x0 + off / 2 - 16} y={y0 - h / 2}>{`${v.side}`}</Label>}
        </Svg>
      );
    }
    case 'triangleArea': {
      const k = Math.min(190 / v.base, 110 / v.height);
      const b = v.base * k, h = v.height * k;
      const x0 = v.obtuse ? 30 : (320 - b) / 2, y0 = 20 + h;
      const ax = v.obtuse ? x0 + b + 60 : x0 + b * 0.35;
      return (
        <Svg w={320} h={h + 60} label="משולש">
          {v.obtuse && <line x1={x0 + b} y1={y0} x2={ax} y2={y0} stroke={STROKE} strokeWidth={1.5} strokeDasharray="4 4" />}
          <polygon points={`${x0},${y0} ${x0 + b},${y0} ${ax},${y0 - h}`} fill={FILL} stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
          <line x1={ax} y1={y0 - h} x2={ax} y2={y0} stroke="var(--warn)" strokeWidth={2.5} strokeDasharray="6 4" />
          <RightMark x={ax} y={y0} dx={-1} dy={-1} />
          <Label x={ax + 18} y={y0 - h / 2}>{`${v.height}`}</Label>
          <Label x={x0 + b / 2} y={y0 + 18}>{`${v.base} ${v.unit}`}</Label>
        </Svg>
      );
    }
    case 'lShape': {
      const k = Math.min(220 / v.W, 140 / v.H);
      const ox = 60, oy = 15;
      const P = (x: number, y: number) => `${ox + x * k},${oy + y * k}`;
      const pts = [P(0, 0), P(v.W - v.cutW, 0), P(v.W - v.cutW, v.cutH), P(v.W, v.cutH), P(v.W, v.H), P(0, v.H)].join(' ');
      return (
        <Svg w={320} h={v.H * k + 50} label="צורה מורכבת">
          <polygon points={pts} fill={FILL} stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />
          <Label x={ox + (v.W * k) / 2} y={oy + v.H * k + 18}>{`${v.W}`}</Label>
          <Label x={ox - 18} y={oy + (v.H * k) / 2}>{`${v.H}`}</Label>
          <Label x={ox + (v.W - v.cutW / 2) * k} y={oy + v.cutH * k - 13}>{`${v.cutW}`}</Label>
          <Label x={ox + (v.W - v.cutW) * k - 14} y={oy + (v.cutH * k) / 2}>{`${v.cutH}`}</Label>
        </Svg>
      );
    }
    case 'compass': {
      const c = 100, R = 62;
      const dirs = ['צ', 'צ-מז', 'מז', 'ד-מז', 'ד', 'ד-מע', 'מע', 'צ-מע'];
      return (
        <Svg w={200} h={200} label="שושנת הרוחות">
          <circle cx={c} cy={c} r={R} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
          {dirs.map((d, i) => {
            const a = (i * 45 * Math.PI) / 180;
            const main = i % 2 === 0;
            const x = c + Math.sin(a) * (R + 22), y = c - Math.cos(a) * (R + 22);
            return (
              <g key={i}>
                <line x1={c} y1={c} x2={c + Math.sin(a) * R} y2={c - Math.cos(a) * R} stroke={main ? STROKE : 'var(--muted)'} strokeWidth={main ? 2.5 : 1.2} />
                <text x={x} y={y} fontSize={main ? 15 : 11} fontWeight={main ? 700 : 400} textAnchor="middle" dominantBaseline="middle" fill="var(--ink)">
                  {d}
                </text>
              </g>
            );
          })}
        </Svg>
      );
    }
  }
}
