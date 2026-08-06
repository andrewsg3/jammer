import { useEffect, useRef, useState } from 'react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { chordName, deserializeSelection, resolveSelection } from '../data/progressions';
import type { ChordPlacement, ChordSelection, ScaleName } from '../data/progressions';

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
  playheadBeat: number | null;
  onDropChord: (selection: ChordSelection, startBeat: number) => void;
  onReplaceChord: (placement: ChordPlacement, selection: ChordSelection) => void;
  onResize: (placement: ChordPlacement, newLength: number) => void;
  onMove: (placement: ChordPlacement, newStartBeat: number) => void;
  onRemove: (placement: ChordPlacement) => void;
  onClear: () => void;
  onLoopChange: (loopStart: number, loopEnd: number) => void;
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

function crossesRow(startBeat: number, lengthBeats: number): boolean {
  return rowOf(startBeat) !== rowOf(startBeat + lengthBeats - 1);
}

function canPlace(
  placements: ChordPlacement[],
  excludeId: string | null,
  startBeat: number,
  lengthBeats: number,
): boolean {
  if (startBeat < 0 || lengthBeats <= 0 || startBeat + lengthBeats > TOTAL_BEATS) return false;
  if (crossesRow(startBeat, lengthBeats)) return false;
  return placements.every((p) => p.id === excludeId || !overlaps(p, startBeat, lengthBeats));
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
  onDropChord,
  onReplaceChord,
  onResize,
  onMove,
  onRemove,
  onClear,
  onLoopChange,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Selection follows the placement list — if it was removed elsewhere (Clear,
  // preset load, the × button), drop the now-dangling selection.
  useEffect(() => {
    if (selectedId !== null && !placements.some((p) => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [placements, selectedId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const placement = placements.find((p) => p.id === selectedId);
        if (placement) {
          e.preventDefault();
          onRemove(placement);
        }
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, placements, onRemove]);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Clicking anywhere in the grid that isn't a chord block clears the selection.
  const handleWrapperClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('.chord-block')) setSelectedId(null);
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

    if (!canPlace(placements, null, dropBeat, 4)) return; // reject overlapping/row-crossing drops

    onDropChord(selection, dropBeat);
  };

  const handleResizeStart = (placement: ChordPlacement) => (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startLength = placement.lengthBeats;
    const beatWidth = (wrapperRef.current?.getBoundingClientRect().width ?? 0) / BEATS_PER_ROW;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaBeats = Math.round((moveEvent.clientX - startX) / beatWidth);
      const target = Math.max(MIN_LENGTH_BEATS, startLength + deltaBeats);
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
    const startX = e.clientX;
    const originStartBeat = placement.startBeat;
    let lastEmitted = originStartBeat;
    const beatWidth = (wrapperRef.current?.getBoundingClientRect().width ?? 0) / BEATS_PER_ROW;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaBeats = Math.round((moveEvent.clientX - startX) / beatWidth);
      const target = originStartBeat + deltaBeats;
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

  const loopStartRow = rowOf(loopStart);
  const loopEndHomeRow = rowOf(Math.max(0, loopEnd - 1));
  const playheadRow = playheadBeat === null ? null : clamp(rowOf(playheadBeat), 0, ROWS - 1);

  return (
    <div className="chord-grid-wrapper">
      {placements.length === 0 && (
        <p className="chord-grid-hint">Drag a chord from the palette to place it here.</p>
      )}
      <div
        ref={wrapperRef}
        className="chord-grid"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClickCapture={handleWrapperClickCapture}
      >
        {Array.from({ length: ROWS }, (_, row) => {
          const rowStart = row * BEATS_PER_ROW;
          const rowEnd = rowStart + BEATS_PER_ROW;
          const rowPlacements = placements.filter((p) => rowOf(p.startBeat) === row);
          const dimBefore = clamp(loopStart - rowStart, 0, BEATS_PER_ROW);
          const dimAfter = clamp(rowEnd - loopEnd, 0, BEATS_PER_ROW);

          return (
            <div key={row} className="chord-grid-row-group">
              <div className="loop-ruler">
                {loopStartRow === row && (
                  <div
                    className="loop-handle loop-handle-start"
                    style={{ left: `${((loopStart - rowStart) / BEATS_PER_ROW) * 100}%` }}
                    onMouseDown={handleLoopStartDrag}
                  />
                )}
                {loopEndHomeRow === row && (
                  <div
                    className="loop-handle loop-handle-end"
                    style={{ left: `${((loopEnd - rowStart) / BEATS_PER_ROW) * 100}%` }}
                    onMouseDown={handleLoopEndDrag}
                  />
                )}
              </div>
              <div
                className="chord-grid-row"
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
                {playheadRow === row && playheadBeat !== null && (
                  <div
                    className="playhead"
                    style={{ left: `${((playheadBeat - rowStart) / BEATS_PER_ROW) * 100}%` }}
                  />
                )}
                {rowPlacements.map((placement) => {
                  const localStart = placement.startBeat - rowStart;
                  const chord = resolveSelection(musicalKey, scale, placement.selection);
                  return (
                    <div
                      key={placement.id}
                      className={`chord-block${selectedId === placement.id ? ' chord-block-selected' : ''}`}
                      style={{
                        gridColumn: `${localStart + 1} / span ${placement.lengthBeats}`,
                        gridRow: 1,
                      }}
                    >
                      <div
                        className="chord-block-body"
                        onMouseDown={handleMoveStart(placement)}
                        onClick={() => setSelectedId(placement.id)}
                      >
                        <span className="chord-block-name">{chordName(chord)}</span>
                      </div>
                      <button
                        type="button"
                        className="chord-block-remove"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => onRemove(placement)}
                        aria-label="Remove chord"
                      >
                        ×
                      </button>
                      <div className="resize-handle" onMouseDown={handleResizeStart(placement)} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="clear-button" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
