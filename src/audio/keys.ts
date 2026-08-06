import * as Tone from 'tone';
import { chordTones, resolveSelection, type ChordPlacement, type Chord, type ScaleName } from '../data/progressions';
import { timeFeelFactor } from '../data/instrumentStyles';
import type { KeysRule, TimeFeel } from '../data/instrumentStyles';

// A relative beat offset (e.g. 1.5 beats after this placement's start) as a
// Bars:Beats:Sixteenths string — fractional sixteenths are fine, Tone parses them.
function offsetTime(beatOffset: number): string {
  const wholeBeat = Math.floor(beatOffset);
  return `0:${wholeBeat}:${(beatOffset - wholeBeat) * 4}`;
}

const KEYS_OCTAVE = 3;

const output = new Tone.Volume(0).toDestination();

let synth: Tone.PolySynth<Tone.FMSynth> | Tone.PolySynth<Tone.Synth> | null = null;
let currentInstrument = 'Electric Piano';
type KeysEvent = {
  time: string;
  notes: string[];
  powerFive: string[];
  powerSix: string[];
  lengthBeats: number;
  rhythm: KeysRule['rhythm'];
};
let part: Tone.Part<KeysEvent> | null = null;

function buildSynth() {
  if (currentInstrument === 'Guitar') {
    // A plain oscillator with a fast decay/low sustain approximates a picked/strummed
    // guitar chord well enough without physical modeling — real samples are out of
    // scope (see CLAUDE.md).
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
      envelope: { attack: 0.005, decay: 0.5, sustain: 0.15, release: 0.8 },
    }).connect(output);
  }
  // FM synthesis gets closer to an electric-piano character than a plain oscillator.
  return new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3,
    modulationIndex: 2,
    oscillator: { type: 'sine' },
    modulation: { type: 'square' },
    envelope: { attack: 0.005, decay: 1.2, sustain: 0.2, release: 1.2 },
    modulationEnvelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.5 },
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

function voicingNotes(chord: Chord, voicing: KeysRule['voicing']): string[] {
  const tones = chordTones(chord, KEYS_OCTAVE);
  switch (voicing) {
    case 'power-chord':
      return [tones[0], tones[2] ?? tones[0]];
    case 'triad':
      return tones.slice(0, 3);
    case 'seventh':
      return tones;
  }
}

export function scheduleKeys(
  placements: ChordPlacement[],
  key: string,
  scale: ScaleName,
  rule: KeysRule,
  timeFeel: TimeFeel = 'normal',
): void {
  ensureSynth();
  const factor = timeFeelFactor(timeFeel);

  const events = placements.map((placement) => {
    const chord = resolveSelection(key, scale, placement.selection);
    const root = chordTones(chord, KEYS_OCTAVE)[0];
    const rootMidi = Tone.Frequency(root).toMidi();
    return {
      time: `0:${placement.startBeat}:0`,
      notes: voicingNotes(chord, rule.voicing),
      // Only used by blues-shuffle(-swing) — root+5th and root+6th, computed
      // straight from the root rather than the chord's own tones (see KeysRule).
      powerFive: [root, Tone.Frequency(rootMidi + 7, 'midi').toNote()],
      powerSix: [root, Tone.Frequency(rootMidi + 9, 'midi').toNote()],
      lengthBeats: placement.lengthBeats,
      rhythm: rule.rhythm,
    };
  });

  part = new Tone.Part<KeysEvent>((time, event) => {
    if (event.rhythm === 'sustained') {
      // A held chord doesn't have a strike rate for time-feel to change.
      synth!.triggerAttackRelease(event.notes, `0:${event.lengthBeats}:0`, time, 0.5);
    } else if (event.rhythm === 'la-pompe') {
      // Gypsy-jazz rhythm-guitar chunk: a short, percussive stab on every beat,
      // driven harder on 2 and 4 like the downstroke accent of "la pompe." Iterates
      // over a virtual (scaled) length so beat%4's accent lines up on clean integers,
      // then rescales the real offset back into the placement's real-time span.
      const virtualLength = Math.max(1, Math.round(event.lengthBeats * factor));
      for (let beat = 0; beat < virtualLength; beat++) {
        const accent = beat % 4 === 1 || beat % 4 === 3;
        synth!.triggerAttackRelease(
          event.notes,
          '16n',
          time + Tone.Time(offsetTime(beat / factor)).toSeconds(),
          accent ? 0.75 : 0.45,
        );
      }
    } else if (event.rhythm === 'arpeggio-up' || event.rhythm === 'arpeggio-updown') {
      // 'up' just cycles the voicing tones; 'updown' bounces back down before
      // repeating (root-3rd-5th-7th-5th-3rd-...), a classic broken-chord roll.
      const pattern =
        event.rhythm === 'arpeggio-updown'
          ? [...event.notes, ...event.notes.slice(1, -1).reverse()]
          : event.notes;
      const stepSixteenths = 2; // 8th-note steps, in virtual (pre-time-feel) space
      const virtualTotalSixteenths = Math.max(stepSixteenths, Math.round(event.lengthBeats * 4 * factor));
      for (let s = 0; s < virtualTotalSixteenths; s += stepSixteenths) {
        const note = pattern[(s / stepSixteenths) % pattern.length];
        synth!.triggerAttackRelease(note, '8n', time + Tone.Time(offsetTime(s / 4 / factor)).toSeconds(), 0.5);
      }
    } else if (event.rhythm === 'blues-shuffle' || event.rhythm === 'blues-shuffle-swing') {
      // Classic boogie/blues rhythm-guitar figure, continuous 8th notes over a 4-beat
      // (1-bar) cycle: power chord on 1 & 1+, root-and-6th on 2 & 2+, power chord on
      // 3 & 3+, root-and-6th on 4 & 4+ — the shape alternates every full beat, not
      // every 8th note. Swing delays each "+" from the exact midpoint (0.5) to 2/3 of
      // the way through the beat, the same long-short ratio as an 8th-note triplet.
      const offbeat = event.rhythm === 'blues-shuffle-swing' ? 2 / 3 : 0.5;
      const virtualLength = Math.max(1, Math.round(event.lengthBeats * factor));
      const pushShuffleHit = (beatOffset: number, notes: string[]) => {
        if (beatOffset >= virtualLength) return;
        synth!.triggerAttackRelease(notes, '8n', time + Tone.Time(offsetTime(beatOffset / factor)).toSeconds(), 0.7);
      };
      for (let cellStart = 0; cellStart < virtualLength; cellStart += 4) {
        for (let beatInCell = 0; beatInCell < 4; beatInCell++) {
          const notes = beatInCell % 2 === 0 ? event.powerFive : event.powerSix;
          pushShuffleHit(cellStart + beatInCell, notes);
          pushShuffleHit(cellStart + beatInCell + offbeat, notes);
        }
      }
    } else {
      const virtualLength = Math.max(2, Math.round(event.lengthBeats * factor));
      for (let beat = 0; beat < virtualLength; beat += 2) {
        synth!.triggerAttackRelease(
          event.notes,
          '4n',
          time + Tone.Time(offsetTime(beat / factor)).toSeconds(),
          0.6,
        );
      }
    }
  }, events).start(0);
}

export function disposeKeys(): void {
  part?.dispose();
  part = null;
  // triggerAttackRelease bakes an absolute release time into the Web Audio graph at
  // call time — stopping Transport or disposing the Part doesn't retroactively cancel
  // an already-scheduled long sustain, so an in-flight chord keeps ringing after stop
  // unless every active voice is force-released here too.
  synth?.releaseAll();
}
