import { parseMidi } from 'midi-file';
import type { BassPattern, BassPatternStep } from './instrumentStyles';

const STEPS_PER_BAR = 16;
// MIDI note 36 = C2, matching bass.ts's BASS_OCTAVE. Every step is stored relative to
// this. Short patterns get re-anchored to whatever chord is sounding (author as if the
// chord were C); patterns exactly as long as the whole progression are assumed to be a
// finished bassline already composed against real chords, and get played back anchored
// to this fixed reference instead — see the mode split in bass.ts's scheduleBass.
export const REFERENCE_ROOT_MIDI = 36;

export function parseMidiBassBytes(buffer: ArrayBuffer): { name: string | null; pattern: BassPattern } {
  const midi = parseMidi(new Uint8Array(buffer));
  const nameEvent = midi.tracks.flat().find((event) => event.type === 'trackName');
  const name = nameEvent && 'text' in nameEvent ? nameEvent.text : null;
  const ppq = midi.header.ticksPerBeat ?? 128;
  const ticksPer16th = ppq / 4;

  const rawSteps: { step: number; intervalFromRoot: number; velocity: number }[] = [];
  let maxStep = 0;

  for (const track of midi.tracks) {
    let ticks = 0;
    for (const event of track) {
      ticks += event.deltaTime;
      // Any channel, any pitch — unlike drums there's no percussion-channel
      // filtering or GM note lookup, just "what note, and when."
      if (event.type !== 'noteOn' || event.velocity === 0) continue;
      const step = Math.round(ticks / ticksPer16th);
      maxStep = Math.max(maxStep, step);
      rawSteps.push({
        step,
        intervalFromRoot: event.noteNumber - REFERENCE_ROOT_MIDI,
        velocity: event.velocity / 127,
      });
    }
  }

  if (rawSteps.length === 0) {
    throw new Error('No notes found in this MIDI file.');
  }

  const bars = Math.max(1, Math.ceil((maxStep + 1) / STEPS_PER_BAR));
  const totalSteps = bars * STEPS_PER_BAR;

  const steps: BassPatternStep[] = rawSteps.map(({ step, intervalFromRoot, velocity }) => ({
    time: step % totalSteps,
    intervalFromRoot,
    velocity,
  }));

  return { name, pattern: { bars, steps } };
}
