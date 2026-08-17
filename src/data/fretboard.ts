import { rootSemitone } from './progressions';
import type { ChordQuality } from './progressions';

// Standard tuning, low to high: E A D G B E. Each string's open pitch as a
// semitone offset from the low E string's own open pitch (string 6) -- e.g.
// string 5 (A) sits a perfect 4th (5 semitones) above open low E. Strings are
// numbered guitar-style: 6 = low E, 1 = high E -- same convention data/
// licks.ts's own OPEN_STRING_MIDI uses (and VexFlow's TabNote), though that
// table stores real sounding MIDI pitches for a melodic phrase's notes, not
// semitone offsets for finding which fret plays a given chord root; kept
// separate rather than shared since the two modules solve different problems
// (a lick's fixed fret/string vs. a movable chord shape barred at any root).
export type GuitarString = 1 | 2 | 3 | 4 | 5 | 6;
const STRING_OFFSET_FROM_LOW_E: Record<GuitarString, number> = { 6: 0, 5: 5, 4: 10, 3: 15, 2: 19, 1: 24 };
// Open low E's own absolute semitone in this app's C=0 table (progressions.ts's
// NOTE_TO_SEMITONE) -- needed to convert a fretted string/fret into a real
// pitch class, and back again to find which fret a given root note lands on.
const LOW_E_OPEN_SEMITONE = 4;

export type CagedShapeName = 'E' | 'A' | 'C' | 'G' | 'D';

// One movable chord shape, expressed relative to its own root fret (0 = the
// shape's root position, i.e. what you'd play at fret 0 for a root of the
// shape's own open-chord letter -- E-shape at fret 0 is a plain open E chord).
// frets are in physical string order top-to-bottom as normally drawn: low E,
// A, D, G, B, high E (strings 6,5,4,3,2,1) -- null means muted/not played.
export type ShapeFretting = {
  shape: CagedShapeName;
  frets: [number | null, number | null, number | null, number | null, number | null, number | null];
  rootString: GuitarString;
};

// Curated, not generated (see CLAUDE.md's "Guitar fingering diagrams" section
// for why) -- every shape below is a real, standard movable barre-chord form,
// derived from a well-known open-position chord (E-shape from open E, A-shape
// from open A) and checked tone-by-tone against QUALITY_INTERVALS's own
// definition of the quality (root/3rd/5th/7th degrees only -- no chord here
// carries an extension past a 7th). Only the qualities with a real, confident
// standard shape are populated; everything else deliberately has none yet
// (see FretboardDiagram/PracticeView's own "no diagram yet" handling) rather
// than guessing at a shape that might be unplayable or musically wrong.
export const CAGED_SHAPES: Partial<Record<ChordQuality, ShapeFretting[]>> = {
  // R-5-R-3-5-R (open E / open A major, barred)
  maj: [
    { shape: 'E', frets: [0, 2, 2, 1, 0, 0], rootString: 6 },
    { shape: 'A', frets: [null, 0, 2, 2, 2, 0], rootString: 5 },
  ],
  // R-5-R-b3-5-R (open Em / open Am, barred)
  min: [
    { shape: 'E', frets: [0, 2, 2, 0, 0, 0], rootString: 6 },
    { shape: 'A', frets: [null, 0, 2, 2, 1, 0], rootString: 5 },
  ],
  // R-5-b7-3-5-R (open E7 / open A7, barred) -- the classic six-string "blues" dominant shape
  dom7: [
    { shape: 'E', frets: [0, 2, 0, 1, 0, 0], rootString: 6 },
    { shape: 'A', frets: [null, 0, 2, 0, 2, 0], rootString: 5 },
  ],
  // R-5-7-3-5-R (open Emaj7 / open Amaj7, barred)
  maj7: [
    { shape: 'E', frets: [0, 2, 1, 1, 0, 0], rootString: 6 },
    { shape: 'A', frets: [null, 0, 2, 1, 2, 0], rootString: 5 },
  ],
  // R-5-b7-b3-5-R (open Em7 / open Am7, barred)
  min7: [
    { shape: 'E', frets: [0, 2, 0, 0, 0, 0], rootString: 6 },
    { shape: 'A', frets: [null, 0, 2, 0, 1, 0], rootString: 5 },
  ],
};

/** Which of the 12 pitch classes a given string/fret actually sounds -- e.g.
 * fret 3 on the low E string sounds G. Exported for data/scaleFretboard.ts,
 * which needs the same string/fret -> pitch-class math for scale/arpeggio
 * boxes (a different problem from a curated chord shape's own root fret, but
 * the same underlying fretboard geometry). */
export function pitchClassAt(stringNum: GuitarString, fret: number): number {
  return ((LOW_E_OPEN_SEMITONE + STRING_OFFSET_FROM_LOW_E[stringNum] + fret) % 12 + 12) % 12;
}

/** The lowest fret (0-11) at which this shape's root string actually sounds
 * the given root note -- i.e. where to barre a movable shape for that root. */
export function rootFretFor(root: string, shape: ShapeFretting): number {
  const target = rootSemitone(root);
  const openPitch = pitchClassAt(shape.rootString, 0);
  return ((target - openPitch) % 12 + 12) % 12;
}

export type FrettedNote = { string: GuitarString; fret: number | null };

/** The real, absolute fret numbers this shape plays for a given root -- e.g.
 * CAGED_SHAPES.dom7's E-shape for root "G" plays a G7 barred at fret 3. */
export function absoluteFretting(root: string, shape: ShapeFretting): FrettedNote[] {
  const barreFret = rootFretFor(root, shape);
  const strings: GuitarString[] = [6, 5, 4, 3, 2, 1];
  return shape.frets.map((relativeFret, i) => ({
    string: strings[i],
    fret: relativeFret === null ? null : relativeFret + barreFret,
  }));
}
