// Shared between ChordGrid.tsx (the per-row staves) and SheetMusicHeader.tsx (the
// decorative header staff) so the two always match exactly — a separate module
// rather than one importing from the other, to avoid a circular import between them.
export const STAFF_HEIGHT = 32; // px — 5 lines, 8px apart
export const STAFF_LINE_GAP = STAFF_HEIGHT / 4;

// Treble-clef staff position (diatonic steps above the bottom line — same units as
// melody.ts's staffStepsAboveBottomLine) for each key-signature accidental letter,
// using the conventional zigzag engraving. Unlike a melody note, a key-signature
// accidental is a fixed positional symbol, not tied to any particular octave, so
// these are hand-picked reference positions rather than derived from a pitch.
export const SHARP_KEY_SIG_STEPS: Record<string, number> = { F: 8, C: 5, G: 9, D: 6, A: 3, E: 7, B: 4 };
export const FLAT_KEY_SIG_STEPS: Record<string, number> = { B: 4, E: 7, A: 3, D: 6, G: 2, C: 5, F: 8 };
