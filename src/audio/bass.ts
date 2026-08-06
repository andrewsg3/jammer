import * as Tone from 'tone';
import { chordTones, resolveSelection, type ChordPlacement, type Chord, type ScaleName } from '../data/progressions';
import type { BassRule, BassPattern } from '../data/instrumentStyles';

const BASS_OCTAVE = 2;

const output = new Tone.Volume(0).toDestination();

let synth: Tone.MonoSynth | Tone.PluckSynth | null = null;
let currentInstrument = 'Electric';
type BassEvent = { time: string; note: string; duration: string; velocity: number };
let part: Tone.Part<BassEvent> | null = null;

function buildSynth() {
  if (currentInstrument === 'Upright') {
    // Karplus-Strong string synthesis — genuinely plucked/woody, a good fit for
    // upright pizzicato without needing sampled strings.
    return new Tone.PluckSynth({
      attackNoise: 1,
      dampening: 3000,
      resonance: 0.92,
    }).connect(output);
  }
  // Sawtooth through a lowpass filter that closes down after the pluck —
  // brighter attack settling into a warmer sustain, like a plucked bass string.
  return new Tone.MonoSynth({
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
  }).connect(output);
}

function ensureSynth() {
  if (!synth) synth = buildSynth();
}

export function setVolume(db: number): void {
  output.volume.value = db;
}

export function setInstrument(name: string): void {
  if (name === currentInstrument) return;
  currentInstrument = name;
  synth?.dispose();
  synth = null;
}

function noteForBeat(chord: Chord, rule: BassRule, beat: number): string | null {
  const tones = chordTones(chord, BASS_OCTAVE);
  const root = tones[0];
  const fifth = tones[2] ?? root;
  const beatInBar = beat % 4;

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
    case 'walk-updown': {
      // Climbs root -> ...chord tones... -> octave, then back down, running
      // continuously across the chord's full duration rather than resetting each bar.
      const octaveRoot = chordTones(chord, BASS_OCTAVE + 1)[0];
      const up = [...tones, octaveRoot];
      const updown = [...up, ...up.slice(1, -1).reverse()];
      return updown[beat % updown.length];
    }
  }
}

/** Transposes a pattern's steps to a chord, tiling the pattern across the placement's length. */
function patternEvents(chord: Chord, pattern: BassPattern, placement: ChordPlacement): BassEvent[] {
  const rootMidi = Tone.Frequency(chordTones(chord, BASS_OCTAVE)[0]).toMidi();
  const patternLengthSteps = pattern.bars * 16;
  const totalSteps = placement.lengthBeats * 4;

  const events: BassEvent[] = [];
  for (let s = 0; s < totalSteps; s++) {
    const localStep = s % patternLengthSteps;
    for (const hit of pattern.steps) {
      if (hit.time !== localStep) continue;
      const beat = placement.startBeat + Math.floor(s / 4);
      const sixteenths = s % 4;
      events.push({
        time: `0:${beat}:${sixteenths}`,
        note: Tone.Frequency(rootMidi + hit.intervalFromRoot, 'midi').toNote(),
        duration: '8n',
        velocity: hit.velocity,
      });
    }
  }
  return events;
}

export function scheduleBass(
  placements: ChordPlacement[],
  key: string,
  scale: ScaleName,
  rule: BassRule | null,
  pattern?: BassPattern | null,
): void {
  ensureSynth();

  const events: BassEvent[] = [];
  for (const placement of placements) {
    const chord = resolveSelection(key, scale, placement.selection);
    if (pattern) {
      events.push(...patternEvents(chord, pattern, placement));
    } else if (rule) {
      for (let beat = 0; beat < placement.lengthBeats; beat++) {
        const note = noteForBeat(chord, rule, beat);
        if (note) events.push({ time: `0:${placement.startBeat + beat}:0`, note, duration: '4n', velocity: 0.8 });
      }
    }
  }

  part = new Tone.Part<BassEvent>((time, event) => {
    synth!.triggerAttackRelease(event.note, event.duration, time, event.velocity);
  }, events).start(0);
}

export function disposeBass(): void {
  part?.dispose();
  part = null;
}
