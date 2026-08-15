import type { MouseEvent as ReactMouseEvent } from 'react';
import { DEGREE_COLORS, chordNameParts, chordRootScaleDegree, resolveSelection } from '../../data/progressions';
import type { Chord, ChordPlacement, NotationStyle, ScaleName } from '../../data/progressions';
import { NARROW_CHORD_BEATS, clientXToLocalBeatFloor, colLine } from './gridMath';
import type { LanedChordSegment } from './gridMath';

// Same rainbow ChordPalette.tsx's diatonic buttons and MelodyGrid.tsx's notes
// already use, at reduced alpha so the dark chord-symbol label stays legible
// over any of the 7 colors -- unlike ChordPalette's own degreeColorFor,
// chordRootScaleDegree colors *every* placed chord (borrowed/secondary-
// dominant/chromatic included), not just literal diatonic selections, since a
// block on the grid is a real chord that actually sits somewhere on the
// diatonic-or-a-semitone-off spectrum regardless of which picker produced it.
function chordBlockBackground(chord: Chord, key: string, scale: ScaleName): string {
  const { degree, semitoneOffset } = chordRootScaleDegree(chord.root, key, scale);
  const own = DEGREE_COLORS[degree];
  if (semitoneOffset === 0) return `color-mix(in srgb, ${own} 20%, transparent)`;
  // Chromatic root (a semitone above `degree`, this app's only case -- see
  // nearestScaleDegree's own doc comment): striped between its own degree's
  // color and the next one up, same two-color convention MelodyGrid.tsx uses
  // for a sharped melody note.
  const next = DEGREE_COLORS[(degree + 1) % 7];
  const a = `color-mix(in srgb, ${own} 20%, transparent)`;
  const b = `color-mix(in srgb, ${next} 20%, transparent)`;
  return `repeating-linear-gradient(45deg, ${a} 0px, ${a} 4px, ${b} 4px, ${b} 8px)`;
}

function chordBlockBorderColor(chord: Chord, key: string, scale: ScaleName): string {
  const { degree, semitoneOffset } = chordRootScaleDegree(chord.root, key, scale);
  const own = DEGREE_COLORS[degree];
  if (semitoneOffset === 0) return `color-mix(in srgb, ${own} 55%, transparent)`;
  const next = DEGREE_COLORS[(degree + 1) % 7];
  return `color-mix(in srgb, ${own} 40%, ${next})`;
}

type Props = {
  beatsPerSystem: number;
  chordTrackBase: number;
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
  chordTrackBase,
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
          className={`chord-lane${lane === 0 ? ' chord-lane-first' : ''}${lane === maxLane ? ' chord-lane-last' : ''}${hasPendingChord ? ' chord-lane-armed' : ''}`}
          style={{ gridRow: chordTrackBase + lane, gridColumn: '1 / -1' }}
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
            className={`chord-block${selected ? ' chord-block-selected' : ''}${seg.span < NARROW_CHORD_BEATS ? ' chord-block-narrow' : ''}`}
            style={{
              gridRow: chordTrackBase + seg.lane,
              gridColumn: `${colLine(seg.localStart)} / ${colLine(seg.localStart + seg.span)}`,
              background: chordBlockBackground(chord, musicalKey, scale),
              borderColor: chordBlockBorderColor(chord, musicalKey, scale),
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
