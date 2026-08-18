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

// How many frets *beyond* the position's own start fret a box reaches -- so a
// box actually spans SCALE_BOX_FRETS + 1 distinct fret positions (e.g. 4 means
// startFret..startFret+4, a 5-fret-wide box), not SCALE_BOX_FRETS of them.
// This isn't just headroom: a real CAGED-style scale box routinely needs a
// pinky stretch to a 5th fret to pick up every scale tone within a position
// (confirmed against every root/scale/E-or-A-position combination this app
// can produce -- every single one has at least one string whose note at
// startFret+4 has no closer duplicate within startFret..startFret+3, so a
// box that only rendered 4 frets would silently be missing real notes, not
// just cropping empty space). `ScaleFretboardDiagram.tsx` sizes its SVG off
// this same constant so the rendered grid always matches what this function
// actually produces.
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

// One label per semitone offset from the root, for the number printed inside
// each dot -- per direct user request ("the 1 / b2 etc type notation"). A
// single canonical spelling per semitone class, not a context-aware one: the
// same honest simplification this app already accepts elsewhere (see
// data/scaleSuggestions.ts's own note on this app's scale vocabulary) rather
// than trying to re-derive real key-signature-aware enharmonic spelling for
// an arbitrary interval set with no scale-degree metadata of its own attached
// (unlike, say, progressions.ts's diatonic ScaleName machinery, which always
// knows which major-scale mode it's building from). The one real ambiguity
// this glosses over is semitone 8 -- #5 in an augmented/whole-tone context,
// b6 in a natural-minor/Aeolian one -- resolved to "b6" as the more common
// default across this app's own scale vocabulary (SCALE_INTERVALS has no
// whole-tone/augmented scale at all -- see progressions.ts's ScaleName --
// so b6 is right far more often here than #5 would be).
const SEMITONE_DEGREE_LABELS = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

export type ScaleFretboardNote = { string: GuitarString; fret: number; isRoot: boolean; degreeLabel: string };

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
        const semitoneFromRoot = ((pitch - rootPitch) % 12 + 12) % 12;
        notes.push({
          string: stringNum as GuitarString,
          fret,
          isRoot: pitch === rootPitch,
          degreeLabel: SEMITONE_DEGREE_LABELS[semitoneFromRoot],
        });
      }
    }
  }
  return notes;
}
