import * as Tone from 'tone';
import { chordTones, type Chord, type ChordPlacement, type ScaleName } from '../data/progressions';
import type { DrumPattern, BassRule, BassPattern, KeysRule } from '../data/instrumentStyles';
import {
  scheduleDrums,
  disposeDrums,
  setVolume as setDrumsOutputVolume,
  setInstrument as setDrumsInstrumentImpl,
} from './drums';
import {
  scheduleBass,
  disposeBass,
  setVolume as setBassOutputVolume,
  setInstrument as setBassInstrumentImpl,
} from './bass';
import {
  scheduleKeys,
  disposeKeys,
  setVolume as setKeysOutputVolume,
  setInstrument as setKeysInstrumentImpl,
} from './keys';
import { scheduleMetronome, disposeMetronome, setVolume as setMetronomeOutputVolume } from './metronome';

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
  bassPattern: BassPattern | null;
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

// Sliders work in 0-100 (%); dB conversion keeps 100 at unity gain and 0 fully silent.
function percentToDb(percent: number): number {
  return Tone.gainToDb(Math.max(0, Math.min(100, percent)) / 100);
}

export function setChordsVolume(percent: number): void {
  setKeysOutputVolume(percentToDb(percent));
}

export function setBassVolume(percent: number): void {
  setBassOutputVolume(percentToDb(percent));
}

export function setDrumsVolume(percent: number): void {
  setDrumsOutputVolume(percentToDb(percent));
}

export function setMetronomeVolume(percent: number): void {
  setMetronomeOutputVolume(percentToDb(percent));
}

export function setChordsInstrument(name: string): void {
  setKeysInstrumentImpl(name);
}

export function setBassInstrument(name: string): void {
  setBassInstrumentImpl(name);
}

export function setDrumsInstrument(name: string): void {
  setDrumsInstrumentImpl(name);
}

export async function play(params: PlaybackParams): Promise<void> {
  await Tone.start();
  stop();
  setTempo(params.tempo);

  Tone.Transport.loop = true;
  Tone.Transport.loopStart = `0:${params.loopStartBeat}:0`;
  Tone.Transport.loopEnd = `0:${params.loopEndBeat}:0`;

  if (params.drums) scheduleDrums(params.drums);
  if (params.bass || params.bassPattern) {
    scheduleBass(params.placements, params.key, params.scale, params.bass, params.bassPattern);
  }
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
