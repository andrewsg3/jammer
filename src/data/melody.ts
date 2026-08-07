// A single, fixed melody line — unlike bass/keys, never transposed or re-derived
// from the chord progression. What comes in from a MIDI import is what plays back
// and what gets drawn on the staff, verbatim.
export type MelodyNote = {
  startBeat: number; // absolute, same coordinate space as ChordPlacement.startBeat
  midi: number; // MIDI note number, 0-127
  lengthBeats: number;
  velocity: number; // 0-1
};

const MIDDLE_C = 60; // C4

// Semitone offset within an octave -> diatonic step (C=0..B=6), naturals only.
const NATURAL_STEP_BY_PITCH_CLASS: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

/**
 * Splits a MIDI pitch into a diatonic staff step (absolute across octaves, C4=step
 * 35 by construction of octave*7 below) plus whether it needs a sharp. Not real
 * key-signature-aware spelling — every black key is spelled as "the natural below,
 * sharp" (e.g. Eb renders as D#). Wrong in flat-heavy keys, but cheap and always
 * visually plausible; see the melody plan in CLAUDE.md for why that's an
 * intentional simplification.
 */
export function spellPitch(midi: number): { absoluteStep: number; sharp: boolean } {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12);
  const naturalStep = NATURAL_STEP_BY_PITCH_CLASS[pitchClass];
  if (naturalStep !== undefined) return { absoluteStep: octave * 7 + naturalStep, sharp: false };
  // Black keys always fall one semitone above a natural, so pitchClass - 1 is
  // guaranteed to be one of the naturals above.
  return { absoluteStep: octave * 7 + NATURAL_STEP_BY_PITCH_CLASS[pitchClass - 1], sharp: true };
}

// Treble clef's bottom line is E4 — the reference every note's staff position is
// measured against.
const BOTTOM_LINE_REFERENCE = spellPitch(MIDDLE_C + 4).absoluteStep;

/**
 * Diatonic steps above the staff's bottom line (negative = below it), plus whether
 * the note needs a sharp. Each step is half a staff line-gap vertically — a line
 * and its adjacent space are one step apart, two lines are two steps apart. Sanity
 * check: middle C comes out to -2 steps, i.e. one ledger line below the staff.
 */
export function staffStepsAboveBottomLine(midi: number): { steps: number; sharp: boolean } {
  const { absoluteStep, sharp } = spellPitch(midi);
  return { steps: absoluteStep - BOTTOM_LINE_REFERENCE, sharp };
}
