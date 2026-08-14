import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import {
  deserializeSelection,
  midiToScaleDegreePosition,
  scaleDegreeToMidi,
} from '../data/progressions';
import type { Chord, ChordPlacement, ChordSelection, NotationStyle, ScaleDegree, ScaleName } from '../data/progressions';
import type { MelodyNote } from '../data/melody';
import type { SectionMarker } from '../data/sections';
import { SheetMusicHeader } from './SheetMusicHeader';
import { GRID_BARS, totalBeatsFor } from '../data/gridLayout';
import {
  EDIT_BARS_PER_ROW,
  beatsPerSystemFor,
  canPlace,
  canPlaceSection,
  chordSystemSegments,
  clientXToLocalBeat,
  clientXToLocalBeatFloor,
  colsPerSystem,
  gridTemplateRowsFor,
  laneChordSegments,
  maxFittingLength,
} from './editGrid/gridMath';
import { RulerRow } from './editGrid/RulerRow';
import { LoopRow } from './editGrid/LoopRow';
import { MelodyGrid } from './editGrid/MelodyGrid';
import { ChordRow } from './editGrid/ChordRow';

export type PendingChord = { selection: ChordSelection; lengthBeats: number };

type Props = {
  placements: ChordPlacement[];
  melody: MelodyNote[];
  sections: SectionMarker[];
  musicalKey: string;
  scale: ScaleName;
  notationStyle: NotationStyle;
  loopStart: number;
  loopEnd: number;
  playheadBeat: number;
  isPlaying: boolean;
  onPlayheadChange: (beat: number) => void;
  pendingChord: PendingChord | null;
  onDropChord: (selection: ChordSelection, startBeat: number, lengthBeats: number) => void;
  onReplaceChord: (placement: ChordPlacement, selection: ChordSelection) => void;
  onResize: (placement: ChordPlacement, newLength: number) => void;
  onMove: (placement: ChordPlacement, newStartBeat: number) => void;
  onRemove: (placement: ChordPlacement) => void;
  onClear: () => void;
  onLoopChange: (loopStart: number, loopEnd: number) => void;
  onAuditionChord: (chord: Chord) => void;
  onPastePlacements: (placements: ChordPlacement[]) => void;
  onAddSection: (startBeat: number, lengthBeats: number) => void;
  onRenameSection: (section: SectionMarker, label: string) => void;
  onMoveSection: (section: SectionMarker, newStartBeat: number) => void;
  onRemoveSection: (section: SectionMarker) => void;
  onAddMelodyNote: (note: MelodyNote) => void;
  onUpdateMelodyNote: (index: number, patch: Partial<MelodyNote>) => void;
  onRemoveMelodyNote: (index: number) => void;
  title: string;
  onTitleChange: (title: string) => void;
  subtitle: string;
  onSubtitleChange: (subtitle: string) => void;
  author: string;
  onAuthorChange: (author: string) => void;
  playStyle: string;
  onPlayStyleChange: (playStyle: string) => void;
  tempo: number;
  beatsPerBar: number;
};

const MIN_LENGTH_BEATS = 1;
const MIN_LOOP_LENGTH_BEATS = 1;
// Melody notes snap to the eighth note (half-beat) -- same value as the column
// unit every row-group shares (see gridMath.ts's COL_UNIT_BEATS).
const MELODY_SNAP_BEATS = 0.5;
// h/j/k/l/; -> note duration, matching Hookpad's own 1/4-1/2-1-2-4 picker and
// this app's existing home-row-duration convention (ChordPalette.tsx's own
// j/k/l/; for chord duration) -- only live while the melody cursor is active,
// via document.body.dataset.melodyCursorActive (see the effect below).
const DURATION_KEYS: Record<string, number> = { h: 0.25, j: 0.5, k: 1, l: 2, ';': 4 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Cross-system pointer hit-testing via elementFromPoint, rather than a single
// wrapperRef + row-index math (ChordGrid.tsx's approach) -- systems can have a
// variable chord-lane row count, so their heights aren't uniform/predictable
// the way ChordGrid's fixed ROW_HEIGHT was.
function systemAndRectFromPoint(clientX: number, clientY: number): { systemIndex: number; rect: DOMRect } | null {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const systemEl = el?.closest('.edit-grid-system') as HTMLElement | null;
  if (!systemEl) return null;
  const systemIndex = Number(systemEl.dataset.systemIndex);
  if (Number.isNaN(systemIndex)) return null;
  return { systemIndex, rect: systemEl.getBoundingClientRect() };
}

function beatFromPoint(clientX: number, clientY: number, beatsPerSystem: number): number | null {
  const hit = systemAndRectFromPoint(clientX, clientY);
  if (!hit) return null;
  return hit.systemIndex * beatsPerSystem + clientXToLocalBeatFloor(hit.rect, clientX, beatsPerSystem);
}

function fineBeatFromPoint(clientX: number, clientY: number, beatsPerSystem: number): number | null {
  const hit = systemAndRectFromPoint(clientX, clientY);
  if (!hit) return null;
  return hit.systemIndex * beatsPerSystem + clientXToLocalBeat(hit.rect, clientX, beatsPerSystem, MELODY_SNAP_BEATS);
}

function degreeFromPoint(clientX: number, clientY: number): number | null {
  const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const rowEl = el?.closest('.melody-row') as HTMLElement | null;
  if (!rowEl) return null;
  const degree = Number(rowEl.dataset.degree);
  return Number.isNaN(degree) ? null : degree;
}

function defaultVisibleOctave(melody: MelodyNote[], key: string, scale: ScaleName): number {
  if (melody.length === 0) return 4;
  const counts = new Map<number, number>();
  for (const note of melody) {
    const { octave } = midiToScaleDegreePosition(note.midi, key, scale);
    counts.set(octave, (counts.get(octave) ?? 0) + 1);
  }
  let best = 4;
  let bestCount = -1;
  for (const [octave, count] of counts) {
    if (count > bestCount) {
      best = octave;
      bestCount = count;
    }
  }
  return best;
}

/** Hookpad-style Edit view — a column-per-beat grid (8 bars/system) replacing
 * ChordGrid.tsx's staff-based editor. Three stacked row-groups per system: a
 * loop-range row, 7 diatonic melody rows (one visible octave, shiftable), and
 * one-or-more chord-block rows. See CLAUDE.md's "Three desktop views" section. */
export function EditGrid({
  placements,
  melody,
  sections,
  musicalKey,
  scale,
  notationStyle,
  loopStart,
  loopEnd,
  playheadBeat,
  isPlaying,
  onPlayheadChange,
  pendingChord,
  onDropChord,
  onReplaceChord,
  onResize,
  onMove,
  onRemove,
  onClear,
  onLoopChange,
  onAuditionChord,
  onPastePlacements,
  onAddSection,
  onRenameSection,
  onMoveSection,
  onRemoveSection,
  onAddMelodyNote,
  onUpdateMelodyNote,
  onRemoveMelodyNote,
  title,
  onTitleChange,
  subtitle,
  onSubtitleChange,
  author,
  onAuthorChange,
  playStyle,
  onPlayStyleChange,
  tempo,
  beatsPerBar,
}: Props) {
  const beatsPerSystem = beatsPerSystemFor(beatsPerBar);
  const totalBeats = totalBeatsFor(beatsPerBar);
  const colsPerSystemVal = colsPerSystem(beatsPerBar);
  const systemCount = GRID_BARS / EDIT_BARS_PER_ROW;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [selectedMelodyIndex, setSelectedMelodyIndex] = useState<number | null>(null);
  // The melody "cursor" -- a global beat position, set by clicking anywhere in
  // the melody grid (any row; row is irrelevant to activation, matching
  // Hookpad). Notes are only ever added via the 1-7/0 keys below, never by a
  // stray click -- clicking only activates where the next keypress will land.
  const [activeCell, setActiveCell] = useState<number | null>(null);
  // hjkl; set this, matching Hookpad's own 1/4-1/2-1-2-4 duration picker.
  const [noteDuration, setNoteDuration] = useState(1);
  const [visibleOctave, setVisibleOctave] = useState(() => defaultVisibleOctave(melody, musicalKey, scale));
  const clipboardRef = useRef<{ selection: ChordSelection; relativeStart: number; lengthBeats: number }[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionLabel, setEditingSectionLabel] = useState('');
  const prevSectionIdsRef = useRef<Set<string>>(new Set(sections.map((s) => s.id)));

  useEffect(() => {
    const prevIds = prevSectionIdsRef.current;
    const added = sections.find((s) => !prevIds.has(s.id));
    if (added) {
      setEditingSectionId(added.id);
      setEditingSectionLabel(added.label);
    }
    prevSectionIdsRef.current = new Set(sections.map((s) => s.id));
  }, [sections]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => placements.some((p) => p.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [placements]);

  useEffect(() => {
    setSelectedMelodyIndex((prev) => (prev !== null && prev < melody.length ? prev : null));
  }, [melody]);

  // A lightweight cross-component signal (not props/context) so
  // ChordPalette.tsx's own j/k/l/; chord-duration keys can suppress
  // themselves while the melody cursor is active -- both features
  // deliberately reuse the same home-row keys for "set duration," and they're
  // both mounted at once in Edit mode, so something has to arbitrate. A DOM
  // dataset flag avoids threading activeCell (or a derived boolean) through
  // App.tsx just for this.
  useEffect(() => {
    document.body.dataset.melodyCursorActive = activeCell !== null ? 'true' : 'false';
    return () => {
      delete document.body.dataset.melodyCursorActive;
    };
  }, [activeCell]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const hasNativeTextSelection = !!window.getSelection()?.toString();

      if (isCtrlOrCmd && e.key.toLowerCase() === 'c' && !hasNativeTextSelection) {
        if (selectedIds.size === 0) return;
        e.preventDefault();
        const selected = placements.filter((p) => selectedIds.has(p.id)).sort((a, b) => a.startBeat - b.startBeat);
        const minStart = selected[0].startBeat;
        clipboardRef.current = selected.map((p) => ({
          selection: p.selection,
          relativeStart: p.startBeat - minStart,
          lengthBeats: p.lengthBeats,
        }));
        return;
      }

      if (isCtrlOrCmd && e.key.toLowerCase() === 'v') {
        if (clipboardRef.current.length === 0) return;
        e.preventDefault();
        const pasteStart =
          placements.length === 0 ? 0 : Math.max(...placements.map((p) => p.startBeat + p.lengthBeats));
        const targets = clipboardRef.current.map((c) => ({ ...c, startBeat: pasteStart + c.relativeStart }));
        const allFit = targets.every((t) => canPlace(placements, null, t.startBeat, t.lengthBeats, totalBeats));
        if (!allFit) return;
        const pasted = targets.map((t) => ({
          id: crypto.randomUUID(),
          selection: t.selection,
          startBeat: t.startBeat,
          lengthBeats: t.lengthBeats,
        }));
        onPastePlacements(pasted);
        setSelectedIds(new Set(pasted.map((p) => p.id)));
        setAnchorId(pasted[pasted.length - 1].id);
        return;
      }

      if (selectedMelodyIndex !== null && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        onRemoveMelodyNote(selectedMelodyIndex);
        setSelectedMelodyIndex(null);
        return;
      }

      if (e.key === 'Escape' && (activeCell !== null || selectedMelodyIndex !== null)) {
        setActiveCell(null);
        setSelectedMelodyIndex(null);
        return;
      }

      // Melody note entry -- only live once a cell's been clicked/activated
      // (see MelodyGrid.tsx's onActivateCell), and the only way notes get
      // added at all: 1-7 places a diatonic scale degree, 0 rests, hjkl;
      // set the duration the next placement uses (matching Hookpad's own
      // 1/4-1/2-1-2-4 picker). Placing/resting always advances the cursor by
      // the current duration, so a run of keypresses types out a line the
      // same way Hookpad's own step-entry does.
      if (activeCell !== null) {
        const durationKeyValue = DURATION_KEYS[e.key.toLowerCase()];
        if (durationKeyValue !== undefined) {
          e.preventDefault();
          setNoteDuration(durationKeyValue);
          return;
        }
        if (e.key >= '1' && e.key <= '7') {
          e.preventDefault();
          const degree = (Number(e.key) - 1) as ScaleDegree;
          const midi = scaleDegreeToMidi(musicalKey, scale, degree, visibleOctave, 0);
          const overlapping = melody
            .map((n, i) => ({ n, i }))
            .filter(({ n }) => activeCell < n.startBeat + n.lengthBeats && n.startBeat < activeCell + noteDuration)
            .sort((a, b) => b.i - a.i);
          for (const { i } of overlapping) onRemoveMelodyNote(i);
          onAddMelodyNote({ startBeat: activeCell, midi, lengthBeats: noteDuration, velocity: 0.8 });
          setActiveCell(activeCell + noteDuration);
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          const overlapping = melody
            .map((n, i) => ({ n, i }))
            .filter(({ n }) => activeCell < n.startBeat + n.lengthBeats && n.startBeat < activeCell + noteDuration)
            .sort((a, b) => b.i - a.i);
          for (const { i } of overlapping) onRemoveMelodyNote(i);
          setActiveCell(activeCell + noteDuration);
          return;
        }
      }

      if (selectedIds.size === 0) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        for (const placement of placements) {
          if (selectedIds.has(placement.id)) onRemove(placement);
        }
        setSelectedIds(new Set());
      } else if (e.key === 'Escape') {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedIds,
    placements,
    onRemove,
    onPastePlacements,
    selectedMelodyIndex,
    onRemoveMelodyNote,
    totalBeats,
    activeCell,
    noteDuration,
    melody,
    musicalKey,
    scale,
    visibleOctave,
    onAddMelodyNote,
  ]);

  const handleWrapperClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.chord-block')) {
      setSelectedIds(new Set());
      setAnchorId(null);
    }
    if (!target.closest('.melody-note-block')) setSelectedMelodyIndex(null);
    // .melody-row is exempted -- that's the activation gesture itself (see
    // MelodyGrid.tsx's onActivateCell), already applied via the same click's
    // earlier mousedown; clearing it right back out here would make clicking
    // to activate a cell a no-op.
    if (!target.closest('.melody-row') && !target.closest('.melody-note-block')) setActiveCell(null);
  };

  const handleChordClick = (placement: ChordPlacement, chord: Chord) => (e: ReactMouseEvent) => {
    if (e.shiftKey && anchorId) {
      const sorted = [...placements].sort((a, b) => a.startBeat - b.startBeat);
      const anchorIndex = sorted.findIndex((p) => p.id === anchorId);
      const clickedIndex = sorted.findIndex((p) => p.id === placement.id);
      if (anchorIndex !== -1 && clickedIndex !== -1) {
        const [lo, hi] = anchorIndex < clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex];
        setSelectedIds(new Set(sorted.slice(lo, hi + 1).map((p) => p.id)));
      }
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(placement.id)) next.delete(placement.id);
        else next.add(placement.id);
        return next;
      });
      setAnchorId(placement.id);
    } else {
      setSelectedIds(new Set([placement.id]));
      setAnchorId(placement.id);
    }
    onAuditionChord(chord);
  };

  const handleChordLaneClick = (globalBeat: number) => {
    if (pendingChord) {
      if (!canPlace(placements, null, globalBeat, pendingChord.lengthBeats, totalBeats)) return;
      onDropChord(pendingChord.selection, globalBeat, pendingChord.lengthBeats);
      return;
    }
    if (!isPlaying) onPlayheadChange(globalBeat);
  };

  const handleChordMoveStart = (placement: ChordPlacement) => (e: ReactMouseEvent) => {
    e.preventDefault();
    const grabBeat = beatFromPoint(e.clientX, e.clientY, beatsPerSystem);
    const grabOffset = grabBeat === null ? 0 : grabBeat - placement.startBeat;
    let lastEmitted = placement.startBeat;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pointerBeat = beatFromPoint(moveEvent.clientX, moveEvent.clientY, beatsPerSystem);
      if (pointerBeat === null) return;
      const target = clamp(pointerBeat - grabOffset, 0, totalBeats - placement.lengthBeats);
      if (target !== lastEmitted && canPlace(placements, placement.id, target, placement.lengthBeats, totalBeats)) {
        lastEmitted = target;
        onMove(placement, target);
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleChordResizeStart = (placement: ChordPlacement) => (e: ReactMouseEvent) => {
    e.preventDefault();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pointerBeat = beatFromPoint(moveEvent.clientX, moveEvent.clientY, beatsPerSystem);
      if (pointerBeat === null) return;
      const targetEnd = pointerBeat + 1;
      const target = Math.max(MIN_LENGTH_BEATS, targetEnd - placement.startBeat);
      const maxFit = maxFittingLength(placements, placement, totalBeats);
      const finalLength = Math.min(target, maxFit);
      if (finalLength !== placement.lengthBeats) onResize(placement, finalLength);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSectionMouseDown = (section: SectionMarker) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const grabBeat = beatFromPoint(e.clientX, e.clientY, beatsPerSystem);
    const grabOffset = grabBeat === null ? 0 : grabBeat - section.startBeat;
    let lastEmitted = section.startBeat;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pointerBeat = beatFromPoint(moveEvent.clientX, moveEvent.clientY, beatsPerSystem);
      if (pointerBeat === null) return;
      const target = clamp(pointerBeat - grabOffset, 0, totalBeats - section.lengthBeats);
      if (target !== lastEmitted && canPlaceSection(sections, section.id, target, section.lengthBeats, totalBeats)) {
        lastEmitted = target;
        onMoveSection(section, target);
      }
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleAddSectionClick = () => {
    const start = sections.length === 0 ? 0 : Math.max(...sections.map((s) => s.startBeat + s.lengthBeats));
    if (start >= totalBeats) return;
    const length = Math.min(beatsPerSystem, totalBeats - start);
    onAddSection(start, length);
  };

  const startEditingSection = (section: SectionMarker) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSectionId(section.id);
    setEditingSectionLabel(section.label);
  };
  const commitEditingSection = (section: SectionMarker) => () => {
    const trimmed = editingSectionLabel.trim();
    if (trimmed && trimmed !== section.label) onRenameSection(section, trimmed);
    setEditingSectionId(null);
  };
  const cancelEditingSection = () => setEditingSectionId(null);

  const handleLoopBackgroundMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    const anchor = beatFromPoint(e.clientX, e.clientY, beatsPerSystem);
    if (anchor === null) return;
    // A plain click highlights the whole bar under the pointer (matching
    // Hookpad's own loop row) -- dragging from there extends beat-by-beat off
    // whichever edge of that anchor bar the pointer moves past.
    const anchorBarStart = Math.floor(anchor / beatsPerBar) * beatsPerBar;
    const anchorBarEnd = Math.min(totalBeats, anchorBarStart + beatsPerBar);
    onLoopChange(anchorBarStart, anchorBarEnd);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const beat = beatFromPoint(moveEvent.clientX, moveEvent.clientY, beatsPerSystem);
      if (beat === null) return;
      const lo = clamp(Math.min(anchorBarStart, beat), 0, totalBeats - MIN_LOOP_LENGTH_BEATS);
      const hi = clamp(Math.max(anchorBarEnd, beat + 1), lo + MIN_LOOP_LENGTH_BEATS, totalBeats);
      onLoopChange(lo, hi);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleLoopStartHandleMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const beat = beatFromPoint(moveEvent.clientX, moveEvent.clientY, beatsPerSystem);
      if (beat === null) return;
      const clamped = clamp(beat, 0, loopEnd - MIN_LOOP_LENGTH_BEATS);
      if (clamped !== loopStart) onLoopChange(clamped, loopEnd);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleLoopEndHandleMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const beat = beatFromPoint(moveEvent.clientX, moveEvent.clientY, beatsPerSystem);
      if (beat === null) return;
      const clamped = clamp(beat + 1, loopStart + MIN_LOOP_LENGTH_BEATS, totalBeats);
      if (clamped !== loopEnd) onLoopChange(loopStart, clamped);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleActivateCell = (systemStart: number) => (localBeat: number) => {
    setActiveCell(systemStart + localBeat);
  };

  // Raise/Lower Octave/Half buttons -- Hookpad-style post-hoc note
  // modification. Chromatic entry lives here now, not at placement time (the
  // old Alt+click nudge is gone along with direct-click placement): place a
  // diatonic note with 1-7, then Half ▲/▼ to make it chromatic.
  const handleModifySelectedNote = (deltaMidi: number) => {
    if (selectedMelodyIndex === null) return;
    const note = melody[selectedMelodyIndex];
    if (!note) return;
    onUpdateMelodyNote(selectedMelodyIndex, { midi: note.midi + deltaMidi });
  };

  const handleNoteMouseDown = (index: number) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedMelodyIndex(index);
    const note = melody[index];
    // Clicking an existing note also parks the cursor at it, so it can be
    // overwritten in place by the next 1-7/0 keypress, same as any other
    // activated cell.
    setActiveCell(note.startBeat);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const beat = fineBeatFromPoint(moveEvent.clientX, moveEvent.clientY, beatsPerSystem);
      const degree = degreeFromPoint(moveEvent.clientX, moveEvent.clientY);
      if (beat === null || degree === null) return;
      const startBeat = clamp(beat, 0, totalBeats - note.lengthBeats);
      const midi = scaleDegreeToMidi(musicalKey, scale, degree as ScaleDegree, visibleOctave, moveEvent.altKey ? 1 : 0);
      onUpdateMelodyNote(index, { startBeat, midi });
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const dropBeat = beatFromPoint(e.clientX, e.clientY, beatsPerSystem);
    if (dropBeat === null) return;
    const selection = deserializeSelection(raw);
    const existing = placements.find((p) => dropBeat >= p.startBeat && dropBeat < p.startBeat + p.lengthBeats);
    if (existing) {
      onReplaceChord(existing, selection);
      return;
    }
    const defaultLength = placements.find((p) => p.id === anchorId)?.lengthBeats ?? beatsPerBar;
    if (!canPlace(placements, null, dropBeat, defaultLength, totalBeats)) return;
    onDropChord(selection, dropBeat, defaultLength);
  };

  const notesAbove = melody.filter((n) => midiToScaleDegreePosition(n.midi, musicalKey, scale).octave > visibleOctave).length;
  const notesBelow = melody.filter((n) => midiToScaleDegreePosition(n.midi, musicalKey, scale).octave < visibleOctave).length;

  return (
    <div className="edit-grid-wrapper">
      {placements.length === 0 && (
        <p className="chord-grid-hint">Click a chord in the palette above, then click a cell here to place it.</p>
      )}
      <div className="edit-grid-page">
        <SheetMusicHeader
          title={title}
          onTitleChange={onTitleChange}
          subtitle={subtitle}
          onSubtitleChange={onSubtitleChange}
          author={author}
          onAuthorChange={onAuthorChange}
          playStyle={playStyle}
          onPlayStyleChange={onPlayStyleChange}
          tempo={tempo}
          onClear={onClear}
          showStaff={false}
        />
        <div className="section-toolbar">
          <button type="button" className="section-add-button" onClick={handleAddSectionClick}>
            + Section
          </button>
          <div className="register-shift" role="group" aria-label="Melody octave">
            <button
              type="button"
              onClick={() => setVisibleOctave((o) => o - 1)}
              aria-label="Shift melody rows down an octave"
              title={notesBelow > 0 ? `▼ ${notesBelow} note${notesBelow === 1 ? '' : 's'} below` : 'Shift down an octave'}
            >
              ▼
            </button>
            <span className="register-shift-label">
              Octave {visibleOctave}
              {notesAbove > 0 && <span className="register-shift-hint"> ▲{notesAbove}</span>}
              {notesBelow > 0 && <span className="register-shift-hint"> ▼{notesBelow}</span>}
            </span>
            <button
              type="button"
              onClick={() => setVisibleOctave((o) => o + 1)}
              aria-label="Shift melody rows up an octave"
              title={notesAbove > 0 ? `▲ ${notesAbove} note${notesAbove === 1 ? '' : 's'} above` : 'Shift up an octave'}
            >
              ▲
            </button>
          </div>
          <div className="melody-note-modify" role="group" aria-label="Modify selected note">
            <button
              type="button"
              disabled={selectedMelodyIndex === null}
              onClick={() => handleModifySelectedNote(-12)}
              title="Lower selected note an octave"
            >
              Octave ▼
            </button>
            <button
              type="button"
              disabled={selectedMelodyIndex === null}
              onClick={() => handleModifySelectedNote(-1)}
              title="Lower selected note a half step"
            >
              Half ▼
            </button>
            <button
              type="button"
              disabled={selectedMelodyIndex === null}
              onClick={() => handleModifySelectedNote(1)}
              title="Raise selected note a half step"
            >
              Half ▲
            </button>
            <button
              type="button"
              disabled={selectedMelodyIndex === null}
              onClick={() => handleModifySelectedNote(12)}
              title="Raise selected note an octave"
            >
              Octave ▲
            </button>
          </div>
        </div>
        <div className="edit-grid" onClickCapture={handleWrapperClickCapture}>
          {Array.from({ length: systemCount }, (_, systemIndex) => {
            const systemStart = systemIndex * beatsPerSystem;
            const segmentsInSystem = placements
              .flatMap((p) => chordSystemSegments(p, beatsPerSystem))
              .filter((s) => s.system === systemIndex);
            const laned = laneChordSegments(segmentsInSystem, beatsPerBar);
            const maxLane = laned.reduce((m, s) => Math.max(m, s.lane), 0);
            const playheadSystem = clamp(Math.floor(playheadBeat / beatsPerSystem), 0, systemCount - 1);
            const loopStartSystem = Math.floor(loopStart / beatsPerSystem);
            const loopEndHomeSystem = Math.floor(Math.max(0, loopEnd - 1) / beatsPerSystem);
            const systemSections = sections.filter((s) => Math.floor(s.startBeat / beatsPerSystem) === systemIndex);

            return (
              <div
                key={systemIndex}
                className="edit-grid-system"
                data-system-index={systemIndex}
                style={
                  {
                    '--cols': colsPerSystemVal,
                    '--bars': EDIT_BARS_PER_ROW,
                    '--beats': beatsPerSystem,
                    gridTemplateRows: gridTemplateRowsFor(maxLane + 1),
                  } as CSSProperties
                }
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <RulerRow systemIndex={systemIndex} beatsPerBar={beatsPerBar} />
                <LoopRow
                  systemStart={systemStart}
                  beatsPerSystem={beatsPerSystem}
                  loopStart={loopStart}
                  loopEnd={loopEnd}
                  showLoopStartHandle={loopStartSystem === systemIndex}
                  showLoopEndHandle={loopEndHomeSystem === systemIndex}
                  showPlayhead={playheadSystem === systemIndex}
                  playheadBeat={playheadBeat}
                  sections={systemSections}
                  editingSectionId={editingSectionId}
                  editingSectionLabel={editingSectionLabel}
                  onEditingSectionLabelChange={setEditingSectionLabel}
                  onStartEditingSection={startEditingSection}
                  onCommitEditingSection={commitEditingSection}
                  onCancelEditingSection={cancelEditingSection}
                  onSectionMouseDown={handleSectionMouseDown}
                  onRemoveSection={onRemoveSection}
                  onLoopBackgroundMouseDown={handleLoopBackgroundMouseDown}
                  onLoopStartHandleMouseDown={handleLoopStartHandleMouseDown}
                  onLoopEndHandleMouseDown={handleLoopEndHandleMouseDown}
                />
                <MelodyGrid
                  systemStart={systemStart}
                  beatsPerSystem={beatsPerSystem}
                  melody={melody}
                  musicalKey={musicalKey}
                  scale={scale}
                  visibleOctave={visibleOctave}
                  selectedMelodyIndex={selectedMelodyIndex}
                  activeCell={activeCell}
                  onActivateCell={handleActivateCell(systemStart)}
                  onNoteMouseDown={handleNoteMouseDown}
                />
                <ChordRow
                  beatsPerSystem={beatsPerSystem}
                  laned={laned}
                  maxLane={maxLane}
                  musicalKey={musicalKey}
                  scale={scale}
                  notationStyle={notationStyle}
                  selectedIds={selectedIds}
                  hasPendingChord={pendingChord !== null}
                  onLaneMouseDown={(_lane, localBeat) => handleChordLaneClick(systemStart + localBeat)}
                  onChordMouseDown={handleChordMoveStart}
                  onChordClick={handleChordClick}
                  onResizeMouseDown={handleChordResizeStart}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
