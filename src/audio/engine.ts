import * as Tone from 'tone';
import { chordTones, type Chord, type ChordPlacement, type ScaleName } from '../data/progressions';
import type { DrumPattern, BassRule, KeysRule } from '../data/instrumentStyles';
import { scheduleDrums, disposeDrums } from './drums';
import { scheduleBass, disposeBass } from './bass';
import { scheduleKeys, disposeKeys } from './keys';
import { scheduleMetronome, disposeMetronome } from './metronome';

const AUDITION_OCTAVE = 4;
let auditionSynth: Tone.PolySynth<Tone.Synth> | null = null;

/** Plays a chord once, independent of the Transport loop — for palette clicks. */
export async function auditionChord(chord: Chord): Promise<void> {
  await Tone.start();
  if (!auditionSynth) {
    auditionSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 },
    }).toDestination();
  }
  auditionSynth.triggerAttackRelease(chordTones(chord, AUDITION_OCTAVE), '4n');
}

export type PlaybackParams = {
  key: string;
  scale: ScaleName;
  placements: ChordPlacement[];
  loopStartBeat: number;
  loopEndBeat: number;
  drums: DrumPattern | null;
  bass: BassRule | null;
  keys: KeysRule | null;
  tempo: number;
  metronome: boolean;
};

export function setTempo(bpm: number): void {
  Tone.Transport.bpm.value = bpm;
}

/** Current transport position in quarter-note beats — wraps within the active loop range. */
export function getCurrentBeat(): number {
  return Tone.Transport.ticks / Tone.Transport.PPQ;
}

export function setMetronomeEnabled(enabled: boolean): void {
  if (enabled) scheduleMetronome();
  else disposeMetronome();
}

export async function play(params: PlaybackParams): Promise<void> {
  await Tone.start();
  stop();
  setTempo(params.tempo);

  Tone.Transport.loop = true;
  Tone.Transport.loopStart = `0:${params.loopStartBeat}:0`;
  Tone.Transport.loopEnd = `0:${params.loopEndBeat}:0`;

  if (params.drums) scheduleDrums(params.drums);
  if (params.bass) scheduleBass(params.placements, params.key, params.scale, params.bass);
  if (params.keys) scheduleKeys(params.placements, params.key, params.scale, params.keys);
  if (params.metronome) scheduleMetronome();

  Tone.Transport.start();
}

export function stop(): void {
  Tone.Transport.stop();
  Tone.Transport.cancel(0);
  disposeDrums();
  disposeBass();
  disposeKeys();
  disposeMetronome();
}
