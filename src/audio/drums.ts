import * as Tone from 'tone';
import { STEPS_PER_BAR } from '../data/instrumentStyles';
import type { DrumPattern } from '../data/instrumentStyles';

// Shared output so one volume control (the Drums fader) trims every voice together.
// Kick/snare/hihat additionally each have their own node feeding into it, for the
// individual mix exposed via the channel strip's expand popout — the newer voices
// below don't have that per-voice UI yet, so they connect straight to output.
const output = new Tone.Volume(0).toDestination();
const kickVolume = new Tone.Volume(0).connect(output);
const snareVolume = new Tone.Volume(0).connect(output);
const hihatVolume = new Tone.Volume(0).connect(output);

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
let currentInstrument = 'Acoustic';

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
    }).connect(output);
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
        }).connect(output)
      : new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.35, release: 0.25 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5,
        }).connect(output);
  }
  if (!hihatFoot) {
    // The pedal "chick" — duller and quieter than a struck hit, no ring at all.
    hihatFoot = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.02, release: 0.01 },
      harmonicity: 1.5,
      modulationIndex: 8,
      resonance: 2000,
      octaves: 1,
    }).connect(output);
  }
  if (!ride) {
    // Washier and longer than the hihat — lower harmonicity, much longer envelope.
    ride = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 1.2, release: 0.8 },
      harmonicity: 3.1,
      modulationIndex: 16,
      resonance: 3000,
      octaves: 2.5,
    }).connect(output);
  }
  if (!rideBell) {
    // Higher harmonicity for a more pitched, "pingy" tone — distinct from the wash.
    rideBell = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.35, release: 0.2 },
      harmonicity: 8,
      modulationIndex: 20,
      resonance: 6000,
      octaves: 1,
    }).connect(output);
  }
  if (!crash) {
    crash = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 1.5, release: 1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 5000,
      octaves: 2,
    }).connect(output);
  }
  if (!toms) {
    // One pitched membrane voice shared by all three tom lanes (high/mid/low trigger
    // it at different notes) — the same drum type, just tuned differently per hit.
    toms = electronic
      ? new Tone.MembraneSynth({
          pitchDecay: 0.03,
          octaves: 3,
          envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.3 },
        }).connect(output)
      : new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 2,
          envelope: { attack: 0.001, decay: 0.25, sustain: 0.01, release: 0.2 },
        }).connect(output);
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
}

export function scheduleDrums(pattern: DrumPattern): void {
  ensureSynths();
  const totalSteps = pattern.bars * STEPS_PER_BAR;
  let step = 0;

  // '32t' (32nd-note triplet) = 1/12 of a beat — the same grid patterns are
  // quantized to on import, so both straight 16th-note and 8th-note-triplet
  // (shuffle) hits play back at their actual timing instead of snapping to 16ths.
  loop = new Tone.Loop((time) => {
    // step must always advance even if a trigger throws (e.g. a malformed pattern
    // re-hits the same voice at the same instant) — otherwise it wedges on this step
    // forever, re-triggering whatever's here on every future tick.
    try {
      for (const hit of pattern.steps) {
        if (hit.time !== step) continue;
        if (hit.note === 'kick') kick!.triggerAttackRelease('C1', '8n', time, hit.velocity);
        if (hit.note === 'snare') snare!.triggerAttackRelease('8n', time, hit.velocity);
        if (hit.note === 'rim') rim!.triggerAttackRelease('32n', time, hit.velocity);
        // MetalSynth is pitched (Monophonic) unlike NoiseSynth, so it needs a frequency
        // first — the exact pitch barely matters, harmonicity/modulationIndex/resonance
        // do the actual metallic shaping; it's just a carrier.
        if (hit.note === 'hihat') hihat!.triggerAttackRelease(200, '32n', time, hit.velocity);
        if (hit.note === 'hihatOpen') hihatOpen!.triggerAttackRelease(200, '4n', time, hit.velocity);
        if (hit.note === 'hihatFoot') hihatFoot!.triggerAttackRelease(150, '32n', time, hit.velocity);
        if (hit.note === 'ride') ride!.triggerAttackRelease(300, '2n', time, hit.velocity);
        if (hit.note === 'rideBell') rideBell!.triggerAttackRelease(600, '8n', time, hit.velocity);
        if (hit.note === 'crash') crash!.triggerAttackRelease(250, '1n', time, hit.velocity);
        if (hit.note === 'tomHigh') toms!.triggerAttackRelease('G3', '8n', time, hit.velocity);
        if (hit.note === 'tomMid') toms!.triggerAttackRelease('D3', '8n', time, hit.velocity);
        if (hit.note === 'tomLow') toms!.triggerAttackRelease('A2', '8n', time, hit.velocity);
      }
    } finally {
      step = (step + 1) % totalSteps;
    }
  }, '32t').start(0);
}

export function disposeDrums(): void {
  loop?.dispose();
  loop = null;
}
