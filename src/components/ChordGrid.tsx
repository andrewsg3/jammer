import { useEffect, useRef, useState } from 'react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { chordName, deserializeSelection, resolveSelection } from '../data/progressions';
import type { Chord, ChordPlacement, ChordSelection, ScaleName } from '../data/progressions';
import { SheetMusicHeader } from './SheetMusicHeader';

// 12 rows of 4 bars — a full lead-sheet page (A4-ish proportions), not just a loop snippet.
export const GRID_BARS = 48;
const BEATS_PER_BAR = 4;
const BARS_PER_ROW = 4;
const BEATS_PER_ROW = BARS_PER_ROW * BEATS_PER_BAR; // 16
export const TOTAL_BEATS = GRID_BARS * BEATS_PER_BAR; // 192
const ROWS = GRID_BARS / BARS_PER_ROW; // 12

const ROW_HEIGHT = 94; // px — ruler (14) + cell row (64) + row gap (16), for Y-position math
const MIN_LENGTH_BEATS = 1; // 1/4 bar
const MIN_LOOP_LENGTH_BEATS = 1;

type Props = {
  placements: ChordPlacement[];
  musicalKey: string;
  scale: ScaleName;
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

/** Converts a mouse position (relative to the whole multi-row wrapper) into a global beat index. */
function clientPosToGlobalBeat(wrapperRect: DOMRect, clientX: number, clientY: number): number {
  const beatWidth = wrapperRect.width / BEATS_PER_ROW; // row width is fluid — fills the container
  const row = clamp(Math.floor((clientY - wrapperRect.top) / ROW_HEIGHT), 0, ROWS - 1);
  const beatInRow = clamp(Math.floor((clientX - wrapperRect.left) / beatWidth), 0, BEATS_PER_ROW - 1);
  return row * BEATS_PER_ROW + beatInRow;
}

export function ChordGrid({
  placements,
  musicalKey,
  scale,
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
    if (!(e.target as HTMLElement).closest('.chord-block')) {
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
  // Chord blocks and loop handles opt out since they already have their own mousedown
  // behavior (move/resize a chord, drag a loop boundary).
  const handlePlayheadScrubStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isPlaying) return;
    const target = e.target as HTMLElement;
    if (target.closest('.chord-block') || target.closest('.loop-handle')) return;
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
        />
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
          const dimBefore = clamp(loopStart - rowStart, 0, BEATS_PER_ROW);
          const dimAfter = clamp(rowEnd - loopEnd, 0, BEATS_PER_ROW);

          return (
            <div key={row} className="chord-grid-row-group">
              <div className={`loop-ruler${isPlaying ? '' : ' loop-ruler-scrubbable'}`}>
                {playheadRow === row && (
                  <div
                    className="playhead-flag"
                    style={{ left: `${((playheadBeat - rowStart) / BEATS_PER_ROW) * 100}%` }}
                  />
                )}
                {loopStartRow === row && (
                  <div
                    className="loop-handle loop-handle-start"
                    style={{ left: `${((loopStart - rowStart) / BEATS_PER_ROW) * 100}%` }}
                    onMouseDown={handleLoopStartDrag}
                  >
                    <span className="loop-handle-dots" />
                  </div>
                )}
                {loopEndHomeRow === row && (
                  <div
                    className="loop-handle loop-handle-end"
                    style={{ left: `${((loopEnd - rowStart) / BEATS_PER_ROW) * 100}%` }}
                    onMouseDown={handleLoopEndDrag}
                  >
                    <span className="loop-handle-dots" />
                  </div>
                )}
              </div>
              <div
                className={`chord-grid-row${isPlaying ? '' : ' chord-grid-row-scrubbable'}`}
                style={{ gridTemplateColumns: `repeat(${BEATS_PER_ROW}, 1fr)` }}
              >
                {Array.from({ length: BEATS_PER_ROW }, (_, i) => (
                  <div
                    key={`cell-${row}-${i}`}
                    className={`grid-cell${(i + 1) % BEATS_PER_BAR === 0 ? ' bar-line' : ''}`}
                    style={{ gridColumn: i + 1, gridRow: 1 }}
                  />
                ))}
                {dimBefore > 0 && (
                  <div className="loop-dim" style={{ gridColumn: `1 / span ${dimBefore}`, gridRow: 1 }} />
                )}
                {dimAfter > 0 && (
                  <div
                    className="loop-dim"
                    style={{ gridColumn: `${BEATS_PER_ROW - dimAfter + 1} / span ${dimAfter}`, gridRow: 1 }}
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
                    'chord-block',
                    selectedIds.has(placement.id) && 'chord-block-selected',
                    !seg.isFirst && 'chord-block-continued',
                    !seg.isLast && 'chord-block-continues',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <div
                      key={`${placement.id}-${seg.row}`}
                      className={classNames}
                      style={{
                        gridColumn: `${seg.localStart + 1} / span ${seg.span}`,
                        gridRow: 1,
                      }}
                    >
                      <div
                        className="chord-block-body"
                        onMouseDown={handleMoveStart(placement)}
                        onClick={handleChordClick(placement, chord)}
                      >
                        <span className="chord-block-name">
                          {!seg.isFirst && '⟵ '}
                          {chordName(chord)}
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
      <button type="button" className="clear-button" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
