import { resolveSelection, chordTones, scaleTones, type Chord, type ChordPlacement, type ScaleName } from './progressions';
import { SCALE_SUGGESTIONS } from './scaleSuggestions';
import type { MelodyNote } from './melody';

// "Trading fours" scoped down to its cheapest honest version (see CLAUDE.md): no
// audio input, no listening — the bot just alternates fixed-length blocks between
// playing and resting, picking notes algorithmically from whatever scale this app's
// existing chord-scale-suggestion table already recommends for the chord underneath.
// Not a trained model, not "AI" in any real sense — an algorithmic generator, same
// spirit as the BassRule/KeysRule pattern engines, just monophonic.

const BOT_REGISTER_OCTAVE = 5;
const BLOCK_BARS = 4;
const BEATS_PER_BAR = 4;
const BLOCK_BEATS = BLOCK_BARS * BEATS_PER_BAR;

const SEMITONE_FROM_C: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Deliberately not reusing Tone.Frequency for this — data/ files stay Tone-free
// (see progressions.ts's own note-name math) — so this is the same kind of small,
// local semitone table, just inverted (name -> MIDI instead of MIDI -> name).
function noteNameToMidi(note: string): number {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(note);
  if (!match) throw new Error(`Unparseable note name: "${note}"`);
  const [, letter, accidental, octaveStr] = match;
  let semitone = SEMITONE_FROM_C[letter];
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;
  return (Number(octaveStr) + 1) * 12 + semitone;
}

function notePoolForChord(chord: Chord): number[] {
  const suggested = SCALE_SUGGESTIONS[chord.quality];
  // Qualities with no honest scale fit (same empty-array convention scaleSuggestions.ts
  // already uses) fall back to an arpeggio of the chord's own tones -- always
  // harmonically safe even with no scale to draw from.
  const names =
    suggested && suggested.length > 0
      ? scaleTones(chord.root, suggested[0] as ScaleName, BOT_REGISTER_OCTAVE)
      : chordTones(chord, BOT_REGISTER_OCTAVE);
  return names.map(noteNameToMidi);
}

function isBotOnBeat(beat: number): boolean {
  // Even-numbered blocks are the bot's; odd blocks are left silent for the human
  // to play into (or for the backing track to carry alone) -- the "trading" part.
  return Math.floor(beat / BLOCK_BEATS) % 2 === 0;
}

/**
 * Generates one improvised pass over `placements` -- silent during odd 4-bar blocks,
 * soloing (scale/chord-tone random walk, mixed quarter/eighth rhythm) during even
 * ones. Called fresh on every Play press rather than memoized: a real soloist never
 * plays a chorus the same way twice, and regenerating is exactly what makes this
 * feel like an "improviser" rather than a second fixed melody.
 */
export function generateJazzbotLine(placements: ChordPlacement[], key: string, scale: ScaleName): MelodyNote[] {
  const sorted = [...placements].sort((a, b) => a.startBeat - b.startBeat);
  const notes: MelodyNote[] = [];

  for (const placement of sorted) {
    const chord = resolveSelection(key, scale, placement.selection);
    const pool = notePoolForChord(chord);
    let poolIndex = Math.floor(pool.length / 2);
    let beat = placement.startBeat;
    const end = placement.startBeat + placement.lengthBeats;

    while (beat < end) {
      if (!isBotOnBeat(beat)) {
        beat += 1;
        continue;
      }
      // Small steps through the pool (-1/0/+1), not free jumps -- keeps the line's
      // melodic contour smooth instead of wandering all over the register.
      const step = Math.floor(Math.random() * 3) - 1;
      poolIndex = Math.max(0, Math.min(pool.length - 1, poolIndex + step));
      const useEighths = Math.random() < 0.35 && end - beat >= 0.5;
      const lengthBeats = useEighths ? 0.5 : 1;
      const rest = Math.random() < 0.2;
      if (!rest) {
        notes.push({
          startBeat: beat,
          midi: pool[poolIndex],
          lengthBeats: lengthBeats * 0.9, // slight detach between notes, not fully legato
          velocity: 0.55 + Math.random() * 0.25,
        });
      }
      beat += lengthBeats;
    }
  }

  return notes;
}
