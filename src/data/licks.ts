// A short, hand-fingered guitar phrase -- string+fret explicit (not just
// pitch), since a lick is a specific fingering choice, not just a set of
// notes: the same MIDI pitch exists at several fret/string positions, and
// which one is intended is part of what makes a lick playable as written.
// Independent of any song/progression -- see CLAUDE.md's "Practice
// philosophy for jazz guitar improvisation" for how a lick bank keyed by
// harmonic context sits on top of this later; this module is just the note
// shape + the fretboard math, not that bank.
export type LickNote = {
  startBeat: number;
  // 1 = high E (thinnest string, drawn at the top of a tab staff) through
  // 6 = low E (thickest, drawn at the bottom) -- matches VexFlow's own
  // TabNote `str` numbering directly, so no remapping is needed when handing
  // a LickNote to LickTabView.
  string: number;
  fret: number;
  lengthBeats: number;
};

export type Lick = {
  id: string;
  label: string;
  beatsPerBar: number;
  notes: LickNote[];
};

export const GUITAR_STRING_COUNT = 6;
export const MIN_FRET = 0;
export const MAX_FRET = 24;

// Standard tuning, real SOUNDING pitch (not VexFlow's own Tuning class, which
// deliberately encodes guitar's written-an-octave-higher notation convention
// -- its 'standard' tuning reports the high E string as "E/5", one octave
// above where it actually sounds. That's correct for engraving a standard
// notation staff, but wrong here: these MIDI values feed straight into
// audio/engine.ts's auditionNote and audio/melody.ts's synth, which need the
// real sounding pitch, not the written one.) Index = string number (1-6).
const OPEN_STRING_MIDI: Record<number, number> = {
  1: 64, // E4
  2: 59, // B3
  3: 55, // G3
  4: 50, // D3
  5: 45, // A2
  6: 40, // E2
};

export function lickNoteMidi(note: Pick<LickNote, 'string' | 'fret'>): number {
  return OPEN_STRING_MIDI[note.string] + note.fret;
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'lick';
}

/** Triggers a browser download of the lick as a `.json` file -- same
 * mechanism as data/songPresets.ts's downloadSongPreset, this app's one
 * persistence path (no backend/accounts -- see CLAUDE.md's "Explicit
 * non-goals"). Dropping the downloaded file in a future licks/*.json bank
 * folder is the same "drop a file, no code change" convention drum/bass
 * patterns and song presets already use. */
export function downloadLick(lick: Lick): void {
  const json = JSON.stringify(lick, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(lick.label)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Reads and validates a user-supplied `.json` file as a Lick. */
export async function parseLickFile(file: File): Promise<Lick> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!isLick(data)) {
    throw new Error("That file isn't a recognized lick.");
  }
  return data;
}

export function isLick(value: unknown): value is Lick {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    typeof v.beatsPerBar === 'number' &&
    Array.isArray(v.notes) &&
    v.notes.every(
      (n) =>
        n &&
        typeof n === 'object' &&
        typeof (n as LickNote).startBeat === 'number' &&
        typeof (n as LickNote).string === 'number' &&
        typeof (n as LickNote).fret === 'number' &&
        typeof (n as LickNote).lengthBeats === 'number',
    )
  );
}
