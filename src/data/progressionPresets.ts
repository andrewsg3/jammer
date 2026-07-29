import type { ChordSelection, ScaleDegree } from './progressions';

export type ProgressionPreset = { name: string; selections: ChordSelection[] };

// Diatonic-only, so every preset resolves safely in both major and minor
// (borrowed-chord indices differ in size between scales — see progressions.ts —
// so mixing them into presets risks an out-of-range lookup for a preset written
// with one scale in mind).
const d = (degree: ScaleDegree): ChordSelection => ({ type: 'diatonic', degree });

export const progressionPresets: ProgressionPreset[] = [
  { name: 'I-IV-V-I (Classic)', selections: [d(0), d(3), d(4), d(0)] },
  { name: 'I-V-vi-IV (Pop)', selections: [d(0), d(4), d(5), d(3)] },
  { name: 'vi-IV-I-V (Pop variant)', selections: [d(5), d(3), d(0), d(4)] },
  { name: 'I-vi-IV-V (50s)', selections: [d(0), d(5), d(3), d(4)] },
  { name: 'ii-V-I-I (Jazz turnaround)', selections: [d(1), d(4), d(0), d(0)] },
  { name: 'vi-ii-V-I (Jazz)', selections: [d(5), d(1), d(4), d(0)] },
  { name: 'I-iii-vi-IV', selections: [d(0), d(2), d(5), d(3)] },
];
