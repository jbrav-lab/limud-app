import type { Topic, Unit } from '../engine/types';

/** A curriculum pack = one subject for one grade (e.g. grade 5 math). */
export interface PackInfo {
  /** "g<grade>.<subject>", e.g. "g5.math". Topic and unit ids inside the pack are prefixed with it. */
  id: string;
  grade: number;
  subject: string;
  title: string;
  emoji: string;
  /** Text direction of the pack's content (English packs are "ltr" inside the Hebrew app). */
  dir: 'rtl' | 'ltr';
  /** Which Ministry of Education program the content follows. */
  program: string;
  /** Curriculum mapping document in the repo. */
  doc: string;
}

/** What a pack's content module exports. Ids are local ("fractions"); the registry namespaces them. */
export interface PackContent {
  units: Unit[];
  topics: Topic[];
}

/** A loaded pack: info plus content with namespaced ids ("g5.math.fractions"). */
export interface Pack extends PackInfo, PackContent {}
