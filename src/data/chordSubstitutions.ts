import { keySignatureAccidentals, shiftRoot, shiftRootFlat } from './progressions';
import type { Chord, ChordQuality, ScaleName } from './progressions';

// A scoped-down slice of the not-yet-built chord progression analyzer (see
// CLAUDE.md's "Chord progression analyzer" design doc) -- these four rules are
// deliberately the only ones that don't need surrounding-chord context (no
// lookahead/lookbehind, no key-center ambiguity to resolve) to be honestly
// correct, unlike most of that doc's own catalog:
// - Tritone substitution and "the related ii" are both universal properties of
//   a dominant 7th chord alone -- true regardless of what it resolves to.
// - Relative-minor/relative-major substitution is likewise a fixed interval
//   from the chord's own root, independent of the song's key.
// Every other reharm idea in the analyzer doc (secondary dominants, tritone
// *approach*, turnarounds, modal interchange) genuinely needs neighboring
// chords or section position, so isn't attempted here.
export type ChordSubstitution = { label: string; chord: Chord };

function spellRoot(fromRoot: string, offset: number, key: string, scale: ScaleName): string {
  const sign = keySignatureAccidentals(key, scale).sign;
  return sign === 'sharp' ? shiftRoot(fromRoot, offset) : shiftRootFlat(fromRoot, offset);
}

const SUBSTITUTABLE_QUALITIES: ChordQuality[] = ['dom7', 'maj7', 'maj', 'min7', 'min'];

/** Whether getChordSubstitutions has anything to say for this quality -- lets a
 * caller skip rendering an empty "Substitutions" section entirely, same
 * "hidden rather than offered-and-empty" stance SCALE_SUGGESTIONS/CAGED_SHAPES
 * already take for a quality with no real answer. */
export function hasChordSubstitutions(quality: ChordQuality): boolean {
  return SUBSTITUTABLE_QUALITIES.includes(quality);
}

/** Root spelling is relative to the chord's own root (key/scale only pick
 * sharp-vs-flat), so this stays honest for any chord regardless of the song's
 * actual key -- same design as CAGED_SHAPES' movable fingerings. */
export function getChordSubstitutions(chord: Chord, key: string, scale: ScaleName): ChordSubstitution[] {
  switch (chord.quality) {
    case 'dom7':
      return [
        {
          label: 'Tritone substitution',
          chord: { root: spellRoot(chord.root, 6, key, scale), quality: 'dom7' },
        },
        {
          label: 'Related ii (ii–V for this V7)',
          chord: { root: spellRoot(chord.root, 7, key, scale), quality: 'min7' },
        },
      ];
    case 'maj7':
    case 'maj':
      return [
        {
          label: 'Relative minor substitution',
          chord: { root: spellRoot(chord.root, 9, key, scale), quality: 'min7' },
        },
      ];
    case 'min7':
    case 'min':
      return [
        {
          label: 'Relative major substitution',
          chord: { root: spellRoot(chord.root, 3, key, scale), quality: 'maj7' },
        },
      ];
    default:
      return [];
  }
}
