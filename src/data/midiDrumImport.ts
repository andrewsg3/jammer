import { parseMidi } from 'midi-file';
import type { DrumPattern, DrumStep } from './instrumentStyles';

const PERCUSSION_CHANNEL = 9;
const STEPS_PER_BAR = 16;

// General MIDI percussion note numbers, bucketed into our 3 drum voices.
const GM_TO_DRUM_NOTE: Record<number, DrumStep['note']> = {
  35: 'kick',
  36: 'kick',
  38: 'snare',
  40: 'snare',
  37: 'snare', // side stick — closest fallback
  // toms fall back to 'snare', the closest available voice, rather than being dropped
  41: 'snare',
  43: 'snare',
  45: 'snare',
  47: 'snare',
  48: 'snare',
  50: 'snare',
  42: 'hihat',
  44: 'hihat',
  46: 'hihat',
  49: 'hihat',
  51: 'hihat',
  52: 'hihat',
  53: 'hihat',
  55: 'hihat',
  57: 'hihat',
  59: 'hihat',
};

/** Parses raw MIDI bytes into a drum pattern, plus the file's track name if it has one. */
export function parseMidiDrumBytes(buffer: ArrayBuffer): { name: string | null; pattern: DrumPattern } {
  const midi = parseMidi(new Uint8Array(buffer));
  const nameEvent = midi.tracks.flat().find((event) => event.type === 'trackName');
  const name = nameEvent && 'text' in nameEvent ? nameEvent.text : null;
  const ppq = midi.header.ticksPerBeat ?? 128;
  const ticksPer16th = ppq / 4;

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
      const step = Math.round(ticks / ticksPer16th);
      maxStep = Math.max(maxStep, step);
      rawSteps.push({ step, note: drumNote, velocity: event.velocity / 127 });
    }
  }

  if (rawSteps.length === 0) {
    throw new Error('No recognizable drum hits found in this MIDI file.');
  }

  const bars = Math.max(1, Math.ceil((maxStep + 1) / STEPS_PER_BAR));
  const totalSteps = bars * STEPS_PER_BAR;

  const steps: DrumStep[] = rawSteps.map(({ step, note, velocity }) => ({
    time: step % totalSteps,
    note,
    velocity,
  }));

  return { name, pattern: { bars, steps } };
}

export async function parseMidiDrumPattern(file: File): Promise<DrumPattern> {
  const buffer = await file.arrayBuffer();
  return parseMidiDrumBytes(buffer).pattern;
}
