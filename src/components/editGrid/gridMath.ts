import type { ChordPlacement } from '../../data/progressions';
import type { SectionMarker } from '../../data/sections';

// 8 bars per row — a fixed choice for this grid specifically, independent of the
// other three views' own BARS_PER_ROW = 4 (see CLAUDE.md's "Three desktop views").
export const EDIT_BARS_PER_ROW = 8;

/** Beats in one full system (EDIT_BARS_PER_ROW bars) at a given time signature. */
export function beatsPerSystemFor(beatsPerBar: number): number {
  return EDIT_BARS_PER_ROW * beatsPerBar;
}

export function systemOf(beat: number, beatsPerSystem: number): number {
  return Math.floor(beat / beatsPerSystem);
}

// Column unit = half-beat, shared by chords/loop (whole-beat) and melody
// (half-beat) so both row-groups sit on one coordinate space — see the plan's
// "CSS Grid structure" section.
export const COL_UNIT_BEATS = 0.5;

export function colsPerSystem(beatsPerBar: number): number {
  return beatsPerSystemFor(beatsPerBar) / COL_UNIT_BEATS;
}

/** 1-based CSS grid column line for a beat position local to its own system. */
export function colLine(beatInSystem: number): number {
  return Math.round(beatInSystem / COL_UNIT_BEATS) + 1;
}

// Row-track layout, shared by every system's grid-template-rows. Four named
// row-groups (ruler, loop, melody, chords) read as distinct cells, each
// separated by its own small explicit spacer track (GROUP_GAP_PX) -- not a
// plain CSS `row-gap` on the whole grid, since that applies uniformly to every
// track boundary and can't leave the 7 melody rows (or multiple chord lanes)
// touching while still gapping the boundaries *between* groups. Section
// markers sit above everything, including the ruler, with no gap of their own
// (only the four groups below them are explicitly gapped).
export const MELODY_ROW_COUNT = 7;
export const SECTION_TRACK = 1;
export const RULER_TRACK = 2;
const GAP_A_TRACK = RULER_TRACK + 1; // 3, ruler -> loop
export const LOOP_TRACK = GAP_A_TRACK + 1; // 4
const GAP_B_TRACK = LOOP_TRACK + 1; // 5, loop -> melody
const MELODY_TRACK_TOP = GAP_B_TRACK + 1; // 6
// No fixed CHORD_TRACK_BASE constant anymore -- the melody block's own height
// varies per system (see chordTrackBase below), so where the chord lanes
// start has to vary with it too.

// octaveOffsetFromTop: 0 for the topmost octave block a system is currently
// rendering, increasing downward for each octave below it -- see EditGrid's
// systemOctaveRange, which decides how many octave blocks (normally just 1)
// a given system actually needs, based on that system's own notes.
export function melodyTrackForDegree(degree: number, octaveOffsetFromTop: number = 0): number {
  return MELODY_TRACK_TOP + octaveOffsetFromTop * MELODY_ROW_COUNT + (MELODY_ROW_COUNT - 1 - degree);
}

/** Where the chord-lane tracks start, given how many octave blocks the melody
 * grid needs this system (usually 1) -- used to be a fixed CHORD_TRACK_BASE
 * constant; now a function of the melody block's own (per-system) height. */
export function chordTrackBase(melodyOctaveSpan: number): number {
  return MELODY_TRACK_TOP + MELODY_ROW_COUNT * melodyOctaveSpan + 1;
}

// Every *content* track's height, in a shared unit (ROW_UNIT_PX) -- e.g. a
// chord row reads as "4 units tall" regardless of what a unit actually
// resolves to in pixels, so the whole grid's proportions stay a single
// tunable knob. GROUP_GAP_PX (the spacer tracks above) is a separate, fixed
// pixel value -- a structural seam, not scaled content.
export const ROW_UNIT_PX = 16;
export const SECTION_ROW_UNITS = 1;
export const RULER_ROW_UNITS = 1;
export const LOOP_ROW_UNITS = 1;
export const MELODY_ROW_UNITS = 1;
export const CHORD_ROW_UNITS = 4;
const GROUP_GAP_PX = 4;

/** The full `grid-template-rows` value for one system, given how many chord
 * lanes it actually needs (maxLane + 1) and how many octave blocks its melody
 * grid needs (melodyOctaveSpan, usually 1 -- see EditGrid's systemOctaveRange). */
export function gridTemplateRowsFor(chordLaneCount: number, melodyOctaveSpan: number = 1): string {
  const px = (units: number) => `${units * ROW_UNIT_PX}px`;
  const gap = `${GROUP_GAP_PX}px`;
  return [
    px(SECTION_ROW_UNITS),
    px(RULER_ROW_UNITS),
    gap,
    px(LOOP_ROW_UNITS),
    gap,
    `repeat(${MELODY_ROW_COUNT * melodyOctaveSpan}, ${px(MELODY_ROW_UNITS)})`,
    gap,
    `repeat(${chordLaneCount}, ${px(CHORD_ROW_UNITS)})`,
  ].join(' ');
}

function overlaps(a: ChordPlacement, startBeat: number, lengthBeats: number): boolean {
  return startBeat < a.startBeat + a.lengthBeats && a.startBeat < startBeat + lengthBeats;
}

// Placements are free to span multiple systems — canPlace only rejects going off
// the front/back of the grid or overlapping another chord in time, never crossing
// a system boundary.
export function canPlace(
  placements: ChordPlacement[],
  excludeId: string | null,
  startBeat: number,
  lengthBeats: number,
  totalBeats: number,
): boolean {
  if (startBeat < 0 || lengthBeats <= 0 || startBeat + lengthBeats > totalBeats) return false;
  return placements.every((p) => p.id === excludeId || !overlaps(p, startBeat, lengthBeats));
}

const MIN_LENGTH_BEATS = 1;

export function maxFittingLength(placements: ChordPlacement[], current: ChordPlacement, totalBeats: number): number {
  let best = 0;
  for (let len = MIN_LENGTH_BEATS; current.startBeat + len <= totalBeats; len++) {
    if (canPlace(placements, current.id, current.startBeat, len, totalBeats)) best = len;
    else break;
  }
  return best || current.lengthBeats;
}

// Section markers get their own overlap logic — same shape (id/startBeat/
// lengthBeats), but sections are a separate, non-overlapping-with-each-other
// timeline (free to overlap chords).
function overlapsSection(a: SectionMarker, startBeat: number, lengthBeats: number): boolean {
  return startBeat < a.startBeat + a.lengthBeats && a.startBeat < startBeat + lengthBeats;
}

export function canPlaceSection(
  sections: SectionMarker[],
  excludeId: string | null,
  startBeat: number,
  lengthBeats: number,
  totalBeats: number,
): boolean {
  if (startBeat < 0 || lengthBeats <= 0 || startBeat + lengthBeats > totalBeats) return false;
  return sections.every((s) => s.id === excludeId || !overlapsSection(s, startBeat, lengthBeats));
}

export type ChordSystemSegment = {
  placement: ChordPlacement;
  system: number;
  localStart: number;
  span: number;
  isFirst: boolean;
  isLast: boolean;
};

/** Splits a placement into one segment per system (row) it visually spans —
 * same idea as ChordGrid.tsx's segmentsFor, renamed for this grid's own
 * "system" terminology. */
export function chordSystemSegments(placement: ChordPlacement, beatsPerSystem: number): ChordSystemSegment[] {
  const segments: ChordSystemSegment[] = [];
  const end = placement.startBeat + placement.lengthBeats;
  let cursor = placement.startBeat;
  while (cursor < end) {
    const system = systemOf(cursor, beatsPerSystem);
    const systemStart = system * beatsPerSystem;
    const segEnd = Math.min(end, systemStart + beatsPerSystem);
    segments.push({
      placement,
      system,
      localStart: cursor - systemStart,
      span: segEnd - cursor,
      isFirst: cursor === placement.startBeat,
      isLast: segEnd === end,
    });
    cursor = segEnd;
  }
  return segments;
}

export type LanedChordSegment = ChordSystemSegment & { lane: number };

// Since canPlace already guarantees no time-overlap, stacking into lanes is
// purely a legibility choice: a placement's lane flips from its predecessor's
// only when that predecessor is short enough (< 2 beats) that its label would
// crowd the next one, and they share a bar; otherwise every segment resets to
// lane 0.
const CROWD_THRESHOLD_BEATS = 2;

export function laneChordSegments(segments: ChordSystemSegment[], beatsPerBar: number): LanedChordSegment[] {
  const sorted = [...segments].sort((a, b) => a.localStart - b.localStart);
  const laned: LanedChordSegment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    if (i === 0) {
      laned.push({ ...seg, lane: 0 });
      continue;
    }
    const prev = laned[i - 1];
    const prevBar = Math.floor(prev.localStart / beatsPerBar);
    const curBar = Math.floor(seg.localStart / beatsPerBar);
    const prevCrowds = prev.span < CROWD_THRESHOLD_BEATS && prevBar === curBar;
    laned.push({ ...seg, lane: prevCrowds ? (prev.lane === 0 ? 1 : 0) : 0 });
  }
  return laned;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Converts a mouse position (relative to one system's own grid element) into a
 * beat position local to that system, snapped (rounded) to unit — used for
 * melody clicks, where "nearest half-beat" is the right target. */
export function clientXToLocalBeat(
  systemRect: DOMRect,
  clientX: number,
  beatsPerSystem: number,
  unit: number = 1,
): number {
  const beatWidth = systemRect.width / beatsPerSystem;
  const raw = (clientX - systemRect.left) / beatWidth;
  const snapped = Math.round(raw / unit) * unit;
  return clamp(snapped, 0, beatsPerSystem - unit);
}

/** Same idea, but floored to the containing whole beat rather than rounded to
 * the nearest one — matches ChordGrid.tsx's own convention for chord/loop
 * placement ("which beat cell is the pointer over"), as opposed to melody's
 * "snap to nearest" behavior above. */
export function clientXToLocalBeatFloor(systemRect: DOMRect, clientX: number, beatsPerSystem: number): number {
  const beatWidth = systemRect.width / beatsPerSystem;
  const raw = Math.floor((clientX - systemRect.left) / beatWidth);
  return clamp(raw, 0, beatsPerSystem - 1);
}
