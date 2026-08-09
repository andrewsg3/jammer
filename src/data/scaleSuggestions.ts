import type { ChordQuality, ScaleName } from './progressions';

// Chord-scale suggestions, using only the 7 scales this app actually has
// (SCALE_NAMES — the diatonic modes of the major scale; no melodic/harmonic minor,
// whole-tone, or diminished/octatonic scales). That's a real constraint: several
// qualities' textbook "correct" scale doesn't exist in that set at all (altered
// dominants want the altered/diminished scale, augmented triads want whole-tone,
// minor-major7 wants melodic minor). Rather than force a wrong answer onto those,
// they're simply left out — an empty/short list here means "no honest fit in this
// app's scale set," not a gap that needs filling in. Ordered best-fit first where
// there's more than one reasonable option.
export const SCALE_SUGGESTIONS: Record<ChordQuality, ScaleName[]> = {
  maj: ['major', 'lydian'],
  add9: ['major', 'lydian'],
  '6': ['major', 'lydian'],
  maj7: ['major', 'lydian'],
  maj9: ['major', 'lydian'],
  maj13: ['major', 'lydian'],
  // The Lydian scale's defining color tone (#11) is literally this chord's own
  // extension — the one unambiguous "textbook" pairing in this whole table.
  maj7sharp11: ['lydian'],
  min: ['minor', 'dorian'],
  min7: ['dorian', 'minor'],
  m9: ['dorian', 'minor'],
  m11: ['dorian', 'minor'],
  // Dorian's natural 6th is the chord's own 6th — a clean fit, not just "close enough."
  m6: ['dorian'],
  dom7: ['mixolydian'],
  dom9: ['mixolydian'],
  dom13: ['mixolydian'],
  sus2: ['major'],
  sus4: ['major', 'mixolydian'],
  dim: ['locrian'],
  dim7: ['locrian'],
  m7b5: ['locrian'],
  // Loose, not a clean fit (the real answer is the altered/diminished/whole-tone
  // scales this app doesn't have) — kept anyway since it's the common casual
  // approximation, but every other altered-dominant quality below is left empty
  // rather than reaching for an equally loose but less commonly-cited stand-in.
  dom7sharp9: ['mixolydian'],
  minMaj7: [],
  aug: [],
  dom7flat9: [],
  dom7sharp5: [],
  dom7flat5: [],
  dom7sharp11: [],
  dom7flat9flat5: [],
};
