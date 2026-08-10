import { rootSemitone } from './progressions';

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

// A major scale's own degree semitones (degrees 1-7, from its own root) — the
// reference every scale's degree formula is built against below, since "the
// major scale's own take on each degree" is what a formula like "b3" or "#4" is
// actually relative to (not the chromatic scale, and not the root's own natural
// letter — see scaleDegreeNoteNames' own comment for why that's a separate
// computation from this one).
const MAJOR_DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_LETTER_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

type ScaleDegree = { degree: number; diff: number };

/** Assigns each interval a (degree 1-7, diff from the major scale's own degree)
 * pair — the shared source both scaleDegreeLabels and scaleDegreeNoteNames build
 * from, so a formula entry like "b3" and its note name are always talking about
 * the same degree. A 7-note scale maps position-for-position against the major
 * scale (this is what correctly tells apart Lydian's #4 and Locrian's b5 despite
 * both landing on the same semitone — see scaleDegreeLabels' own comment). A
 * scale with a different note count (pentatonics, whole tone, both diminished
 * scales, bebop dominant) has no single canonical degree numbering to begin
 * with, so each interval instead gets whichever major-scale degree sits closest
 * to it, flat spelling preferred on an exact tie. */
function degreesFor(intervals: number[]): ScaleDegree[] {
  if (intervals.length === 7) {
    return intervals.map((interval, i) => ({ degree: i + 1, diff: interval - MAJOR_DEGREE_SEMITONES[i] }));
  }
  return intervals.map((interval) => {
    let bestDegree = 1;
    let bestDiff = interval - MAJOR_DEGREE_SEMITONES[0];
    for (let d = 2; d <= 7; d++) {
      const diff = interval - MAJOR_DEGREE_SEMITONES[d - 1];
      if (Math.abs(diff) < Math.abs(bestDiff) || (Math.abs(diff) === Math.abs(bestDiff) && diff < 0)) {
        bestDegree = d;
        bestDiff = diff;
      }
    }
    return { degree: bestDegree, diff: bestDiff };
  });
}

function accidentalString(count: number): string {
  return count < 0 ? 'b'.repeat(-count) : count > 0 ? '#'.repeat(count) : '';
}

/** A scale's degree formula, e.g. natural minor -> ["1","2","b3","4","5","b6","b7"].
 * This app takes the same cheap-but-plausible approach to spelling elsewhere
 * (see CLAUDE.md's melody notation section) — a fully rigorous formula for every
 * possible scale would need real key-signature-aware theory this app doesn't
 * otherwise carry, so non-7-note scales get a reasonable nearest-degree label
 * (see degreesFor above) rather than a claim of "the" one correct formula. */
export function scaleDegreeLabels(intervals: number[]): string[] {
  return degreesFor(intervals).map(({ degree, diff }) => `${accidentalString(diff)}${degree}`);
}

/** Note names for each scale degree, spelled by actual letter distance from the
 * root — e.g. C natural minor's b3 reads as "Eb", not the pitch-identical but
 * wrong-looking "D#" that progressions.ts's notesFromIntervals would give (that
 * function always prefers sharps; it's built for Tone.js playback, which only
 * cares about the pitch, not which letter names it "correctly"). Reuses
 * degreesFor's same (degree, diff-from-major) pairing as scaleDegreeLabels, so
 * a "b3" entry and its note name are always describing the same degree —
 * distinct from that diff, though: this recomputes its own accidental relative
 * to the target letter's own natural pitch, not the major scale's. */
export function scaleDegreeNoteNames(root: string, intervals: number[]): string[] {
  const rootLetterIndex = NATURAL_LETTERS.indexOf(root[0]);
  const rootSt = rootSemitone(root);

  return degreesFor(intervals).map(({ degree }, i) => {
    const letter = NATURAL_LETTERS[(rootLetterIndex + degree - 1) % 7];
    const actualSemitone = ((rootSt + intervals[i]) % 12 + 12) % 12;
    let accidental = actualSemitone - NATURAL_LETTER_SEMITONES[letter];
    // Normalize into a small, spellable range — the raw difference can wrap
    // around the octave (e.g. B's natural sits at 11, C at 0: a semitone apart
    // "the short way," but 11 apart by plain subtraction).
    while (accidental > 6) accidental -= 12;
    while (accidental < -6) accidental += 12;
    return `${letter}${accidentalString(accidental)}`;
  });
}
