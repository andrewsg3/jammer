import type { ChordSelection, ScaleName } from './progressions';
import type { DrumPattern } from './instrumentStyles';

export type SongPresetPlacement = {
  selection: ChordSelection;
  startBeat: number;
  lengthBeats: number;
};

// The portable, on-disk shape of a full song: everything needed to reproduce a
// take, independent of the in-memory ChordPlacement (which carries a runtime-only id).
export type SongPreset = {
  version: 1;
  name: string;
  key: string;
  scale: ScaleName;
  tempo: number;
  metronome: boolean;
  loopStart: number;
  loopEnd: number;
  drumStyle: string;
  bassStyle: string;
  keysStyle: string;
  // Only set when drumStyle isn't one of the bundled names (e.g. a MIDI import) —
  // embeds the pattern so the preset stays portable across machines.
  customDrumPattern?: DrumPattern | null;
  // Instrument/timbre variants — optional so presets written before this existed
  // still load fine (App.tsx falls back to the default instrument for each track).
  chordsInstrument?: string;
  bassInstrument?: string;
  drumsInstrument?: string;
  placements: SongPresetPlacement[];
};

function isChordSelection(value: unknown): value is ChordSelection {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.type === 'diatonic' || v.type === 'secondaryDominant') return typeof v.degree === 'number';
  if (v.type === 'borrowed') return typeof v.index === 'number';
  if (v.type === 'chromatic') return typeof v.offset === 'number' && typeof v.quality === 'string';
  return false;
}

function isSongPresetPlacement(value: unknown): value is SongPresetPlacement {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    isChordSelection(v.selection) &&
    typeof v.startBeat === 'number' &&
    typeof v.lengthBeats === 'number'
  );
}

export function isSongPreset(value: unknown): value is SongPreset {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.name === 'string' &&
    typeof v.key === 'string' &&
    (v.scale === 'major' || v.scale === 'minor') &&
    typeof v.tempo === 'number' &&
    typeof v.metronome === 'boolean' &&
    typeof v.loopStart === 'number' &&
    typeof v.loopEnd === 'number' &&
    typeof v.drumStyle === 'string' &&
    typeof v.bassStyle === 'string' &&
    typeof v.keysStyle === 'string' &&
    Array.isArray(v.placements) &&
    v.placements.every(isSongPresetPlacement)
  );
}

// Bundled defaults live as individual .json files in ./songPresets/ — adding a new
// preset is just dropping a new file there, no code change required.
const presetModules = import.meta.glob<{ default: unknown }>('./songPresets/*.json', { eager: true });

export const bundledSongPresets: SongPreset[] = Object.entries(presetModules)
  .map(([path, mod]) => {
    if (!isSongPreset(mod.default)) {
      console.warn(`Skipping invalid song preset file: ${path}`);
      return null;
    }
    return mod.default;
  })
  .filter((preset): preset is SongPreset => preset !== null)
  .sort((a, b) => a.name.localeCompare(b.name));

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'song-preset';
}

/** Triggers a browser download of the preset as a `.json` file — the user's save mechanism. */
export function downloadSongPreset(preset: SongPreset): void {
  const json = JSON.stringify(preset, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(preset.name)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Reads and validates a user-supplied `.json` file as a SongPreset — the user's load mechanism. */
export async function parseSongPresetFile(file: File): Promise<SongPreset> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn\'t valid JSON.');
  }
  if (!isSongPreset(data)) {
    throw new Error('That file isn\'t a recognized song preset.');
  }
  return data;
}
