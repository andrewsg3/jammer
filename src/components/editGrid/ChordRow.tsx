import type { MouseEvent as ReactMouseEvent } from 'react';
import { chordNameParts, resolveSelection } from '../../data/progressions';
import type { Chord, ChordPlacement, NotationStyle, ScaleName } from '../../data/progressions';
import { CHORD_TRACK_BASE, clientXToLocalBeatFloor, colLine } from './gridMath';
import type { LanedChordSegment } from './gridMath';

type Props = {
  beatsPerSystem: number;
  laned: LanedChordSegment[];
  maxLane: number;
  musicalKey: string;
  scale: ScaleName;
  notationStyle: NotationStyle;
  selectedIds: Set<string>;
  hasPendingChord: boolean;
  onLaneMouseDown: (lane: number, localBeat: number) => void;
  onChordMouseDown: (placement: ChordPlacement) => (e: ReactMouseEvent) => void;
  onChordClick: (placement: ChordPlacement, chord: Chord) => (e: ReactMouseEvent) => void;
  onResizeMouseDown: (placement: ChordPlacement) => (e: ReactMouseEvent) => void;
};

/** Chord blocks for one system — grid-column-spanning blocks instead of
 * ChordGrid.tsx's percentage-of-row absolute positioning. Whole-beat columns
 * (COL_UNIT_BEATS is a half-beat unit shared with melody, but a chord's own
 * click-to-place target snaps to the nearest whole beat via onLaneMouseDown's
 * caller). */
export function ChordRow({
  beatsPerSystem,
  laned,
  maxLane,
  musicalKey,
  scale,
  notationStyle,
  selectedIds,
  hasPendingChord,
  onLaneMouseDown,
  onChordMouseDown,
  onChordClick,
  onResizeMouseDown,
}: Props) {
  return (
    <>
      {Array.from({ length: maxLane + 1 }, (_, lane) => (
        <div
          key={`chord-lane-${lane}`}
          className={`chord-lane${hasPendingChord ? ' chord-lane-armed' : ''}`}
          style={{ gridRow: CHORD_TRACK_BASE + lane, gridColumn: '1 / -1' }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const localBeat = clientXToLocalBeatFloor(rect, e.clientX, beatsPerSystem);
            onLaneMouseDown(lane, localBeat);
          }}
        />
      ))}
      {laned.map((seg) => {
        const chord = resolveSelection(musicalKey, scale, seg.placement.selection);
        const { root, core, ext, bass } = chordNameParts(chord, notationStyle);
        const selected = selectedIds.has(seg.placement.id);
        return (
          <div
            key={`${seg.placement.id}-${seg.system}`}
            className={`chord-block${selected ? ' chord-block-selected' : ''}`}
            style={{
              gridRow: CHORD_TRACK_BASE + seg.lane,
              gridColumn: `${colLine(seg.localStart)} / ${colLine(seg.localStart + seg.span)}`,
            }}
            onMouseDown={seg.isFirst ? onChordMouseDown(seg.placement) : undefined}
            onClick={onChordClick(seg.placement, chord)}
          >
            {seg.isFirst && (
              <span className="chord-block-name">
                {root}
                {core}
                {ext && <sup className="chord-ext">{ext}</sup>}
                {bass}
              </span>
            )}
            {seg.isLast && (
              <div
                className="chord-block-resize-handle"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onResizeMouseDown(seg.placement)(e);
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
