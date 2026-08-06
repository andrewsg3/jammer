import * as Tone from 'tone';
import type { DrumPattern } from '../data/instrumentStyles';

// Shared output so one volume control (the Drums fader) trims all three voices
// together; each voice also has its own node feeding into it for individual mix.
const output = new Tone.Volume(0).toDestination();
const kickVolume = new Tone.Volume(0).connect(output);
const snareVolume = new Tone.Volume(0).connect(output);
const hihatVolume = new Tone.Volume(0).connect(output);

let kick: Tone.MembraneSynth | null = null;
let snare: Tone.NoiseSynth | null = null;
let hihat: Tone.MetalSynth | null = null;
let loop: Tone.Loop | null = null;
let currentInstrument = 'Acoustic';

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
  kick?.dispose();
  snare?.dispose();
  hihat?.dispose();
  kick = null;
  snare = null;
  hihat = null;
}

export function scheduleDrums(pattern: DrumPattern): void {
  ensureSynths();
  const totalSteps = pattern.bars * 16;
  let step = 0;

  loop = new Tone.Loop((time) => {
    // step must always advance even if a trigger throws (e.g. a malformed pattern
    // re-hits the same voice at the same instant) — otherwise it wedges on this step
    // forever, re-triggering whatever's here on every future tick.
    try {
      for (const hit of pattern.steps) {
        if (hit.time !== step) continue;
        if (hit.note === 'kick') kick!.triggerAttackRelease('C1', '8n', time, hit.velocity);
        if (hit.note === 'snare') snare!.triggerAttackRelease('8n', time, hit.velocity);
        // MetalSynth is pitched (Monophonic) unlike NoiseSynth, so it needs a frequency
        // first — 200Hz is just a carrier; harmonicity/modulationIndex/resonance do the
        // actual metallic shaping, so the exact pitch barely matters.
        if (hit.note === 'hihat') hihat!.triggerAttackRelease(200, '32n', time, hit.velocity);
      }
    } finally {
      step = (step + 1) % totalSteps;
    }
  }, '16n').start(0);
}

export function disposeDrums(): void {
  loop?.dispose();
  loop = null;
}
