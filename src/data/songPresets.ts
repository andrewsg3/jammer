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

// A named, self-contained section: its own chord progression, no start/length
// stored on it at all -- both are derivable (length from its own chords, start
// from its position in the play order). Paired with `arrangement` on SongPreset
// below, this is the alternative to typing a repeated section (e.g. Autumn
// Leaves' AABC form, where the two "A" sections are identical) out twice. See
// CLAUDE.md's "sections + arrangement in song presets" for the full design.
export type SongPresetSectionDef = {
  label: string;
  placements: SongPresetPlacement[];
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
  // existed just load with none. Used as-is only in the flat shape below; when
  // sectionDefs+arrangement are present, section markers are derived instead (see
  // resolveArrangement) and this field is ignored.
  sections?: SongPresetSection[];
  // Two mutually-exclusive on-disk shapes, both always accepted (see isSongPreset):
  // flat `placements` (every preset written before this existed, and still the
  // simpler choice for a song with no repeated sections), or `sectionDefs` +
  // `arrangement` (a named section played back in the order `arrangement` lists,
  // repeats allowed, so a repeated section is only ever typed out once). `placements`
  // is optional rather than required so a preset can carry the arrangement shape
  // alone -- handleSaveSongPreset picks whichever shape actually saves something
  // (falls back to flat when there's nothing to gain from sections+arrangement, e.g.
  // no section markers at all).
  sectionDefs?: SongPresetSectionDef[];
  arrangement?: string[];
  placements?: SongPresetPlacement[];
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

function isSongPresetSectionDef(value: unknown): value is SongPresetSectionDef {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.label === 'string' && Array.isArray(v.placements) && v.placements.every(isSongPresetPlacement);
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
 * Expands a preset's named sectionDefs + arrangement into the flat placements +
 * derived SectionMarker-shaped sections everything downstream (App.tsx, ChordGrid,
 * the audio engine) already consumes -- the same shape resolvePlacementStarts
 * produces today, just built by walking the arrangement (with repeats) instead of a
 * single flat placements array. An arrangement entry with no matching sectionDef is
 * skipped (logged, not thrown) -- same "invalid data doesn't crash playback" stance
 * isSongPreset takes elsewhere.
 */
export function resolveArrangement(
  sectionDefs: SongPresetSectionDef[],
  arrangement: string[],
): {
  placements: { selection: ChordSelection; startBeat: number; lengthBeats: number }[];
  sections: SongPresetSection[];
} {
  const byLabel = new Map(sectionDefs.map((s) => [s.label, s]));
  const placements: { selection: ChordSelection; startBeat: number; lengthBeats: number }[] = [];
  const sections: SongPresetSection[] = [];
  let cursor = 0;

  for (const label of arrangement) {
    const def = byLabel.get(label);
    if (!def) {
      console.warn(`Arrangement references unknown section "${label}" -- skipping.`);
      continue;
    }
    const resolved = resolvePlacementStarts(def.placements);
    const sectionLength = resolved.reduce((max, p) => Math.max(max, p.startBeat + p.lengthBeats), 0);
    for (const p of resolved) {
      placements.push({ selection: p.selection, startBeat: cursor + p.startBeat, lengthBeats: p.lengthBeats });
    }
    sections.push({ label, startBeat: cursor, lengthBeats: sectionLength });
    cursor += sectionLength;
  }

  return { placements, sections };
}

/**
 * The reverse of resolveArrangement, for saving: slices flat placements by each
 * section marker's range, rebases each slice to a section-relative startBeat, and
 * dedupes identical {label, placements} containers so a preset that already has
 * repeated sections (e.g. two identical "A" sections) doesn't re-duplicate them on
 * save -- this is what actually delivers "don't retype A twice." Two sections that
 * share a label but have *different* chords get disambiguated ("A (2)") rather than
 * silently merged or overwritten.
 *
 * Only returns the arrangement shape when it can represent the placements losslessly
 * -- the sections must tile the whole progression contiguously (no gaps/overlaps)
 * and every placement must fit entirely within exactly one section. Anything else
 * (a placement outside any section, a gap, overlapping markers) returns null so the
 * caller falls back to saving the flat shape instead of risking dropped or
 * misplaced chords.
 */
export function deriveSectionsAndArrangement(
  placements: { selection: ChordSelection; startBeat: number; lengthBeats: number }[],
  sections: SongPresetSection[],
): { sectionDefs: SongPresetSectionDef[]; arrangement: string[] } | null {
  if (sections.length === 0 || placements.length === 0) return null;
  const sortedSections = [...sections].sort((a, b) => a.startBeat - b.startBeat);

  let cursor = 0;
  for (const s of sortedSections) {
    if (s.startBeat !== cursor || s.lengthBeats <= 0) return null;
    cursor += s.lengthBeats;
  }
  const progressionEnd = placements.reduce((max, p) => Math.max(max, p.startBeat + p.lengthBeats), 0);
  if (cursor !== progressionEnd) return null;

  const sectionDefs: SongPresetSectionDef[] = [];
  const arrangement: string[] = [];
  const labelForContent = new Map<string, string>();

  for (const section of sortedSections) {
    const sectionEnd = section.startBeat + section.lengthBeats;
    const inSection = placements.filter((p) => p.startBeat >= section.startBeat && p.startBeat < sectionEnd);
    const fitsEntirely = inSection.every((p) => p.startBeat + p.lengthBeats <= sectionEnd);
    if (!fitsEntirely) return null;

    const relative: SongPresetPlacement[] = [...inSection]
      .sort((a, b) => a.startBeat - b.startBeat)
      .map((p) => ({
        selection: p.selection,
        startBeat: p.startBeat - section.startBeat,
        lengthBeats: p.lengthBeats,
      }));

    const contentKey = JSON.stringify({ label: section.label, relative });
    let defLabel = labelForContent.get(contentKey);
    if (!defLabel) {
      defLabel = section.label;
      let unique = defLabel;
      let n = 2;
      while (sectionDefs.some((d) => d.label === unique)) {
        unique = `${defLabel} (${n})`;
        n++;
      }
      defLabel = unique;
      sectionDefs.push({ label: defLabel, placements: relative });
      labelForContent.set(contentKey, defLabel);
    }
    arrangement.push(defLabel);
  }

  return { sectionDefs, arrangement };
}

/**
 * Resolves a preset's chords + section markers into the flat shape everything
 * downstream consumes, regardless of which on-disk shape (sectionDefs+arrangement,
 * or flat placements+sections) the preset actually stores. The one place callers
 * should reach for instead of branching on `preset.sectionDefs` themselves.
 */
export function resolveSongPreset(preset: SongPreset): {
  placements: { selection: ChordSelection; startBeat: number; lengthBeats: number }[];
  sections: SongPresetSection[];
} {
  if (preset.sectionDefs && preset.arrangement) {
    return resolveArrangement(preset.sectionDefs, preset.arrangement);
  }
  return {
    placements: resolvePlacementStarts(preset.placements ?? []),
    sections: preset.sections ?? [],
  };
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
  // Either shape is acceptable -- see SongPreset's own comment on sectionDefs/
  // arrangement/placements for why both need to keep loading indefinitely.
  const hasArrangementShape =
    Array.isArray(v.sectionDefs) &&
    v.sectionDefs.every(isSongPresetSectionDef) &&
    Array.isArray(v.arrangement) &&
    v.arrangement.every((s) => typeof s === 'string');
  const hasFlatShape = Array.isArray(v.placements) && v.placements.every(isSongPresetPlacement);
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
    (hasArrangementShape || hasFlatShape)
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
