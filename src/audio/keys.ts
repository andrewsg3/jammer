import * as Tone from 'tone';
import { chordTones, resolveSelection, type ChordPlacement, type Chord, type ScaleName } from '../data/progressions';
import type { KeysRule } from '../data/instrumentStyles';

const KEYS_OCTAVE = 3;

const output = new Tone.Volume(0).toDestination();

let synth: Tone.PolySynth<Tone.FMSynth> | null = null;
let part: Tone.Part<{ time: string; notes: string[]; lengthBeats: number; rhythm: KeysRule['rhythm'] }> | null =
  null;

function ensureSynth() {
  if (!synth) {
    // FM synthesis gets closer to an electric-piano character than a plain
    // oscillator — real piano samples are out of scope (see CLAUDE.md).
    synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      modulation: { type: 'square' },
      envelope: { attack: 0.005, decay: 1.2, sustain: 0.2, release: 1.2 },
      modulationEnvelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.5 },
    }).connect(output);
  }
}

export function setVolume(db: number): void {
  output.volume.value = db;
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
): void {
  ensureSynth();

  const events = placements.map((placement) => ({
    time: `0:${placement.startBeat}:0`,
    notes: voicingNotes(resolveSelection(key, scale, placement.selection), rule.voicing),
    lengthBeats: placement.lengthBeats,
    rhythm: rule.rhythm,
  }));

  part = new Tone.Part<{
    time: string;
    notes: string[];
    lengthBeats: number;
    rhythm: KeysRule['rhythm'];
  }>((time, event) => {
    if (event.rhythm === 'sustained') {
      synth!.triggerAttackRelease(event.notes, `0:${event.lengthBeats}:0`, time, 0.5);
    } else if (event.rhythm === 'la-pompe') {
      // Gypsy-jazz rhythm-guitar chunk: a short, percussive stab on every beat,
      // driven harder on 2 and 4 like the downstroke accent of "la pompe."
      for (let beat = 0; beat < event.lengthBeats; beat++) {
        const accent = beat % 4 === 1 || beat % 4 === 3;
        synth!.triggerAttackRelease(
          event.notes,
          '16n',
          time + Tone.Time(`0:${beat}:0`).toSeconds(),
          accent ? 0.75 : 0.45,
        );
      }
    } else {
      for (let beat = 0; beat < event.lengthBeats; beat += 2) {
        synth!.triggerAttackRelease(event.notes, '4n', time + Tone.Time(`0:${beat}:0`).toSeconds(), 0.6);
      }
    }
  }, events).start(0);
}

export function disposeKeys(): void {
  part?.dispose();
  part = null;
}
