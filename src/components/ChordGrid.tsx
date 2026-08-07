import { useEffect, useRef, useState } from 'react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { chordNameParts, deserializeSelection, resolveSelection, keySignatureAccidentals } from '../data/progressions';
import type { Chord, ChordPlacement, ChordSelection, NotationStyle, ScaleName } from '../data/progressions';
import { staffStepsAboveBottomLine } from '../data/melody';
import type { MelodyNote } from '../data/melody';
import type { SectionMarker } from '../data/sections';
import { SheetMusicHeader } from './SheetMusicHeader';
import { STAFF_HEIGHT, STAFF_LINE_GAP, SHARP_KEY_SIG_STEPS, FLAT_KEY_SIG_STEPS } from './staffLayout';

// 12 rows of 4 bars — a full lead-sheet page (A4-ish proportions), not just a loop snippet.
export const GRID_BARS = 48;
const BEATS_PER_BAR = 4;
const BARS_PER_ROW = 4;
const BEATS_PER_ROW = BARS_PER_ROW * BEATS_PER_BAR; // 16
export const TOTAL_BEATS = GRID_BARS * BEATS_PER_BAR; // 192
const ROWS = GRID_BARS / BARS_PER_ROW; // 12

const RULER_HEIGHT = 14;
const SECTION_HEIGHT = 16; // px — strip above the ruler where section-marker brackets sit
const CHORD_LABEL_HEIGHT = 26; // px — strip above the staff where chord symbols sit (Limelight needs a bit more headroom than plain serif did)
const ROW_CONTENT_HEIGHT = CHORD_LABEL_HEIGHT + STAFF_HEIGHT;
const ROW_GAP = 8;
// px — section strip + ruler + (chord-label strip + staff) + row gap, for Y-position math (clientPosToGlobalBeat).
const ROW_HEIGHT = SECTION_HEIGHT + RULER_HEIGHT + ROW_CONTENT_HEIGHT + ROW_GAP;
const MIN_LENGTH_BEATS = 1; // 1/4 bar
const MIN_LOOP_LENGTH_BEATS = 1;
const DEFAULT_SECTION_LENGTH_BEATS = BEATS_PER_ROW; // one row (4 bars) — a visible, easily-resized starting size

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
  title: string;
  onTitleChange: (title: string) => void;
  author: string;
  onAuthorChange: (author: string) => void;
  tempo: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rowOf(beat: number): number {
  return Math.floor(beat / BEATS_PER_ROW);
}

function overlaps(a: ChordPlacement, startBeat: number, lengthBeats: number): boolean {
  return startBeat < a.startBeat + a.lengthBeats && a.startBeat < startBeat + lengthBeats;
}

// Placements are free to span multiple rows — canPlace only rejects going off the
// front/back of the grid or overlapping another chord in time, never crossing a row.
function canPlace(
  placements: ChordPlacement[],
  excludeId: string | null,
  startBeat: number,
  lengthBeats: number,
): boolean {
  if (startBeat < 0 || lengthBeats <= 0 || startBeat + lengthBeats > TOTAL_BEATS) return false;
  return placements.every((p) => p.id === excludeId || !overlaps(p, startBeat, lengthBeats));
}

type ChordSegment = {
  placement: ChordPlacement;
  row: number;
  localStart: number;
  span: number;
  isFirst: boolean;
  isLast: boolean;
};

/** Splits a placement into one segment per row it visually spans. */
function segmentsFor(placement: ChordPlacement): ChordSegment[] {
  const segments: ChordSegment[] = [];
  const end = placement.startBeat + placement.lengthBeats;
  let cursor = placement.startBeat;
  while (cursor < end) {
    const row = rowOf(cursor);
    const rowStart = row * BEATS_PER_ROW;
    const segEnd = Math.min(end, rowStart + BEATS_PER_ROW);
    segments.push({
      placement,
      row,
      localStart: cursor - rowStart,
      span: segEnd - cursor,
      isFirst: cursor === placement.startBeat,
      isLast: segEnd === end,
    });
    cursor = segEnd;
  }
  return segments;
}

function maxFittingLength(placements: ChordPlacement[], current: ChordPlacement): number {
  let best = 0;
  for (let len = MIN_LENGTH_BEATS; current.startBeat + len <= TOTAL_BEATS; len++) {
    if (canPlace(placements, current.id, current.startBeat, len)) best = len;
    else break;
  }
  return best || current.lengthBeats;
}

// Section markers get their own overlap logic rather than sharing the chord-
// placement one above — same shape (id/startBeat/lengthBeats), but sections are a
// completely separate, non-overlapping-with-each-other timeline (they're free to
// overlap chords; a section covers whatever's underneath it). lengthBeats is
// internal bookkeeping only — real-book style, a section marker displays as a
// single boxed letter at its start, not a highlighted range — kept just so two
// sections can't be dragged to the exact same spot and render on top of each other.
function overlapsSection(a: SectionMarker, startBeat: number, lengthBeats: number): boolean {
  return startBeat < a.startBeat + a.lengthBeats && a.startBeat < startBeat + lengthBeats;
}

function canPlaceSection(
  sections: SectionMarker[],
  excludeId: string | null,
  startBeat: number,
  lengthBeats: number,
): boolean {
  if (startBeat < 0 || lengthBeats <= 0 || startBeat + lengthBeats > TOTAL_BEATS) return false;
  return sections.every((s) => s.id === excludeId || !overlapsSection(s, startBeat, lengthBeats));
}

/** Converts a mouse position (relative to the whole multi-row wrapper) into a global beat index. */
function clientPosToGlobalBeat(wrapperRect: DOMRect, clientX: number, clientY: number): number {
  const beatWidth = wrapperRect.width / BEATS_PER_ROW; // row width is fluid — fills the container
  const row = clamp(Math.floor((clientY - wrapperRect.top) / ROW_HEIGHT), 0, ROWS - 1);
  const beatInRow = clamp(Math.floor((clientX - wrapperRect.left) / beatWidth), 0, BEATS_PER_ROW - 1);
  return row * BEATS_PER_ROW + beatInRow;
}

export function ChordGrid({
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
  title,
  onTitleChange,
  author,
  onAuthorChange,
  tempo,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // The last plain- or ctrl-clicked block — shift-click ranges are measured from here.
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const clipboardRef = useRef<{ selection: ChordSelection; relativeStart: number; lengthBeats: number }[]>(
    [],
  );
  // Which section's label is currently being edited, and its in-progress text — a
  // section starts editing itself right after being added, or on clicking its label.
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionLabel, setEditingSectionLabel] = useState('');
  // onAddSection doesn't hand back the new section's id (App.tsx mints it via
  // crypto.randomUUID() on its own setSections call) — so instead of threading an
  // id back through the callback, just notice a section id that wasn't here last
  // render and start editing that one, whichever it turns out to be.
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

  // Selection follows the placement list — if any selected block was removed elsewhere
  // (Clear, preset load, the × button), drop it from the selection.
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => placements.some((p) => p.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [placements]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const hasNativeTextSelection = !!window.getSelection()?.toString();

      if (isCtrlOrCmd && e.key.toLowerCase() === 'c' && !hasNativeTextSelection) {
        if (selectedIds.size === 0) return;
        e.preventDefault();
        const selected = placements
          .filter((p) => selectedIds.has(p.id))
          .sort((a, b) => a.startBeat - b.startBeat);
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
        const allFit = targets.every((t) => canPlace(placements, null, t.startBeat, t.lengthBeats));
        if (!allFit) return; // no partial pastes — keep the result predictable
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
  }, [selectedIds, placements, onRemove, onPastePlacements]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Clicking anywhere in the grid that isn't a chord block clears the selection.
  const handleWrapperClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('.chord-label')) {
      setSelectedIds(new Set());
      setAnchorId(null);
    }
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

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw || !wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const dropBeat = clientPosToGlobalBeat(rect, e.clientX, e.clientY);
    const selection = deserializeSelection(raw);

    // Dropping directly on an existing chord replaces it (same slot/length) —
    // placements never overlap each other, so a single point can match at most one.
    const existing = placements.find(
      (p) => dropBeat >= p.startBeat && dropBeat < p.startBeat + p.lengthBeats,
    );
    if (existing) {
      onReplaceChord(existing, selection);
      return;
    }

    // New chords default to the length of whichever block was last selected, rather
    // than always resetting to a bar — makes dropping a run of same-length chords
    // (e.g. a string of half-bar changes) not require resizing every single one.
    const defaultLength = placements.find((p) => p.id === anchorId)?.lengthBeats ?? 4;
    if (!canPlace(placements, null, dropBeat, defaultLength)) return; // reject overlapping/off-grid drops

    onDropChord(selection, dropBeat, defaultLength);
  };

  // Resize/move both use clientPosToGlobalBeat (2D — row-aware) rather than a
  // horizontal-only pixel delta, so dragging across a row boundary works correctly.
  const handleResizeStart = (placement: ChordPlacement) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!wrapperRef.current) return;
    const wrapperRect = wrapperRef.current.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // +1 — dragging targets "the beat after" the cursor, matching the loop-end handle.
      const targetEnd = clientPosToGlobalBeat(wrapperRect, moveEvent.clientX, moveEvent.clientY) + 1;
      const target = Math.max(MIN_LENGTH_BEATS, targetEnd - placement.startBeat);
      const maxFit = maxFittingLength(placements, placement);
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

  const handleMoveStart = (placement: ChordPlacement) => (e: ReactMouseEvent) => {
    e.preventDefault();
    if (!wrapperRef.current) return;
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    // Where within the block the user grabbed it, so the block doesn't jump to have
    // its start snap under the cursor on the first move event.
    const grabOffset = clientPosToGlobalBeat(wrapperRect, e.clientX, e.clientY) - placement.startBeat;
    let lastEmitted = placement.startBeat;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pointerBeat = clientPosToGlobalBeat(wrapperRect, moveEvent.clientX, moveEvent.clientY);
      const target = clamp(pointerBeat - grabOffset, 0, TOTAL_BEATS - placement.lengthBeats);
      if (target !== lastEmitted && canPlace(placements, placement.id, target, placement.lengthBeats)) {
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

  // Same shape as handleMoveStart above, just against the sections array/
  // canPlaceSection instead of placements/canPlace. No resize counterpart — a
  // section marker is a single boxed letter at its start, not a draggable range.
  const handleSectionMoveStart = (section: SectionMarker) => (e: ReactMouseEvent) => {
    e.preventDefault();
    if (!wrapperRef.current) return;
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const grabOffset = clientPosToGlobalBeat(wrapperRect, e.clientX, e.clientY) - section.startBeat;
    let lastEmitted = section.startBeat;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pointerBeat = clientPosToGlobalBeat(wrapperRect, moveEvent.clientX, moveEvent.clientY);
      const target = clamp(pointerBeat - grabOffset, 0, TOTAL_BEATS - section.lengthBeats);
      if (target !== lastEmitted && canPlaceSection(sections, section.id, target, section.lengthBeats)) {
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
    if (start >= TOTAL_BEATS) return; // grid's full — nowhere left to append one
    const length = Math.min(DEFAULT_SECTION_LENGTH_BEATS, TOTAL_BEATS - start);
    onAddSection(start, length);
    // See prevSectionIdsRef's effect above — it notices the new section once it
    // shows up in the sections prop and starts editing it automatically.
  };

  const startEditingSection = (section: SectionMarker) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    setEditingSectionId(section.id);
    setEditingSectionLabel(section.label);
  };

  const commitEditingSection = (section: SectionMarker) => () => {
    const trimmed = editingSectionLabel.trim();
    if (trimmed && trimmed !== section.label) onRenameSection(section, trimmed);
    setEditingSectionId(null);
  };

  const handleLoopStartDrag = (e: ReactMouseEvent) => {
    e.preventDefault();
    if (!wrapperRef.current) return;
    const wrapperRect = wrapperRef.current.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const beat = clientPosToGlobalBeat(wrapperRect, moveEvent.clientX, moveEvent.clientY);
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

  const handleLoopEndDrag = (e: ReactMouseEvent) => {
    e.preventDefault();
    if (!wrapperRef.current) return;
    const wrapperRect = wrapperRef.current.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // +1 — loopEnd is an exclusive boundary, so dragging targets "the beat after" the cursor.
      const beat = clientPosToGlobalBeat(wrapperRect, moveEvent.clientX, moveEvent.clientY) + 1;
      const clamped = clamp(beat, loopStart + MIN_LOOP_LENGTH_BEATS, TOTAL_BEATS);
      if (clamped !== loopEnd) onLoopChange(loopStart, clamped);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Clicking or dragging anywhere on the grid — the ruler or the empty space around
  // chords — jumps the playhead there, only while stopped (seeking a running
  // Tone.Transport is a different, riskier operation than just choosing a start point).
  // Chord blocks, loop handles, and section markers opt out since they already have
  // their own mousedown behavior (move/resize a chord, drag a loop boundary, move/
  // resize/rename a section).
  const handlePlayheadScrubStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isPlaying) return;
    const target = e.target as HTMLElement;
    if (target.closest('.chord-label') || target.closest('.loop-handle') || target.closest('.section-marker'))
      return;
    if (!wrapperRef.current) return;
    const wrapperRect = wrapperRef.current.getBoundingClientRect();

    const setFromEvent = (clientX: number, clientY: number) => {
      onPlayheadChange(clientPosToGlobalBeat(wrapperRect, clientX, clientY));
    };
    setFromEvent(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => setFromEvent(moveEvent.clientX, moveEvent.clientY);
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const loopStartRow = rowOf(loopStart);
  const loopEndHomeRow = rowOf(Math.max(0, loopEnd - 1));
  const playheadRow = clamp(rowOf(playheadBeat), 0, ROWS - 1);
  const allSegments = placements.flatMap(segmentsFor);

  return (
    <div className="chord-grid-wrapper">
      {placements.length === 0 && (
        <p className="chord-grid-hint">Drag a chord from the palette to place it here.</p>
      )}
      <div className="chord-grid-page">
        <SheetMusicHeader
          title={title}
          onTitleChange={onTitleChange}
          author={author}
          onAuthorChange={onAuthorChange}
          tempo={tempo}
          onClear={onClear}
        />
        <div className="section-toolbar">
          <button type="button" className="section-add-button" onClick={handleAddSectionClick}>
            + Section
          </button>
        </div>
        <div
          ref={wrapperRef}
          className="chord-grid"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClickCapture={handleWrapperClickCapture}
          onMouseDown={handlePlayheadScrubStart}
        >
          {Array.from({ length: ROWS }, (_, row) => {
          const rowStart = row * BEATS_PER_ROW;
          const rowEnd = rowStart + BEATS_PER_ROW;
          const rowSegments = allSegments.filter((s) => s.row === row);
          const rowSections = sections.filter((s) => rowOf(s.startBeat) === row);
          const dimBefore = clamp(loopStart - rowStart, 0, BEATS_PER_ROW);
          const dimAfter = clamp(rowEnd - loopEnd, 0, BEATS_PER_ROW);

          return (
            <div key={row} className="chord-grid-row-group">
              <div className="section-strip" style={{ height: SECTION_HEIGHT }}>
                {rowSections.map((section) => (
                  <div
                    key={section.id}
                    className="section-marker"
                    style={{ left: `${((section.startBeat - rowStart) / BEATS_PER_ROW) * 100}%` }}
                    onMouseDown={handleSectionMoveStart(section)}
                  >
                    {editingSectionId === section.id ? (
                      <input
                        className="section-marker-label-input"
                        value={editingSectionLabel}
                        autoFocus
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingSectionLabel(e.target.value)}
                        onBlur={commitEditingSection(section)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditingSection(section)();
                          else if (e.key === 'Escape') setEditingSectionId(null);
                        }}
                      />
                    ) : (
                      <span className="section-marker-label" onMouseDown={startEditingSection(section)}>
                        {section.label}
                      </span>
                    )}
                    <button
                      type="button"
                      className="section-marker-remove"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => onRemoveSection(section)}
                      aria-label={`Remove section ${section.label}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className={`loop-ruler${isPlaying ? '' : ' loop-ruler-scrubbable'}`}>
                {playheadRow === row && (
                  <div
                    className="playhead-flag"
                    style={{ left: `${((playheadBeat - rowStart) / BEATS_PER_ROW) * 100}%` }}
                  />
                )}
              </div>
              <div
                className={`chord-grid-row${isPlaying ? '' : ' chord-grid-row-scrubbable'}`}
                style={{ height: ROW_CONTENT_HEIGHT }}
              >
                {/* Loop start/end markers — repeat-sign stand-ins, sitting right at
                    the row's edge (not the exact loop beat) and inline with the
                    staff rather than up in the ruler. Still the same drag-to-set-
                    loop-range handles as before, just re-skinned/repositioned. */}
                {loopStartRow === row && (
                  <div
                    className="loop-handle loop-handle-start"
                    style={{ top: CHORD_LABEL_HEIGHT + STAFF_HEIGHT / 2 }}
                    onMouseDown={handleLoopStartDrag}
                    role="slider"
                    aria-label="Loop start"
                    aria-valuenow={loopStart}
                  >
                    𝄆
                  </div>
                )}
                {loopEndHomeRow === row && (
                  <div
                    className="loop-handle loop-handle-end"
                    style={{ top: CHORD_LABEL_HEIGHT + STAFF_HEIGHT / 2 }}
                    onMouseDown={handleLoopEndDrag}
                    role="slider"
                    aria-label="Loop end"
                    aria-valuenow={loopEnd}
                  >
                    𝄇
                  </div>
                )}
                {/* The staff itself — clef, 5 lines, bar divisions, and any imported melody
                    notes, positioned by simple fractions/pixel offsets of the row rather
                    than CSS Grid (see staffStepsAboveBottomLine in data/melody.ts for the
                    pitch → y math). */}
                <div className="staff" style={{ top: CHORD_LABEL_HEIGHT, height: STAFF_HEIGHT }}>
                  {row === 0 &&
                    (() => {
                      const { sign, letters } = keySignatureAccidentals(musicalKey, scale);
                      const stepsFor = sign === 'sharp' ? SHARP_KEY_SIG_STEPS : FLAT_KEY_SIG_STEPS;
                      const symbol = sign === 'sharp' ? '♯' : '♭';
                      const ACCIDENTAL_SPACING = 7;
                      const KEY_SIG_START_X = 24;
                      const timeSigX = KEY_SIG_START_X + letters.length * ACCIDENTAL_SPACING + 6;
                      return (
                        <>
                          <span className="staff-clef" aria-hidden="true">
                            𝄞
                          </span>
                          {letters.map((letter, i) => (
                            <span
                              key={letter}
                              className="key-sig-accidental"
                              style={{
                                left: KEY_SIG_START_X + i * ACCIDENTAL_SPACING,
                                top: STAFF_HEIGHT - stepsFor[letter] * (STAFF_LINE_GAP / 2),
                              }}
                              aria-hidden="true"
                            >
                              {symbol}
                            </span>
                          ))}
                          <div className="staff-time-signature" style={{ left: timeSigX }} aria-label="Time signature 4/4">
                            <span>4</span>
                            <span>4</span>
                          </div>
                        </>
                      );
                    })()}
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={`line-${row}-${i}`} className="staff-line" style={{ top: i * STAFF_LINE_GAP }} />
                  ))}
                  {Array.from({ length: BARS_PER_ROW + 1 }, (_, i) => (
                    <div
                      key={`bar-${row}-${i}`}
                      className={`staff-barline${row === ROWS - 1 && i === BARS_PER_ROW ? ' staff-barline-final' : ''}`}
                      style={{ left: `${(i / BARS_PER_ROW) * 100}%` }}
                    />
                  ))}
                  {melody
                    .filter((note) => note.startBeat >= rowStart && note.startBeat < rowEnd)
                    .flatMap((note, i) => {
                      const { steps, sharp } = staffStepsAboveBottomLine(note.midi);
                      const y = STAFF_HEIGHT - steps * (STAFF_LINE_GAP / 2);
                      const left = `${((note.startBeat - rowStart) / BEATS_PER_ROW) * 100}%`;
                      // Ledger lines only appear where a note actually needs one — every
                      // line-spacing step the note sits beyond the staff edge, not just a
                      // flat "out of range" line. See the derivation in CLAUDE.md's melody
                      // plan; middle C (one line below the staff) is the reference case.
                      const linesBelow = steps < 0 ? Math.floor(-steps / 2) : 0;
                      const linesAbove = steps > 8 ? Math.floor((steps - 8) / 2) : 0;
                      const elements = [
                        <div key={`note-${row}-${i}`} className="melody-note" style={{ left, top: y }} />,
                      ];
                      if (sharp) {
                        elements.push(
                          <span
                            key={`acc-${row}-${i}`}
                            className="melody-accidental"
                            style={{ left, top: y }}
                            aria-hidden="true"
                          >
                            ♯
                          </span>,
                        );
                      }
                      for (let li = 1; li <= linesBelow; li++) {
                        elements.push(
                          <div
                            key={`ledger-b-${row}-${i}-${li}`}
                            className="melody-ledger-line"
                            style={{ left, top: STAFF_HEIGHT + li * STAFF_LINE_GAP }}
                          />,
                        );
                      }
                      for (let li = 1; li <= linesAbove; li++) {
                        elements.push(
                          <div
                            key={`ledger-a-${row}-${i}-${li}`}
                            className="melody-ledger-line"
                            style={{ left, top: -li * STAFF_LINE_GAP }}
                          />,
                        );
                      }
                      return elements;
                    })}
                </div>
                {dimBefore > 0 && (
                  <div
                    className="loop-dim"
                    style={{ left: 0, width: `${(dimBefore / BEATS_PER_ROW) * 100}%` }}
                  />
                )}
                {dimAfter > 0 && (
                  <div
                    className="loop-dim"
                    style={{
                      left: `${((BEATS_PER_ROW - dimAfter) / BEATS_PER_ROW) * 100}%`,
                      width: `${(dimAfter / BEATS_PER_ROW) * 100}%`,
                    }}
                  />
                )}
                {playheadRow === row && (
                  <div
                    className="playhead"
                    style={{ left: `${((playheadBeat - rowStart) / BEATS_PER_ROW) * 100}%` }}
                  />
                )}
                {rowSegments.map((seg) => {
                  const placement = seg.placement;
                  const chord = resolveSelection(musicalKey, scale, placement.selection);
                  const classNames = [
                    'chord-label',
                    selectedIds.has(placement.id) && 'chord-label-selected',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <div
                      key={`${placement.id}-${seg.row}`}
                      className={classNames}
                      style={{
                        left: `${(seg.localStart / BEATS_PER_ROW) * 100}%`,
                        width: `${(seg.span / BEATS_PER_ROW) * 100}%`,
                        height: CHORD_LABEL_HEIGHT,
                      }}
                    >
                      <div
                        className="chord-label-body"
                        onMouseDown={handleMoveStart(placement)}
                        onClick={handleChordClick(placement, chord)}
                      >
                        <span className="chord-label-name">
                          {!seg.isFirst && '⟵ '}
                          {(() => {
                            const { root, core, ext } = chordNameParts(chord, notationStyle);
                            return (
                              <>
                                {root}
                                {core}
                                {ext && <sup className="chord-ext">{ext}</sup>}
                              </>
                            );
                          })()}
                          {!seg.isLast && ' ⟶'}
                        </span>
                      </div>
                      {seg.isFirst && (
                        <button
                          type="button"
                          className="chord-block-remove"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => onRemove(placement)}
                          aria-label="Remove chord"
                        >
                          ×
                        </button>
                      )}
                      {seg.isLast && (
                        <div className="resize-handle" onMouseDown={handleResizeStart(placement)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
