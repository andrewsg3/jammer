import * as Tone from 'tone';
import { chordTones, resolveSelection, type ChordPlacement, type Chord, type ScaleName } from '../data/progressions';
import { STEPS_PER_BEAT, timeFeelFactor } from '../data/instrumentStyles';
import type { BassRule, BassPattern, TimeFeel } from '../data/instrumentStyles';
import { REFERENCE_ROOT_MIDI } from '../data/midiBassImport';

// Tone.js's Bars:Beats:Sixteenths time strings accept a fractional sixteenths
// component, so a STEPS_PER_BEAT (12-per-beat) step converts to sixteenths just by
// scaling — this is what lets an imported 8th-note-triplet hit (step 4, 8) land at
// its true triplet position (1.33, 2.67) instead of snapping to a straight 16th.
function stepToSixteenths(stepInBeat: number): number {
  return (stepInBeat * 4) / STEPS_PER_BEAT;
}

// This app never uses the "bars" component of a Bars:Beats:Sixteenths string — every
// event time is `0:<beat>:<sixteenths>`, with the full absolute beat count stuffed
// into the "beats" slot. That makes these two trivial, and is what withTimeFeel below
// relies on to shift/rescale already-built event times without re-deriving them.
function parseBeat(time: string): number {
  const [, beats, sixteenths] = time.split(':').map(Number);
  return beats + (sixteenths || 0) / 4;
}

function beatToTime(beat: number): string {
  const wholeBeat = Math.floor(beat);
  return `0:${wholeBeat}:${(beat - wholeBeat) * 4}`;
}

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
    case 'tumbao':
      // Handled by tumbaoEvents (needs sixteenth-note placement and next-chord
      // lookahead, which this per-beat/single-chord function can't express).
      return null;
  }
}

/**
 * Afro-Cuban tumbao: root on beat 1, a pickup (the 3rd) on the "and" of 2, and the
 * 5th on beat 4 — except on the bar right before the chord changes, where the 5th is
 * replaced by an anticipation of the *next* chord's root on the "and" of 4. That
 * early, syncopated arrival across the barline is tumbao's signature move, so it
 * needs the next chord as lookahead (unlike every other rule-based style here, which
 * only ever looks at the current one).
 */
function tumbaoEvents(chord: Chord, nextChord: Chord | null, placement: ChordPlacement): BassEvent[] {
  const tones = chordTones(chord, BASS_OCTAVE);
  const root = tones[0];
  const third = tones[1] ?? root;
  const fifth = tones[2] ?? root;
  const nextRoot = nextChord ? chordTones(nextChord, BASS_OCTAVE)[0] : root;

  const totalSixteenths = placement.lengthBeats * 4;
  const events: BassEvent[] = [];

  const push = (offset: number, note: string, duration: string, velocity: number) => {
    if (offset >= totalSixteenths) return;
    const beat = placement.startBeat + Math.floor(offset / 4);
    const sixteenths = offset % 4;
    events.push({ time: `0:${beat}:${sixteenths}`, note, duration, velocity });
  };

  for (let barStart = 0; barStart < totalSixteenths; barStart += 16) {
    const isLastBarOfPlacement = barStart + 16 >= totalSixteenths;

    push(barStart, root, '4n', 0.85); // beat 1: root
    push(barStart + 6, third, '8n', 0.65); // "and" of 2: pickup

    if (isLastBarOfPlacement && nextChord) {
      push(barStart + 14, nextRoot, '8n', 0.9); // "and" of 4: anticipate the next chord
    } else {
      push(barStart + 12, fifth, '4n', 0.75); // beat 4: fifth
    }
  }
  return events;
}

/** Transposes a pattern's steps to a chord, tiling the pattern across the placement's length. */
function patternEvents(chord: Chord, pattern: BassPattern, placement: ChordPlacement): BassEvent[] {
  const rootMidi = Tone.Frequency(chordTones(chord, BASS_OCTAVE)[0]).toMidi();
  const patternLengthSteps = pattern.bars * STEPS_PER_BEAT * 4;
  const totalSteps = placement.lengthBeats * STEPS_PER_BEAT;

  const events: BassEvent[] = [];
  for (let s = 0; s < totalSteps; s++) {
    const localStep = s % patternLengthSteps;
    for (const hit of pattern.steps) {
      if (hit.time !== localStep) continue;
      const beat = placement.startBeat + Math.floor(s / STEPS_PER_BEAT);
      const sixteenths = stepToSixteenths(s % STEPS_PER_BEAT);
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
  const patternLengthSteps = pattern.bars * STEPS_PER_BEAT * 4;
  const spanStart = Math.min(...placements.map((p) => p.startBeat));
  const spanEnd = Math.max(...placements.map((p) => p.startBeat + p.lengthBeats));
  const totalSteps = (spanEnd - spanStart) * STEPS_PER_BEAT;

  const events: BassEvent[] = [];
  for (let s = 0; s < totalSteps; s++) {
    const beat = spanStart + Math.floor(s / STEPS_PER_BEAT);
    const covered = placements.some((p) => beat >= p.startBeat && beat < p.startBeat + p.lengthBeats);
    if (!covered) continue; // a gap between placements — nothing sounding here

    const localStep = s % patternLengthSteps;
    for (const hit of pattern.steps) {
      if (hit.time !== localStep) continue;
      events.push({
        time: `0:${beat}:${stepToSixteenths(s % STEPS_PER_BEAT)}`,
        note: Tone.Frequency(REFERENCE_ROOT_MIDI + hit.intervalFromRoot, 'midi').toNote(),
        duration: '8n',
        velocity: hit.velocity,
      });
    }
  }
  return events;
}

/**
 * Applies half/double time by generating against a *virtual* placement — same start,
 * length scaled by `factor` — then rescaling each resulting event's absolute beat
 * back down into the real placement's actual (unchanged) span. Generating against a
 * scaled-but-still-integer-beat virtual placement (rather than feeding fractional
 * beats straight into a generator) keeps every existing rule's `beat % 4` bar-relative
 * logic working correctly — they never need to know time-feel exists at all.
 */
function withTimeFeel(
  placement: ChordPlacement,
  factor: number,
  generate: (virtualPlacement: ChordPlacement) => BassEvent[],
): BassEvent[] {
  if (factor === 1) return generate(placement);
  const virtualPlacement: ChordPlacement = {
    ...placement,
    startBeat: 0,
    lengthBeats: Math.max(1, Math.round(placement.lengthBeats * factor)),
  };
  return generate(virtualPlacement).map((event) => ({
    ...event,
    time: beatToTime(placement.startBeat + parseBeat(event.time) / factor),
  }));
}

export function scheduleBass(
  placements: ChordPlacement[],
  key: string,
  scale: ScaleName,
  rule: BassRule | null,
  pattern: BassPattern | null,
  timeFeel: TimeFeel = 'normal',
): void {
  ensureSynth();
  const factor = timeFeelFactor(timeFeel);

  const events: BassEvent[] = [];
  if (pattern) {
    const totalBeats = placements.reduce((sum, p) => sum + p.lengthBeats, 0);
    if (pattern.bars * 4 === totalBeats) {
      // A finished, already-composed bassline played back verbatim — time-feel
      // doesn't apply, same reason transposition doesn't either (see the doc comment
      // on wholeProgressionEvents).
      events.push(...wholeProgressionEvents(placements, pattern));
    } else {
      for (const placement of placements) {
        const chord = resolveSelection(key, scale, placement.selection);
        events.push(...withTimeFeel(placement, factor, (vp) => patternEvents(chord, pattern, vp)));
      }
    }
  } else if (rule) {
    for (const placement of placements) {
      const chord = resolveSelection(key, scale, placement.selection);
      if (rule.style === 'tumbao') {
        const next = placements.find((p) => p.startBeat === placement.startBeat + placement.lengthBeats);
        const nextChord = next ? resolveSelection(key, scale, next.selection) : null;
        events.push(...withTimeFeel(placement, factor, (vp) => tumbaoEvents(chord, nextChord, vp)));
        continue;
      }
      events.push(
        ...withTimeFeel(placement, factor, (vp) => {
          const beatEvents: BassEvent[] = [];
          for (let beat = 0; beat < vp.lengthBeats; beat++) {
            const note = noteForBeat(chord, rule, beat);
            if (note) beatEvents.push({ time: `0:${vp.startBeat + beat}:0`, note, duration: '4n', velocity: 0.8 });
          }
          return beatEvents;
        }),
      );
    }
  }

  part = new Tone.Part<BassEvent>((time, event) => {
    synth!.triggerAttackRelease(event.note, event.duration, time, event.velocity);
  }, events).start(0);
}

export function disposeBass(): void {
  part?.dispose();
  part = null;
  // See disposeKeys's comment — an already-scheduled note's release time is baked
  // into the Web Audio graph at trigger time, so force-release the active voice too.
  synth?.triggerRelease();
}
