import * as Tone from 'tone';
import { chordTones, resolveSelection, type ChordPlacement, type Chord, type ScaleName } from '../data/progressions';
import type { BassRule } from '../data/instrumentStyles';

const BASS_OCTAVE = 2;

let synth: Tone.MonoSynth | null = null;
let part: Tone.Part<{ time: string; note: string }> | null = null;

function ensureSynth() {
  if (!synth) {
    // Sawtooth through a lowpass filter that closes down after the pluck —
    // brighter attack settling into a warmer sustain, like a plucked bass string.
    synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3 },
      filter: { type: 'lowpass', rolloff: -24, Q: 1 },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.2,
        sustain: 0.3,
        release: 0.3,
        baseFrequency: 100,
        octaves: 3,
      },
    }).toDestination();
  }
}

function noteForBeat(chord: Chord, rule: BassRule, beatInBar: number): string | null {
  const tones = chordTones(chord, BASS_OCTAVE);
  const root = tones[0];
  const fifth = tones[2] ?? root;

  switch (rule.style) {
    case 'root-fifth':
      if (beatInBar === 0) return root;
      if (beatInBar === 2) return fifth;
      return null;
    case 'walking':
      return tones[beatInBar % tones.length];
    case 'syncopated':
      return beatInBar === 0 || beatInBar === 2 ? root : null;
    case 'octaves': {
      const rootHigh = chordTones(chord, BASS_OCTAVE + 1)[0];
      return beatInBar % 2 === 0 ? root : rootHigh;
    }
    case 'pedal':
      return root;
  }
}

export function scheduleBass(
  placements: ChordPlacement[],
  key: string,
  scale: ScaleName,
  rule: BassRule,
): void {
  ensureSynth();

  const events: { time: string; note: string }[] = [];
  for (const placement of placements) {
    const chord = resolveSelection(key, scale, placement.selection);
    for (let beat = 0; beat < placement.lengthBeats; beat++) {
      const note = noteForBeat(chord, rule, beat % 4);
      if (note) events.push({ time: `0:${placement.startBeat + beat}:0`, note });
    }
  }

  part = new Tone.Part<{ time: string; note: string }>((time, event) => {
    synth!.triggerAttackRelease(event.note, '4n', time, 0.8);
  }, events).start(0);
}

export function disposeBass(): void {
  part?.dispose();
  part = null;
}
