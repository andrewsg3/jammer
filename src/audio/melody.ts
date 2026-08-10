import * as Tone from 'tone';
import type { MelodyNote } from '../data/melody';
import { PIANO_SAMPLE_URLS } from '../data/pianoSamples';

// A fixed, imported line, not chord-derived — much simpler than bass/keys, no
// per-chord regeneration needed, just schedule the notes verbatim.
function beatToTime(beat: number): string {
  const wholeBeat = Math.floor(beat);
  return `0:${wholeBeat}:${(beat - wholeBeat) * 4}`;
}

const output = new Tone.Volume(0).toDestination();

type MelodyEvent = MelodyNote & { time: string };

let synth: Tone.Sampler | null = null;
let part: Tone.Part<MelodyEvent> | null = null;

function ensureSynth() {
  if (!synth) {
    synth = new Tone.Sampler({ urls: PIANO_SAMPLE_URLS, release: 1 }).connect(output);
  }
}

export function setVolume(db: number): void {
  output.volume.value = db;
}

export function setMuted(muted: boolean): void {
  output.mute = muted;
}

export function scheduleMelody(notes: MelodyNote[]): void {
  ensureSynth();
  const events: MelodyEvent[] = notes.map((note) => ({ ...note, time: beatToTime(note.startBeat) }));

  part = new Tone.Part<MelodyEvent>((time, event) => {
    // Recomputed from the current tempo at trigger time rather than baked in up
    // front, same reasoning as everywhere else in this app that turns a beat count
    // into real time — stays correct if tempo changes mid-playback.
    const durationSeconds = Tone.Time('4n').toSeconds() * event.lengthBeats;
    synth!.triggerAttackRelease(
      Tone.Frequency(event.midi, 'midi').toFrequency(),
      durationSeconds,
      time,
      event.velocity,
    );
  }, events).start(0);
}

export function disposeMelody(): void {
  part?.dispose();
  part = null;
  // See disposeBass's comment — Sampler's triggerRelease needs to know which
  // note(s) to release; releaseAll sidesteps tracking that for a monophonic line.
  synth?.releaseAll();
}
