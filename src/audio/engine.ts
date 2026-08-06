import * as Tone from 'tone';
import { chordTones, type Chord, type ChordPlacement, type ScaleName } from '../data/progressions';
import type { DrumPattern, BassRule, BassPattern, KeysRule } from '../data/instrumentStyles';
import {
  scheduleDrums,
  disposeDrums,
  setVolume as setDrumsOutputVolume,
  setInstrument as setDrumsInstrumentImpl,
  setKickVolume as setKickOutputVolume,
  setSnareVolume as setSnareOutputVolume,
  setHihatVolume as setHihatOutputVolume,
  setMuted as setDrumsOutputMuted,
} from './drums';
import {
  scheduleBass,
  disposeBass,
  setVolume as setBassOutputVolume,
  setInstrument as setBassInstrumentImpl,
  setMuted as setBassOutputMuted,
} from './bass';
import {
  scheduleKeys,
  disposeKeys,
  setVolume as setKeysOutputVolume,
  setInstrument as setKeysInstrumentImpl,
  setMuted as setKeysOutputMuted,
} from './keys';
import {
  scheduleMetronome,
  disposeMetronome,
  setVolume as setMetronomeOutputVolume,
  setMuted as setMetronomeOutputMuted,
} from './metronome';

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
};

export function setTempo(bpm: number): void {
  Tone.Transport.bpm.value = bpm;
}

/** Current transport position in quarter-note beats — wraps within the active loop range. */
export function getCurrentBeat(): number {
  return Tone.Transport.ticks / Tone.Transport.PPQ;
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

export function setKickVolume(percent: number): void {
  setKickOutputVolume(percentToDb(percent));
}

export function setSnareVolume(percent: number): void {
  setSnareOutputVolume(percentToDb(percent));
}

export function setHihatVolume(percent: number): void {
  setHihatOutputVolume(percentToDb(percent));
}

export function setMetronomeVolume(percent: number): void {
  setMetronomeOutputVolume(percentToDb(percent));
}

export function setChordsMuted(muted: boolean): void {
  setKeysOutputMuted(muted);
}

export function setBassMuted(muted: boolean): void {
  setBassOutputMuted(muted);
}

export function setDrumsMuted(muted: boolean): void {
  setDrumsOutputMuted(muted);
}

export function setMetronomeMuted(muted: boolean): void {
  setMetronomeOutputMuted(muted);
}

// Every track already connects straight to Tone.Destination (no shared bus needed) —
// so "master volume" is just that destination's own volume.
export function setMasterVolume(percent: number): void {
  Tone.Destination.volume.value = percentToDb(percent);
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
  // Always scheduled — audibility is controlled by its mute state (a track like any
  // other now), not by whether it's running at all.
  scheduleMetronome();

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
