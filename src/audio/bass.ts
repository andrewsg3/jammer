import * as Tone from 'tone';
import { chordTones, resolveSelection, type ChordPlacement, type Chord, type ScaleName } from '../data/progressions';
import type { BassRule, BassPattern } from '../data/instrumentStyles';
import { REFERENCE_ROOT_MIDI } from '../data/midiBassImport';

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

export function setMuted(muted: boolean): void {
  output.mute = muted;
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

/**
 * Plays the pattern through once, verbatim, spanning every placement — no
 * transposition at all. Only used when the pattern's own length exactly matches
 * the total progression length (see scheduleBass): that's the signal it's a
 * finished bassline someone already composed against the real chords (not an
 * abstract relative lick), so re-deriving pitches from "whichever chord is
 * sounding" would just repitch a take that was already correct.
 */
function wholeProgressionEvents(placements: ChordPlacement[], pattern: BassPattern): BassEvent[] {
  const patternLengthSteps = pattern.bars * 16;
  const spanStart = Math.min(...placements.map((p) => p.startBeat));
  const spanEnd = Math.max(...placements.map((p) => p.startBeat + p.lengthBeats));
  const totalSteps = (spanEnd - spanStart) * 4;

  const events: BassEvent[] = [];
  for (let s = 0; s < totalSteps; s++) {
    const beat = spanStart + Math.floor(s / 4);
    const covered = placements.some((p) => beat >= p.startBeat && beat < p.startBeat + p.lengthBeats);
    if (!covered) continue; // a gap between placements — nothing sounding here

    const localStep = s % patternLengthSteps;
    for (const hit of pattern.steps) {
      if (hit.time !== localStep) continue;
      events.push({
        time: `0:${beat}:${s % 4}`,
        note: Tone.Frequency(REFERENCE_ROOT_MIDI + hit.intervalFromRoot, 'midi').toNote(),
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
  if (pattern) {
    const totalBeats = placements.reduce((sum, p) => sum + p.lengthBeats, 0);
    if (pattern.bars * 4 === totalBeats) {
      events.push(...wholeProgressionEvents(placements, pattern));
    } else {
      for (const placement of placements) {
        const chord = resolveSelection(key, scale, placement.selection);
        events.push(...patternEvents(chord, pattern, placement));
      }
    }
  } else if (rule) {
    for (const placement of placements) {
      const chord = resolveSelection(key, scale, placement.selection);
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
