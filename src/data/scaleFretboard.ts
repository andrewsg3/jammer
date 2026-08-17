import { rootSemitone } from './progressions';
import { pitchClassAt } from './fretboard';
import type { GuitarString } from './fretboard';

// Only the two shapes this app has curated/verified chord voicings for (see
// CLAUDE.md's "Guitar fingering diagrams" section) -- E-shape (root on the low
// E string) and A-shape (root on the A string). A scale/arpeggio "box" only
// actually needs a root string + anchor fret, not a full CAGED_SHAPES chord
// voicing, so in principle all five CAGED letters could anchor a box here --
// deliberately not doing that yet, to keep "which positions this app shows"
// consistent with the chord fingering popover's own honest E/A-only scope
// rather than introducing C/G/D-shape positions nowhere else in the app uses.
export type ScalePosition = 'E' | 'A';
export const SCALE_POSITIONS: ScalePosition[] = ['E', 'A'];
const POSITION_ROOT_STRING: Record<ScalePosition, GuitarString> = { E: 6, A: 5 };

// How many frets wide a box is -- same FRETS_SHOWN a chord diagram already
// uses (components/practice/FretboardDiagram.tsx), for the same reason: wide
// enough to comfortably show a full scale run without needing to scale
// per-scale, narrow enough to read as one position at a glance.
export const SCALE_BOX_FRETS = 4;

/** The lowest fret (0-11) on a position's own root string where the given
 * root note actually sounds -- same math as fretboard.ts's rootFretFor, just
 * not tied to a specific ShapeFretting (a scale box needs only the root
 * string, not a full curated chord voicing). */
export function positionStartFret(root: string, position: ScalePosition): number {
  const target = rootSemitone(root);
  const openPitch = pitchClassAt(POSITION_ROOT_STRING[position], 0);
  return ((target - openPitch) % 12 + 12) % 12;
}

export type ScaleFretboardNote = { string: GuitarString; fret: number; isRoot: boolean };

/**
 * Every fretted note within a position's own fret window that belongs to the
 * given scale/arpeggio (a plain semitone-interval set from the root -- either
 * data/exoticScales.ts's ExoticScale.intervals or progressions.ts's
 * QUALITY_INTERVALS, this module doesn't care which). Unlike CAGED_SHAPES
 * (one curated dot per string, a specific fingering chosen by ear/hand), this
 * is generated, not curated -- deliberately so, per CLAUDE.md's own reasoning
 * for why chords went the curated route: correctness here is just "is this
 * fret's pitch class a member of the scale," fully verifiable per note (the
 * same tone-by-tone check CLAUDE.md's "Guitar fingering diagrams" section
 * already ran for chord shapes), not a musicality/playability judgment call a
 * generator can't make reliably for a specific chord voicing. Multiple notes
 * per string are expected and correct here (unlike a chord diagram's one dot
 * per string) -- a scale box is a fretting *pattern*, not a single voicing.
 */
export function findPositionNotes(root: string, intervals: number[], position: ScalePosition): ScaleFretboardNote[] {
  const rootPitch = rootSemitone(root);
  const tones = new Set(intervals.map((i) => ((rootPitch + i) % 12 + 12) % 12));
  const startFret = positionStartFret(root, position);
  const notes: ScaleFretboardNote[] = [];
  for (let stringNum = 1; stringNum <= 6; stringNum++) {
    for (let fret = startFret; fret <= startFret + SCALE_BOX_FRETS; fret++) {
      const pitch = pitchClassAt(stringNum as GuitarString, fret);
      if (tones.has(pitch)) {
        notes.push({ string: stringNum as GuitarString, fret, isRoot: pitch === rootPitch });
      }
    }
  }
  return notes;
}
