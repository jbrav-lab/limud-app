// Text markup used in prompts, options, lessons and solutions:
//   {3/4}      -> stacked fraction       {2 3/4} -> mixed number
//   [[ ... ]]  -> a left-to-right math span inside Hebrew text
//   **bold**   -> emphasis
export type RichText = string;

export type Level = 1 | 2 | 3;

export type QuadKind = 'square' | 'rectangle' | 'rhombus' | 'parallelogram' | 'trapezoid' | 'kite';

export type Visual =
  | { type: 'fractionBar'; parts: number; shaded: number; wholes?: number }
  | { type: 'numberLine'; min: number; max: number; ticksPerUnit: number; markAt?: number; labels?: boolean }
  | { type: 'decimalGrid'; shaded: number }
  | { type: 'angle'; degrees: number; showArc?: boolean }
  | { type: 'barChart'; labels: string[]; values: number[]; title?: string; showValues?: boolean }
  | { type: 'quad'; kind: QuadKind }
  | {
      type: 'triangleHeight';
      // Triangle with apex above base; dashed segment from apex to base line.
      apexX: number; // 0..1 along the base (can be outside for obtuse)
      isHeight: boolean;
    }
  | { type: 'rect'; w: number; h: number; unit: string; showLabels?: { w?: boolean; h?: boolean } }
  | { type: 'parallelogram'; base: number; height: number; side?: number; unit: string }
  | { type: 'triangleArea'; base: number; height: number; unit: string; obtuse?: boolean }
  | { type: 'lShape'; W: number; H: number; cutW: number; cutH: number; unit: string }
  | { type: 'compass' };

export type Answer =
  | { kind: 'number'; value: number; unit?: string }
  // value = num/den. form: any equivalent / must be fully reduced / must be a mixed number (whole + proper fraction)
  | { kind: 'fraction'; num: number; den: number; form?: 'any' | 'simplest' | 'mixed'; allowWhole?: boolean }
  | { kind: 'choice'; options: RichText[]; correct: number }
  | { kind: 'compare'; correct: '<' | '>' | '=' }
  | { kind: 'divRem'; q: number; r: number };

export interface Question {
  prompt: RichText;
  expression?: RichText; // shown big, left-to-right
  visual?: Visual;
  answer: Answer;
  hint?: RichText;
  solution: RichText[];
  /** A story/word problem: fractions in its prompt must appear in words AND as numbers (frBoth). */
  wordProblem?: boolean;
}

export type LessonBlock =
  | { kind: 'text'; text: RichText }
  | { kind: 'example'; text: RichText; expression?: RichText }
  | { kind: 'visual'; visual: Visual; caption?: RichText }
  | { kind: 'tip'; text: RichText };

export interface Topic {
  id: string;
  unit: string;
  title: string;
  emoji: string;
  lesson: LessonBlock[];
  generate: (level: Level) => Question;
}

export interface Unit {
  id: string;
  title: string;
  color: string;
}
