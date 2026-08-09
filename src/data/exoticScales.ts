export type ExoticScale = {
  name: string;
  // Semitones from the root, ascending, not including the octave.
  intervals: number[];
};

// A broader scale vocabulary than this app's own ScaleName (progressions.ts) —
// that type is the 7 diatonic modes of the major scale, tied to how key
// signatures and diatonic chord-building work elsewhere in the app. These have
// no such role: they exist purely so the "audition any scale over any chord"
// modal (ChordPalette.tsx) has real exotic options — melodic/harmonic minor,
// whole-tone, both diminished scales, altered, pentatonics, bebop dominant —
// none of which fit (or need to fit) the diatonic-mode system. Includes the 7
// diatonic modes too, so this list alone covers everything the modal needs
// without also reaching into SCALE_SUGGESTIONS/ScaleName.
//
// Grouped the same way progressions.ts's QUALITY_GROUPS groups chord qualities
// for its own <optgroup>-based picker — same convention, same reason (a flat
// list of 19 options is harder to scan than a few labeled clusters).
export const EXOTIC_SCALE_GROUPS: { label: string; scales: ExoticScale[] }[] = [
  {
    label: 'Diatonic Modes',
    scales: [
      { name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11] },
      { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
      { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
      { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
      { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
      { name: 'Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10] },
      { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
    ],
  },
  {
    label: 'Minor & Major Variants',
    scales: [
      { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
      { name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
      { name: 'Harmonic Major', intervals: [0, 2, 4, 5, 7, 8, 11] },
    ],
  },
  {
    label: 'Symmetric & Altered',
    scales: [
      { name: 'Lydian Dominant', intervals: [0, 2, 4, 6, 7, 9, 10] },
      { name: 'Altered', intervals: [0, 1, 3, 4, 6, 8, 10] },
      { name: 'Whole Tone', intervals: [0, 2, 4, 6, 8, 10] },
      { name: 'Diminished (Whole-Half)', intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
      { name: 'Diminished (Half-Whole)', intervals: [0, 1, 3, 4, 6, 7, 9, 10] },
    ],
  },
  {
    label: 'Pentatonic & Blues',
    scales: [
      { name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
      { name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10] },
      { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
    ],
  },
  {
    label: 'Bebop',
    scales: [{ name: 'Bebop Dominant', intervals: [0, 2, 4, 5, 7, 9, 10, 11] }],
  },
];
