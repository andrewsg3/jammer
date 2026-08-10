import * as Tone from 'tone';
import { STEPS_PER_BAR, STEPS_PER_BEAT } from '../data/instrumentStyles';
import type { DrumPattern, DrumVoice, TimeFeel } from '../data/instrumentStyles';
import { getSampleUrl } from '../data/drumSamples';
import { loadBundledDrumFills, type DrumFill } from '../data/drumFills';
import type { SectionMarker } from '../data/sections';

// Loaded once at module scope, same as the sample maps below — fills are an
// internal implementation detail of scheduleDrums, not a user-selectable style,
// so there's no need to thread this through engine.ts/App.tsx/MobilePlayer.tsx
// the way drum/bass *styles* are. If Play happens to fire before this resolves,
// or no fills are bundled at all, that section just plays with no fill (see the
// empty-check where sectionsWithRoom is scheduled below) rather than falling
// back to a placeholder — no gate needed either way.
let bundledFills: DrumFill[] = [];
loadBundledDrumFills().then((fills) => {
  bundledFills = fills;
});

// Bus glue: gentle compression evens out how punchy each lane feels relative to the
// others — the sample lanes are pulled from unrelated takes/mics with inherently
// inconsistent levels in a way the synth lanes never were, so this matters more for
// this track than it would have with only synths. Moderate settings (not a
// squashed/pumping amount) when engaged. Toggleable — off by default (ratio:1 is a
// real bypass, zero gain reduction, not just "subtle"), same pattern as bass.ts's
// Comp toggle.
const compressor = new Tone.Compressor({ threshold: -28, ratio: 1, attack: 0.01, release: 0.2 }).toDestination();

export function setCompressionEnabled(enabled: boolean): void {
  // See bass.ts's identical comment — same fix, same reason: verified the toggle
  // itself was always wired correctly, just tuned too gently to actually hear.
  compressor.ratio.value = enabled ? 5 : 1;
}

// Short room reverb as a parallel send, not inserted into the dry path — enough to
// read as one shared space (the real samples are dry, close-mic'd one-shots with no
// room of their own) without smearing transients or washing out the dry punch.
// Toggleable — off (muted) by default, same pattern as keys.ts's Reverb toggle.
const reverb = new Tone.Freeverb({ roomSize: 0.25, dampening: 3500 }).toDestination();
const reverbSend = new Tone.Volume(-10).connect(reverb);
reverbSend.mute = true;

export function setReverbEnabled(enabled: boolean): void {
  reverbSend.mute = !enabled;
}

// Shared output so one volume control (the Drums fader) trims every voice together;
// each lane additionally has its own node feeding into it, for the individual mix
// exposed via the channel strip's expand popout. Toms share one fader across all
// three pitches, since they also share one synth instance below (same instrument,
// just triggered at different pitches) — there's no separate signal to route
// per-pitch without giving each tom its own synth, which the pitch difference alone
// doesn't warrant.
const output = new Tone.Volume(0).connect(compressor);
output.connect(reverbSend);
const kickVolume = new Tone.Volume(0).connect(output);
const snareVolume = new Tone.Volume(0).connect(output);
const rimVolume = new Tone.Volume(0).connect(output);
const hihatVolume = new Tone.Volume(0).connect(output);
const hihatOpenVolume = new Tone.Volume(0).connect(output);
const hihatFootVolume = new Tone.Volume(0).connect(output);
const rideVolume = new Tone.Volume(0).connect(output);
const rideBellVolume = new Tone.Volume(0).connect(output);
const crashVolume = new Tone.Volume(0).connect(output);
const tomsVolume = new Tone.Volume(0).connect(output);

let kick: Tone.MembraneSynth | null = null;
let snare: Tone.NoiseSynth | null = null;
let hihat: Tone.MetalSynth | null = null;
let rim: Tone.NoiseSynth | null = null;
let hihatOpen: Tone.MetalSynth | null = null;
let hihatFoot: Tone.MetalSynth | null = null;
let ride: Tone.MetalSynth | null = null;
let rideBell: Tone.MetalSynth | null = null;
let crash: Tone.MetalSynth | null = null;
let toms: Tone.MembraneSynth | null = null;
let loop: Tone.Loop | null = null;
let sectionCrashPart: Tone.Part<{ time: string }> | null = null;
let sectionFillPart: Tone.Part<{ time: string; note: DrumVoice; velocity: number }> | null = null;
// Absolute-beat ranges the main Loop below should go quiet for — rebuilt fresh
// each scheduleDrums() call, one entry per section that got a fill. Checked via
// Transport.getTicksAtTime(time) (the audio-clock time Tone actually schedules
// each tick for, converted back to a transport beat) rather than a plain mutable
// "are we in a fill right now" flag flipped inside the fill Part's own callback:
// Tone.Part/Loop callbacks fire up to its lookahead window *before* the audio
// time they're scheduled for, so a flag set inside the fill's callback would
// have wrongly suppressed some of the main Loop's ticks that were actually
// scheduled to sound *earlier* than the fill's real start.
let fillWindows: { start: number; end: number }[] = [];
let currentInstrument = 'Acoustic';

// Which lane's Volume node a given DrumVoice's sample player should feed into —
// same mixer node its synth already uses, so the per-voice fader/mute in the
// channel strip's expand popout works identically whether a lane is synthesized
// or sampled. Toms share one node across all three pitches, same as their synth.
const ALL_DRUM_VOICES: DrumVoice[] = [
  'kick',
  'snare',
  'rim',
  'hihat',
  'hihatOpen',
  'hihatFoot',
  'ride',
  'rideBell',
  'crash',
  'tomHigh',
  'tomMid',
  'tomLow',
];
const voiceVolume: Record<DrumVoice, Tone.Volume> = {
  kick: kickVolume,
  snare: snareVolume,
  rim: rimVolume,
  hihat: hihatVolume,
  hihatOpen: hihatOpenVolume,
  hihatFoot: hihatFootVolume,
  ride: rideVolume,
  rideBell: rideBellVolume,
  crash: crashVolume,
  tomHigh: tomsVolume,
  tomMid: tomsVolume,
  tomLow: tomsVolume,
};

// One Tone.Player per DrumVoice that has a matching sample file for the current
// instrument — see data/drumSamples.ts. Any voice with no file just has no entry
// here, and scheduleDrums' triggerSample falls back to that voice's synth.
const players: Partial<Record<DrumVoice, Tone.Player>> = {};

// Fixed per-voice gain correction for sample playback — the samples come from
// different takes/mics with genuinely different recorded levels (not something
// the shared mixer fader should have to compensate for on every song). 0dB
// (untouched) for any voice not listed here.
const SAMPLE_TRIM_DB: Partial<Record<DrumVoice, number>> = {
  hihatFoot: 14, // the foot-chick sample is recorded much quieter than the rest of the kit
};

// Placeholder synth voices — quick, plausible approximations rather than deeply
// tuned patches, since real per-voice fidelity is planned to come from samples
// later. The point right now is that each physical sound has its own lane at all.
function ensureSynths() {
  const electronic = currentInstrument === 'Electronic';
  if (!kick) {
    kick = electronic
      ? // 808-style: a long, deep sine boom with a slow pitch envelope.
        new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 4,
          envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 },
        }).connect(kickVolume)
      : new Tone.MembraneSynth().connect(kickVolume);
  }
  if (!snare) {
    snare = electronic
      ? new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
        }).connect(snareVolume)
      : new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
        }).connect(snareVolume);
  }
  if (!hihat) {
    hihat = electronic
      ? // More digital/ticky — higher harmonicity and resonance, shorter decay.
        new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.03, release: 0.01 },
          harmonicity: 12,
          modulationIndex: 64,
          resonance: 8000,
          octaves: 1,
        }).connect(hihatVolume)
      : new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5,
        }).connect(hihatVolume);
  }
  if (!rim) {
    // A dry, short click — side stick, not a full snare hit.
    rim = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    }).connect(rimVolume);
  }
  if (!hihatOpen) {
    // Same character as the closed hihat above, just left to ring — its own synth
    // instance so an open hit can decay independently of a closed hit right after it.
    hihatOpen = electronic
      ? new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.3, release: 0.2 },
          harmonicity: 12,
          modulationIndex: 64,
          resonance: 8000,
          octaves: 1,
        }).connect(hihatOpenVolume)
      : new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.35, release: 0.25 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5,
        }).connect(hihatOpenVolume);
  }
  if (!hihatFoot) {
    // The pedal "chick" — duller and quieter than a struck hit, no ring at all.
    hihatFoot = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.02, release: 0.01 },
      harmonicity: 1.5,
      modulationIndex: 8,
      resonance: 2000,
      octaves: 1,
    }).connect(hihatFootVolume);
  }
  if (!ride) {
    // Washier and longer than the hihat — lower harmonicity, longer envelope. Lower
    // modulationIndex/octaves than the original tuning (16/2.5) plus a lowpass
    // filter tame MetalSynth's raw harsh/buzzy top end into more of a real ride's
    // shimmer than a piercing clang.
    const rideFilter = new Tone.Filter(6500, 'lowpass');
    // MetalSynth's raw output sits much hotter than the other drum voices even at
    // matching envelope/velocity — this fixed trim corrects that, kept separate
    // from rideVolume (the user-facing fader) so the fader itself still runs from
    // silent to a sensible max instead of silent to overly loud.
    const rideTrim = new Tone.Volume(-10).connect(rideVolume);
    rideFilter.connect(rideTrim);
    ride = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 1.1, release: 0.6 },
      harmonicity: 4.2,
      modulationIndex: 8,
      resonance: 2200,
      octaves: 1.2,
    }).connect(rideFilter);
  }
  if (!rideBell) {
    // Higher harmonicity for a more pitched, "pingy" tone — distinct from the wash.
    rideBell = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.35, release: 0.2 },
      harmonicity: 8,
      modulationIndex: 20,
      resonance: 6000,
      octaves: 1,
    }).connect(rideBellVolume);
  }
  if (!crash) {
    crash = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 1.5, release: 1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 5000,
      octaves: 2,
    }).connect(crashVolume);
  }
  if (!toms) {
    // One pitched membrane voice shared by all three tom lanes (high/mid/low trigger
    // it at different notes) — the same drum type, just tuned differently per hit.
    toms = electronic
      ? new Tone.MembraneSynth({
          pitchDecay: 0.03,
          octaves: 3,
          envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.3 },
        }).connect(tomsVolume)
      : new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 2,
          envelope: { attack: 0.001, decay: 0.25, sustain: 0.01, release: 0.2 },
        }).connect(tomsVolume);
  }

  // Sample playback, layered on top of the synths above: any voice with a matching
  // file for the current instrument gets a Tone.Player instead — see
  // data/drumSamples.ts and CLAUDE.md's sample-drums plan. Built eagerly here
  // (not lazily per-hit) so the buffer has time to load before scheduleDrums'
  // Loop actually reaches that step, same as the synths right above it.
  for (const voice of ALL_DRUM_VOICES) {
    if (players[voice]) continue;
    const url = getSampleUrl(voice, currentInstrument);
    if (!url) continue;
    const trimDb = SAMPLE_TRIM_DB[voice] ?? 0;
    const player = new Tone.Player(url);
    player.connect(trimDb === 0 ? voiceVolume[voice] : new Tone.Volume(trimDb).connect(voiceVolume[voice]));
    players[voice] = player;
  }
}

export function setVolume(db: number): void {
  output.volume.value = db;
}

export function setMuted(muted: boolean): void {
  output.mute = muted;
}

export function setKickVolume(db: number): void {
  kickVolume.volume.value = db;
}

export function setSnareVolume(db: number): void {
  snareVolume.volume.value = db;
}

export function setHihatVolume(db: number): void {
  hihatVolume.volume.value = db;
}

export function setRimVolume(db: number): void {
  rimVolume.volume.value = db;
}

export function setHihatOpenVolume(db: number): void {
  hihatOpenVolume.volume.value = db;
}

export function setHihatFootVolume(db: number): void {
  hihatFootVolume.volume.value = db;
}

export function setRideVolume(db: number): void {
  rideVolume.volume.value = db;
}

export function setRideBellVolume(db: number): void {
  rideBellVolume.volume.value = db;
}

export function setCrashVolume(db: number): void {
  crashVolume.volume.value = db;
}

export function setTomsVolume(db: number): void {
  tomsVolume.volume.value = db;
}

export function setInstrument(name: string): void {
  if (name === currentInstrument) return;
  currentInstrument = name;
  // rim/hihatFoot/ride/rideBell/crash don't vary by instrument (no electronic/
  // acoustic branch above) so they're left alone rather than pointlessly rebuilt.
  kick?.dispose();
  snare?.dispose();
  hihat?.dispose();
  hihatOpen?.dispose();
  toms?.dispose();
  kick = null;
  snare = null;
  hihat = null;
  hihatOpen = null;
  toms = null;
  // Unlike the synths above, *every* voice's sample can vary by instrument (the
  // naming convention covers all 12 lanes, not just the 5 the synths branch on) —
  // so every cached player gets dropped and re-resolved against the new
  // instrument's files next time ensureSynths runs, not just a subset.
  for (const voice of ALL_DRUM_VOICES) {
    players[voice]?.dispose();
    delete players[voice];
  }
}

/**
 * Plays voice's sample at time, if it has one loaded — returns whether it did, so
 * callers fall back to the synth otherwise. Velocity becomes a per-trigger gain
 * offset (Player has no native velocity-sensitive envelope the way the synths'
 * triggerAttackRelease does) via setValueAtTime rather than a plain assignment, so
 * the gain change actually lands at the scheduled audio time instead of whenever
 * this callback happens to run relative to it — the same reason every other
 * Transport-relative value in this app goes through a Tone.Time/scheduled call
 * rather than a direct property set.
 */
function triggerSample(voice: DrumVoice, time: number, velocity: number): boolean {
  const player = players[voice];
  if (!player || !player.loaded) return false;
  player.volume.setValueAtTime(Tone.gainToDb(Math.max(velocity, 0.0001)), time);
  player.start(time);
  return true;
}

// A beat position (possibly fractional, possibly negative — used below for "one
// beat before section start") as a Bars:Beats:Sixteenths string, same convention
// keys.ts's offsetTime uses for its own fractional-beat comping offsets.
function beatTime(beat: number): string {
  const wholeBeat = Math.floor(beat);
  return `0:${wholeBeat}:${(beat - wholeBeat) * 4}`;
}

/** Triggers one voice's sample-or-synth fallback — shared by the main pattern
 * Loop and the section-fill Part below, so a fill hitting any lane sounds
 * exactly like that same lane hit by the regular groove. */
function triggerVoice(note: DrumVoice, time: number, velocity: number): void {
  if (triggerSample(note, time, velocity)) return;
  switch (note) {
    case 'kick':
      kick!.triggerAttackRelease('C1', '8n', time, velocity);
      break;
    case 'snare':
      snare!.triggerAttackRelease('8n', time, velocity);
      break;
    case 'rim':
      rim!.triggerAttackRelease('32n', time, velocity);
      break;
    // MetalSynth is pitched (Monophonic) unlike NoiseSynth, so it needs a frequency
    // first — the exact pitch barely matters, harmonicity/modulationIndex/resonance
    // do the actual metallic shaping; it's just a carrier.
    case 'hihat':
      hihat!.triggerAttackRelease(200, '32n', time, velocity);
      break;
    case 'hihatOpen':
      hihatOpen!.triggerAttackRelease(200, '4n', time, velocity);
      break;
    case 'hihatFoot':
      hihatFoot!.triggerAttackRelease(150, '32n', time, velocity);
      break;
    case 'ride':
      ride!.triggerAttackRelease(300, '2n', time, velocity);
      break;
    case 'rideBell':
      rideBell!.triggerAttackRelease(600, '8n', time, velocity);
      break;
    case 'crash':
      crash!.triggerAttackRelease(250, '1n', time, velocity);
      break;
    case 'tomHigh':
      toms!.triggerAttackRelease('G3', '8n', time, velocity);
      break;
    case 'tomMid':
      toms!.triggerAttackRelease('D3', '8n', time, velocity);
      break;
    case 'tomLow':
      toms!.triggerAttackRelease('A2', '8n', time, velocity);
      break;
  }
}

export function scheduleDrums(pattern: DrumPattern, timeFeel: TimeFeel = 'normal', sections: SectionMarker[] = []): void {
  ensureSynths();
  const totalSteps = pattern.bars * STEPS_PER_BAR;
  let step = 0;
  fillWindows = [];

  // '32t' (32nd-note triplet) = 1/12 of a beat — the same grid patterns are
  // quantized to on import, so both straight 16th-note and 8th-note-triplet
  // (shuffle) hits play back at their actual timing instead of snapping to 16ths.
  // Half/double time feel just scales that same tick duration — a Tone.js time
  // *string* (not a computed seconds value) so it stays in sync if tempo changes
  // mid-playback, same as every other Transport-relative time in this app.
  const tickInterval = timeFeel === 'double' ? '96n' : timeFeel === 'half' ? '24n' : '32t';

  loop = new Tone.Loop((time) => {
    // step must always advance even if a trigger throws (e.g. a malformed pattern
    // re-hits the same voice at the same instant) — otherwise it wedges on this step
    // forever, re-triggering whatever's here on every future tick.
    try {
      // Silences the regular pattern while a section fill (below) is taking over —
      // see fillWindows' own comment for why this has to be computed from the
      // actual scheduled audio time rather than a plain flag.
      const absoluteBeat = Tone.Transport.getTicksAtTime(time) / Tone.Transport.PPQ;
      const inFill = fillWindows.some((w) => absoluteBeat >= w.start && absoluteBeat < w.end);
      if (!inFill) {
        for (const hit of pattern.steps) {
          if (hit.time !== step) continue;
          triggerVoice(hit.note, time, hit.velocity);
        }
      }
    } finally {
      step = (step + 1) % totalSteps;
    }
  }, tickInterval).start(0);

  // Section-start crash: layered on top of the repeating pattern above via its
  // own Part scheduled against absolute song position (same mechanism bass/keys
  // already use per-chord) — the main Loop above has no idea where in the song
  // it is, only its own step counter, so it can't do this on its own.
  if (sections.length > 0) {
    const crashEvents = sections.map((s) => ({ time: `0:${s.startBeat}:0` }));
    sectionCrashPart = new Tone.Part<{ time: string }>((time) => {
      if (!triggerSample('crash', time, 0.9)) crash!.triggerAttackRelease(250, '1n', time, 0.9);
    }, crashEvents).start(0);
  }

  // Fill leading into each section change — a real fill, not just extra hits
  // layered over the groove: the main Loop above actually goes quiet for the
  // fill's own window (via fillWindows), same as a drummer stopping the beat to
  // play a fill and picking it back up after. Picked at random per section from
  // data/drumFills/'s bundled .mid files (drop one in, no code change needed —
  // same convention as data/drumPatterns/). No fallback placeholder if none are
  // bundled (or haven't loaded yet) — that section's fill window is simply
  // skipped, same as any other section once fills exist but happen to run out of
  // room (see the clipped-window comment below).
  const sectionsWithRoom = sections.filter((s) => s.startBeat >= 1);
  if (sectionsWithRoom.length > 0 && bundledFills.length > 0) {
    const fillEvents: { time: string; note: DrumVoice; velocity: number }[] = [];
    for (const section of sectionsWithRoom) {
      const fill = bundledFills[Math.floor(Math.random() * bundledFills.length)];
      // Clipped so a fill longer than the room available before this section
      // (e.g. a full-bar fill landing right after beat 0) can't start before
      // beat 0 itself — whatever doesn't fit is dropped, not shifted earlier.
      const windowLength = Math.min(fill.lengthBeats, section.startBeat);
      const windowStart = section.startBeat - windowLength;
      fillWindows.push({ start: windowStart, end: section.startBeat });
      for (const hit of fill.pattern.steps) {
        const hitBeat = windowStart + hit.time / STEPS_PER_BEAT;
        if (hitBeat >= section.startBeat) continue;
        fillEvents.push({ time: beatTime(hitBeat), note: hit.note, velocity: hit.velocity });
      }
    }
    sectionFillPart = new Tone.Part<{ time: string; note: DrumVoice; velocity: number }>((time, event) => {
      triggerVoice(event.note, time, event.velocity);
    }, fillEvents).start(0);
  }
}

export function disposeDrums(): void {
  loop?.dispose();
  loop = null;
  sectionCrashPart?.dispose();
  sectionCrashPart = null;
  sectionFillPart?.dispose();
  sectionFillPart = null;
  fillWindows = [];
  // See keys.ts's disposeKeys comment — force-release every voice so a long-tailed
  // hit (crash, ride) doesn't keep ringing after stop.
  kick?.triggerRelease();
  snare?.triggerRelease();
  rim?.triggerRelease();
  hihat?.triggerRelease();
  hihatOpen?.triggerRelease();
  hihatFoot?.triggerRelease();
  ride?.triggerRelease();
  rideBell?.triggerRelease();
  crash?.triggerRelease();
  toms?.triggerRelease();
  // Same reasoning as the synths above — a long sample (crash, ride) mid-playback
  // shouldn't keep ringing after stop.
  for (const player of Object.values(players)) {
    if (player?.state === 'started') player.stop();
  }
}
