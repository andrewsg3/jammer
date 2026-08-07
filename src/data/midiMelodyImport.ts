import { parseMidi } from 'midi-file';
import { STEPS_PER_BEAT } from './instrumentStyles';
import type { MelodyNote } from './melody';

/**
 * Parses a MIDI file into a fixed melody line — absolute beat positions (no tiling
 * or transposition, unlike bass import), quantized to the same STEPS_PER_BEAT grid
 * as everything else. Needs real note-on/note-off pairing (not just note-on, like
 * bass import gets away with) since a melody's actual note lengths matter both for
 * playback and — eventually — for anything duration-aware in the staff rendering.
 */
export function parseMidiMelodyBytes(buffer: ArrayBuffer): { name: string | null; notes: MelodyNote[] } {
  const midi = parseMidi(new Uint8Array(buffer));
  const nameEvent = midi.tracks.flat().find((event) => event.type === 'trackName');
  const name = nameEvent && 'text' in nameEvent ? nameEvent.text : null;
  const ppq = midi.header.ticksPerBeat ?? 128;
  const ticksPerStep = ppq / STEPS_PER_BEAT;

  const notes: MelodyNote[] = [];
  for (const track of midi.tracks) {
    let ticks = 0;
    // Tracks active note-ons awaiting their note-off, keyed by pitch. Only one
    // in-flight note per pitch per track is supported — a re-triggered pitch before
    // its previous off just replaces the pending start, which is fine for a
    // monophonic-ish melody line.
    const active = new Map<number, { onTick: number; velocity: number }>();
    for (const event of track) {
      ticks += event.deltaTime;
      if (event.type === 'noteOn' && event.velocity > 0) {
        active.set(event.noteNumber, { onTick: ticks, velocity: event.velocity / 127 });
        continue;
      }
      const isNoteOff = event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0);
      if (!isNoteOff) continue;
      const start = active.get(event.noteNumber);
      if (!start) continue;
      active.delete(event.noteNumber);
      const startStep = Math.round(start.onTick / ticksPerStep);
      const endStep = Math.max(startStep + 1, Math.round(ticks / ticksPerStep));
      notes.push({
        startBeat: startStep / STEPS_PER_BEAT,
        midi: event.noteNumber,
        lengthBeats: (endStep - startStep) / STEPS_PER_BEAT,
        velocity: start.velocity,
      });
    }
  }

  if (notes.length === 0) {
    throw new Error('No notes found in this MIDI file.');
  }

  notes.sort((a, b) => a.startBeat - b.startBeat);
  return { name, notes };
}

export async function parseMidiMelodyFile(file: File): Promise<{ name: string | null; notes: MelodyNote[] }> {
  const buffer = await file.arrayBuffer();
  return parseMidiMelodyBytes(buffer);
}
