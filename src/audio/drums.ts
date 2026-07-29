import * as Tone from 'tone';
import type { DrumPattern } from '../data/instrumentStyles';

let kick: Tone.MembraneSynth | null = null;
let snare: Tone.NoiseSynth | null = null;
let hihat: Tone.MetalSynth | null = null;
let loop: Tone.Loop | null = null;

function ensureSynths() {
  if (!kick) {
    kick = new Tone.MembraneSynth().toDestination();
  }
  if (!snare) {
    snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
    }).toDestination();
  }
  if (!hihat) {
    hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).toDestination();
  }
}

export function scheduleDrums(pattern: DrumPattern): void {
  ensureSynths();
  const totalSteps = pattern.bars * 16;
  let step = 0;

  loop = new Tone.Loop((time) => {
    for (const hit of pattern.steps) {
      if (hit.time !== step) continue;
      if (hit.note === 'kick') kick!.triggerAttackRelease('C1', '8n', time, hit.velocity);
      if (hit.note === 'snare') snare!.triggerAttackRelease('8n', time, hit.velocity);
      if (hit.note === 'hihat') hihat!.triggerAttackRelease('32n', time, hit.velocity);
    }
    step = (step + 1) % totalSteps;
  }, '16n').start(0);
}

export function disposeDrums(): void {
  loop?.dispose();
  loop = null;
}
