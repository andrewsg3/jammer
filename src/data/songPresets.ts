import { CHORD_QUALITIES, SCALE_NAMES } from './progressions';
import type { ChordSelection, ScaleName } from './progressions';
import { TIME_FEELS, type DrumPattern, type TimeFeel } from './instrumentStyles';
import type { MelodyNote } from './melody';
import type { SectionMarker } from './sections';

// Persisted shape — no id, same treatment as melody notes: a runtime-only React
// key, reassigned via crypto.randomUUID() whenever a preset loads.
export type SongPresetSection = Pick<SectionMarker, 'label' | 'startBeat' | 'lengthBeats'>;

export type SongPresetPlacement = {
  selection: ChordSelection;
  // Optional — when omitted, resolved as the running end of the previous placement
  // (starting at 0). Only needed explicitly to leave a gap between chords.
  startBeat?: number;
  lengthBeats: number;
};

// The portable, on-disk shape of a full song: everything needed to reproduce a
// take, independent of the in-memory ChordPlacement (which carries a runtime-only id).
export type SongPreset = {
  version: 1;
  name: string;
  author?: string;
  key: string;
  scale: ScaleName;
  tempo: number;
  metronome: boolean;
  // Both optional — see resolveLoopRange. loopStart defaults to 0, loopEnd to the
  // end of the last resolved placement (loop the whole progression).
  loopStart?: number;
  loopEnd?: number;
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
  // The half/double time-feel each track's Feel picker is set to — a song written
  // to feel like a half-time ballad or a double-time shuffle should reopen that
  // way, not silently reset to normal. Optional so presets written before this
  // existed still load fine (falls back to 'normal', same as today's fixed default).
  drumsTimeFeel?: TimeFeel;
  bassTimeFeel?: TimeFeel;
  keysTimeFeel?: TimeFeel;
  // Optional so presets written before this existed still load fine (App.tsx falls
  // back to an empty melody, same as a song with nothing imported).
  melody?: MelodyNote[];
  // Optional, same reasoning as melody — presets written before section markers
  // existed just load with none.
  sections?: SongPresetSection[];
  placements: SongPresetPlacement[];
};

function isChordSelection(value: unknown): value is ChordSelection {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.type === 'diatonic' || v.type === 'diatonicSeventh' || v.type === 'secondaryDominant') {
    return typeof v.degree === 'number';
  }
  if (v.type === 'borrowed') return typeof v.index === 'number';
  // Checked against the actual known qualities, not just "is a string" — an
  // unsupported/typo'd quality (e.g. a chord this app's ChordQuality union
  // doesn't have yet) used to sail through validation here and only surface as a
  // cryptic crash deep in the audio engine the moment that chord's bar played.
  if (v.type === 'chromatic') {
    return (
      typeof v.offset === 'number' &&
      typeof v.quality === 'string' &&
      CHORD_QUALITIES.includes(v.quality as (typeof CHORD_QUALITIES)[number]) &&
      (v.bassOffset === undefined || typeof v.bassOffset === 'number')
    );
  }
  return false;
}

function isSongPresetPlacement(value: unknown): value is SongPresetPlacement {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    isChordSelection(v.selection) &&
    (v.startBeat === undefined || typeof v.startBeat === 'number') &&
    typeof v.lengthBeats === 'number'
  );
}

function isMelodyNote(value: unknown): value is MelodyNote {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.startBeat === 'number' &&
    typeof v.midi === 'number' &&
    typeof v.lengthBeats === 'number' &&
    typeof v.velocity === 'number'
  );
}

function isSongPresetSection(value: unknown): value is SongPresetSection {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.label === 'string' && typeof v.startBeat === 'number' && typeof v.lengthBeats === 'number';
}

/**
 * Fills in each placement's startBeat when omitted, as the running end of the
 * previous placement (starting at 0) — the common case, where chords are simply
 * back-to-back. An explicit startBeat is only needed to express a gap.
 */
export function resolvePlacementStarts(
  placements: SongPresetPlacement[],
): { selection: ChordSelection; startBeat: number; lengthBeats: number }[] {
  let cursor = 0;
  return placements.map((p) => {
    const startBeat = p.startBeat ?? cursor;
    cursor = startBeat + p.lengthBeats;
    return { selection: p.selection, startBeat, lengthBeats: p.lengthBeats };
  });
}

/**
 * Fills in loopStart/loopEnd when omitted — loopStart defaults to 0, loopEnd to the
 * end of the last resolved placement, i.e. loop the whole progression once through.
 * An explicit loopEnd is only needed to loop a subset of the chords, or to loop past
 * the end of the progression (trailing silence).
 */
export function resolveLoopRange(
  preset: Pick<SongPreset, 'loopStart' | 'loopEnd'>,
  resolvedPlacements: { startBeat: number; lengthBeats: number }[],
): { loopStart: number; loopEnd: number } {
  const progressionEnd = resolvedPlacements.reduce(
    (max, p) => Math.max(max, p.startBeat + p.lengthBeats),
    0,
  );
  return {
    loopStart: preset.loopStart ?? 0,
    loopEnd: preset.loopEnd ?? progressionEnd,
  };
}

export function isSongPreset(value: unknown): value is SongPreset {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.name === 'string' &&
    typeof v.key === 'string' &&
    SCALE_NAMES.includes(v.scale as ScaleName) &&
    typeof v.tempo === 'number' &&
    typeof v.metronome === 'boolean' &&
    (v.loopStart === undefined || typeof v.loopStart === 'number') &&
    (v.loopEnd === undefined || typeof v.loopEnd === 'number') &&
    typeof v.drumStyle === 'string' &&
    typeof v.bassStyle === 'string' &&
    typeof v.keysStyle === 'string' &&
    (v.drumsTimeFeel === undefined || TIME_FEELS.includes(v.drumsTimeFeel as TimeFeel)) &&
    (v.bassTimeFeel === undefined || TIME_FEELS.includes(v.bassTimeFeel as TimeFeel)) &&
    (v.keysTimeFeel === undefined || TIME_FEELS.includes(v.keysTimeFeel as TimeFeel)) &&
    (v.melody === undefined || (Array.isArray(v.melody) && v.melody.every(isMelodyNote))) &&
    (v.sections === undefined || (Array.isArray(v.sections) && v.sections.every(isSongPresetSection))) &&
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
