import { parseMidi } from 'midi-file';
import { STEPS_PER_BEAT, STEPS_PER_BAR } from './instrumentStyles';
import type { DrumPattern, DrumStep } from './instrumentStyles';

const PERCUSSION_CHANNEL = 9;

// General MIDI percussion note numbers, mapped one lane per physical sound source —
// GM already distinguishes closed/open/pedal hi-hat, ride vs. ride bell, and each
// tom pitch, so this is mostly just *not* collapsing them the way a smaller voice
// set would have to.
const GM_TO_DRUM_NOTE: Record<number, DrumStep['note']> = {
  35: 'kick',
  36: 'kick',
  38: 'snare',
  40: 'snare',
  37: 'rim', // side stick
  41: 'tomLow',
  43: 'tomLow',
  45: 'tomMid',
  47: 'tomMid',
  48: 'tomHigh',
  50: 'tomHigh',
  42: 'hihat', // closed
  44: 'hihatFoot', // pedal — the "chick," not a struck hit
  46: 'hihatOpen',
  51: 'ride',
  59: 'ride',
  53: 'rideBell',
  49: 'crash',
  57: 'crash',
  52: 'crash', // chinese cymbal — closest fallback
  55: 'crash', // splash — closest fallback
};

/** Parses raw MIDI bytes into a drum pattern, plus the file's track name if it has one. */
export function parseMidiDrumBytes(buffer: ArrayBuffer): { name: string | null; pattern: DrumPattern } {
  const midi = parseMidi(new Uint8Array(buffer));
  const nameEvent = midi.tracks.flat().find((event) => event.type === 'trackName');
  const name = nameEvent && 'text' in nameEvent ? nameEvent.text : null;
  const ppq = midi.header.ticksPerBeat ?? 128;
  // STEPS_PER_BEAT ticks per beat — fine enough to quantize both straight 16th
  // notes and 8th-note triplets (shuffle feel) without rounding one onto the other.
  const ticksPerStep = ppq / STEPS_PER_BEAT;

  const rawSteps: { step: number; note: DrumStep['note']; velocity: number }[] = [];
  let maxStep = 0;

  for (const track of midi.tracks) {
    let ticks = 0;
    for (const event of track) {
      ticks += event.deltaTime;
      // Drum hits are momentary triggers — treat every noteOn as a hit and
      // ignore noteOff entirely. Some exporters (e.g. GrooveScribe) never
      // emit a matching noteOff for percussion hits at all.
      if (event.type !== 'noteOn' || event.channel !== PERCUSSION_CHANNEL || event.velocity === 0) {
        continue;
      }
      const drumNote = GM_TO_DRUM_NOTE[event.noteNumber];
      if (!drumNote) continue;
      const step = Math.round(ticks / ticksPerStep);
      maxStep = Math.max(maxStep, step);
      rawSteps.push({ step, note: drumNote, velocity: event.velocity / 127 });
    }
  }

  if (rawSteps.length === 0) {
    throw new Error('No recognizable drum hits found in this MIDI file.');
  }

  const bars = Math.max(1, Math.ceil((maxStep + 1) / STEPS_PER_BAR));
  const totalSteps = bars * STEPS_PER_BAR;

  // A few GM notes still share one lane here (crash/chinese/splash all -> 'crash';
  // both tom notes at a given pitch -> one tomX bucket). If two of those land on the
  // same step (common in GrooveScribe exports), de-dupe rather than firing that
  // voice's monophonic synth twice at the identical instant, which throws inside
  // Tone's envelope scheduling. Keep the louder of the two.
  const deduped = new Map<string, DrumStep>();
  for (const { step, note, velocity } of rawSteps) {
    const time = step % totalSteps;
    const key = `${time}:${note}`;
    const existing = deduped.get(key);
    if (!existing || velocity > existing.velocity) {
      deduped.set(key, { time, note, velocity });
    }
  }

  return { name, pattern: { bars, steps: [...deduped.values()] } };
}

export async function parseMidiDrumPattern(file: File): Promise<DrumPattern> {
  const buffer = await file.arrayBuffer();
  return parseMidiDrumBytes(buffer).pattern;
}
