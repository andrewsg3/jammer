import * as Tone from 'tone';
import {
  chordTones,
  scaleTones,
  notesFromIntervals,
  type Chord,
  type ChordPlacement,
  type ScaleName,
} from '../data/progressions';
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
  playCountIn,
  setVolume as setMetronomeOutputVolume,
  setMuted as setMetronomeOutputMuted,
} from './metronome';
import {
  scheduleMelody,
  disposeMelody,
  setVolume as setMelodyOutputVolume,
  setMuted as setMelodyOutputMuted,
} from './melody';
import { acquireWakeLock, releaseWakeLock } from './wakeLock';

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

// Holds the sustained chord pad's release, so a new scale audition can cut off
// whatever pad is still ringing from a previous one rather than piling up.
let stopCurrentScaleAuditionPad: (() => void) | null = null;

/** Shared core behind auditionScale and auditionExoticScale below: loops a
 * sustained voicing of the chord (one octave down, so it doesn't clash with the
 * run above it) while running the given scale notes (already resolved to actual
 * pitches at AUDITION_OCTAVE, rooted whichever note the caller wants — not
 * necessarily the chord's own root, e.g. "E minor over Cmaj7") up and back down
 * over it. Standalone one-shot gesture scheduled via Tone.now(), independent of
 * the Transport/song playback, same as auditionChord. */
function runScaleAudition(chord: Chord, scaleRoot: string, scale7: string[]): void {
  stopCurrentScaleAuditionPad?.();

  const pad = chordTones(chord, AUDITION_OCTAVE - 1);
  auditionSynth.triggerAttack(pad);
  stopCurrentScaleAuditionPad = () => auditionSynth.triggerRelease(pad);

  const octaveUp = `${scaleRoot}${AUDITION_OCTAVE + 1}`;
  const run = [...scale7, octaveUp, ...[...scale7].reverse()];
  const secondsPerNote = 0.16;
  const now = Tone.now();
  run.forEach((note, i) => {
    auditionSynth.triggerAttackRelease(note, secondsPerNote * 0.85, now + i * secondsPerNote);
  });

  const stopPadAfterRun = stopCurrentScaleAuditionPad;
  window.setTimeout(
    () => {
      // Only release if nothing newer has already taken over the pad.
      if (stopCurrentScaleAuditionPad === stopPadAfterRun) {
        stopPadAfterRun();
        stopCurrentScaleAuditionPad = null;
      }
    },
    (run.length * secondsPerNote + 0.3) * 1000,
  );
}

/** Auditions one of this app's own ScaleName modes (the chord-scale suggestions
 * panel's pills) over the chord, rooted on the chord's own root — see
 * runScaleAudition above. */
export async function auditionScale(chord: Chord, scale: ScaleName): Promise<void> {
  await Tone.start();
  runScaleAudition(chord, chord.root, scaleTones(chord.root, scale, AUDITION_OCTAVE));
}

/** Same idea as auditionScale, but for the "any scale, including exotic ones"
 * modal — takes a raw semitone-interval set (data/exoticScales.ts) rather than
 * one of this app's own ScaleName modes, and a scale root that's independently
 * chosen rather than always the chord's own root (e.g. "E minor over Cmaj7"). */
export async function auditionExoticScale(chord: Chord, scaleRoot: string, intervals: number[]): Promise<void> {
  await Tone.start();
  runScaleAudition(chord, scaleRoot, notesFromIntervals(scaleRoot, intervals, AUDITION_OCTAVE));
}

// 0 = no count-in, 4 = one bar, 8 = two bars in 4/4 -- not necessarily a whole
// number of bars in every meter (see MobilePlayer.tsx's own "(N bars)" label,
// which only shows a bar count when it divides evenly). Fixed regardless of the
// song's own beatsPerBar; only the click accent pattern (see playCountIn) reads
// the actual meter.
export type CountInBeats = 0 | 4 | 8;
export const COUNT_IN_OPTIONS: CountInBeats[] = [0, 4, 8];

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
  countInBeats: CountInBeats;
  // Simple meter only, always over a "4" denominator -- see CLAUDE.md's "Beats
  // per bar" section. Only the metronome's accent pattern reads this so far
  // (Phase 2 -- drums/bass/keys pattern generators -- still assumes 4/4).
  beatsPerBar: number;
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
  // Fire-and-forget — acquireWakeLock() swallows its own rejections, and
  // playback shouldn't wait on it either way.
  void acquireWakeLock();
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
      params.beatsPerBar,
    );
  }
  if (params.keys) scheduleKeys(params.placements, params.key, params.scale, params.keys, params.keysTimeFeel);
  if (params.melody.length > 0) scheduleMelody(params.melody);
  // Always scheduled — audibility is controlled by its mute state (a track like any
  // other now), not by whether it's running at all.
  scheduleMetronome(params.beatsPerBar);

  // Count-in clicks happen before the Transport's own clock starts ticking at all,
  // so they're scheduled independently (Tone.now()-relative, same as the chord/scale
  // auditions above) rather than through the Transport-driven loop scheduleMetronome
  // just set up. The Transport's actual start is then pushed back by that same
  // duration, in real time — its internal position still begins exactly at
  // params.startBeat, unaffected by the count-in, so the playhead/loop/section math
  // downstream never needs to know a count-in happened at all.
  const secondsPerBeat = 60 / params.tempo;
  const countInSeconds = params.countInBeats * secondsPerBeat;
  if (params.countInBeats > 0) playCountIn(params.countInBeats, params.tempo, params.beatsPerBar);

  // The offset (2nd arg) is where the transport's internal clock begins — lets
  // playback start from wherever the playhead was dragged to, not always bar 1.
  Tone.Transport.start(Tone.now() + countInSeconds, `0:${params.startBeat}:0`);
}

export function stop(): void {
  Tone.Transport.stop();
  Tone.Transport.cancel(0);
  disposeDrums();
  disposeBass();
  disposeKeys();
  disposeMelody();
  disposeMetronome();
  releaseWakeLock();
}

const autoStopListeners = new Set<() => void>();

/** Registers a callback fired whenever the engine force-stops itself (see the
 * visibilitychange handler below), so App.tsx/MobilePlayer.tsx can sync their own
 * isPlaying state without polling. Returns an unsubscribe function. */
export function onAutoStop(callback: () => void): () => void {
  autoStopListeners.add(callback);
  return () => autoStopListeners.delete(callback);
}

// Mobile browsers suspend the AudioContext when the page is backgrounded — screen
// locked, app minimized, even just the notification shade pulled down over it.
// Transport keeps scheduling into a clock that's about to freeze, and when the
// context unsuspends there's a backlog of events that fires in one rapid, pitched-
// up burst (the "sounds insane" bug). There's no reliable way to resync that clock,
// and this app has no resume-in-place model to begin with — Play always starts
// fresh via stop() above — so treat backgrounding as an implicit Stop rather than
// trying to survive it.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Tone.Transport.state === 'started') {
      stop();
      autoStopListeners.forEach((cb) => cb());
    }
  });
}
