import * as Tone from 'tone';
import { chordTones, type Chord, type ChordPlacement, type ScaleName } from '../data/progressions';
import { PIANO_SAMPLE_URLS } from '../data/pianoSamples';
import type { DrumPattern, TimeFeel, BassRule, BassPattern, KeysRule } from '../data/instrumentStyles';
import type { MelodyNote } from '../data/melody';
import type { SectionMarker } from '../data/sections';
import {
  scheduleDrums,
  disposeDrums,
  setVolume as setDrumsOutputVolume,
  setInstrument as setDrumsInstrumentImpl,
  setKickVolume as setKickOutputVolume,
  setSnareVolume as setSnareOutputVolume,
  setRimVolume as setRimOutputVolume,
  setHihatVolume as setHihatOutputVolume,
  setHihatOpenVolume as setHihatOpenOutputVolume,
  setHihatFootVolume as setHihatFootOutputVolume,
  setRideVolume as setRideOutputVolume,
  setRideBellVolume as setRideBellOutputVolume,
  setCrashVolume as setCrashOutputVolume,
  setTomsVolume as setTomsOutputVolume,
  setMuted as setDrumsOutputMuted,
  setCompressionEnabled as setDrumsCompressionEnabledImpl,
  setReverbEnabled as setDrumsReverbEnabledImpl,
} from './drums';
import {
  scheduleBass,
  disposeBass,
  setVolume as setBassOutputVolume,
  setInstrument as setBassInstrumentImpl,
  setMuted as setBassOutputMuted,
  isInstrumentLoaded as isBassInstrumentLoadedImpl,
  setCompressionEnabled as setBassCompressionEnabledImpl,
} from './bass';
import {
  scheduleKeys,
  disposeKeys,
  setVolume as setKeysOutputVolume,
  setInstrument as setKeysInstrumentImpl,
  setMuted as setKeysOutputMuted,
  setChorusEnabled as setKeysChorusEnabledImpl,
  setReverbEnabled as setKeysReverbEnabledImpl,
  isInstrumentLoaded as isKeysInstrumentLoadedImpl,
} from './keys';
import {
  scheduleMetronome,
  disposeMetronome,
  setVolume as setMetronomeOutputVolume,
  setMuted as setMetronomeOutputMuted,
} from './metronome';
import {
  scheduleMelody,
  disposeMelody,
  setVolume as setMelodyOutputVolume,
  setMuted as setMelodyOutputMuted,
} from './melody';

const AUDITION_OCTAVE = 4;
// Always Acoustic Piano, independent of whatever instrument the Harmony track
// is actually set to — a chord-palette preview wants one consistent, pleasant
// sound, not whatever synth/sample the song happens to be using. Built eagerly
// at module load (not lazily on first click) so its buffers have a head start
// loading, same reasoning as keys.ts's own eager instrument construction.
const auditionSynth = new Tone.Sampler({ urls: PIANO_SAMPLE_URLS, release: 1 }).toDestination();

/** Plays a chord once, independent of the Transport loop — for palette clicks. */
export async function auditionChord(chord: Chord): Promise<void> {
  await Tone.start();
  auditionSynth.triggerAttackRelease(chordTones(chord, AUDITION_OCTAVE), '4n');
}

export type PlaybackParams = {
  key: string;
  scale: ScaleName;
  placements: ChordPlacement[];
  loopStartBeat: number;
  loopEndBeat: number;
  startBeat: number;
  drums: DrumPattern | null;
  drumsTimeFeel: TimeFeel;
  bass: BassRule | null;
  bassPattern: BassPattern | null;
  bassTimeFeel: TimeFeel;
  keys: KeysRule | null;
  keysTimeFeel: TimeFeel;
  melody: MelodyNote[];
  sections: SectionMarker[];
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

export function setRimVolume(percent: number): void {
  setRimOutputVolume(percentToDb(percent));
}

export function setHihatOpenVolume(percent: number): void {
  setHihatOpenOutputVolume(percentToDb(percent));
}

export function setHihatFootVolume(percent: number): void {
  setHihatFootOutputVolume(percentToDb(percent));
}

export function setRideVolume(percent: number): void {
  setRideOutputVolume(percentToDb(percent));
}

export function setRideBellVolume(percent: number): void {
  setRideBellOutputVolume(percentToDb(percent));
}

export function setCrashVolume(percent: number): void {
  setCrashOutputVolume(percentToDb(percent));
}

export function setTomsVolume(percent: number): void {
  setTomsOutputVolume(percentToDb(percent));
}

export function setMetronomeVolume(percent: number): void {
  setMetronomeOutputVolume(percentToDb(percent));
}

export function setMelodyVolume(percent: number): void {
  setMelodyOutputVolume(percentToDb(percent));
}

export function setMelodyMuted(muted: boolean): void {
  setMelodyOutputMuted(muted);
}

export function setChordsMuted(muted: boolean): void {
  setKeysOutputMuted(muted);
}

export function setChordsChorusEnabled(enabled: boolean): void {
  setKeysChorusEnabledImpl(enabled);
}

export function setChordsReverbEnabled(enabled: boolean): void {
  setKeysReverbEnabledImpl(enabled);
}

export function setBassCompressionEnabled(enabled: boolean): void {
  setBassCompressionEnabledImpl(enabled);
}

export function setDrumsCompressionEnabled(enabled: boolean): void {
  setDrumsCompressionEnabledImpl(enabled);
}

export function setDrumsReverbEnabled(enabled: boolean): void {
  setDrumsReverbEnabledImpl(enabled);
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

/** False while the Harmony instrument is sample-based (e.g. Acoustic Piano) and
 * still loading — App.tsx polls this to gate Play and show a loading modal. */
export function isKeysInstrumentLoaded(): boolean {
  return isKeysInstrumentLoadedImpl();
}

export function setBassInstrument(name: string): void {
  setBassInstrumentImpl(name);
}

/** Same idea as isKeysInstrumentLoaded, for the Bass instrument. */
export function isBassInstrumentLoaded(): boolean {
  return isBassInstrumentLoadedImpl();
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

  if (params.drums) scheduleDrums(params.drums, params.drumsTimeFeel, params.sections);
  if (params.bass || params.bassPattern) {
    scheduleBass(
      params.placements,
      params.key,
      params.scale,
      params.bass,
      params.bassPattern,
      params.bassTimeFeel,
    );
  }
  if (params.keys) scheduleKeys(params.placements, params.key, params.scale, params.keys, params.keysTimeFeel);
  if (params.melody.length > 0) scheduleMelody(params.melody);
  // Always scheduled — audibility is controlled by its mute state (a track like any
  // other now), not by whether it's running at all.
  scheduleMetronome();

  // The offset (2nd arg) is where the transport's internal clock begins — lets
  // playback start from wherever the playhead was dragged to, not always bar 1.
  Tone.Transport.start(Tone.now(), `0:${params.startBeat}:0`);
}

export function stop(): void {
  Tone.Transport.stop();
  Tone.Transport.cancel(0);
  disposeDrums();
  disposeBass();
  disposeKeys();
  disposeMelody();
  disposeMetronome();
}
