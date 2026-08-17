import { findPositionNotes, positionStartFret, SCALE_BOX_FRETS } from '../../data/scaleFretboard';
import type { ScalePosition } from '../../data/scaleFretboard';

const STRING_COUNT = 6;
const MARGIN = 18;
const STRING_GAP = 14;
const FRET_GAP = 22;
// Frets run left-to-right, strings top-to-bottom -- see FretboardDiagram.tsx's
// own note on the rotated layout this and that component share.
const WIDTH = MARGIN * 2 + FRET_GAP * SCALE_BOX_FRETS;
const HEIGHT = MARGIN * 2 + STRING_GAP * (STRING_COUNT - 1);
const DOT_RADIUS = 5;

// Top-to-bottom physical order: high e first, low E last -- matches
// FretboardDiagram.tsx's own STRING_ORDER.
const STRING_ORDER: (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6];

type Props = {
  root: string;
  intervals: number[];
  position: ScalePosition;
  label: string;
};

/**
 * A scale/arpeggio "box" for one CAGED position -- same small hand-rolled SVG
 * fretboard as FretboardDiagram.tsx (chord shapes), but wider (multiple dots
 * per string, not one) and generated rather than curated -- see
 * data/scaleFretboard.ts's own doc comment for why that split is the right
 * one here, unlike chord voicings. Root notes get a distinct fill so the box
 * still reads as "rooted" at a glance, same idea as CAGED_SHAPES chord
 * diagrams always naming their own root. Frets run left-to-right with low E
 * at the bottom row, same rotated layout as FretboardDiagram.tsx.
 */
export function ScaleFretboardDiagram({ root, intervals, position, label }: Props) {
  const startFret = positionStartFret(root, position);
  const notes = findPositionNotes(root, intervals, position);
  const isOpenPosition = startFret === 0;

  return (
    <div className="fretboard-diagram">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={`${position}-shape position, ${label}, starting at fret ${startFret}`}
      >
        {STRING_ORDER.map((stringNum, i) => (
          <line
            key={`string-${stringNum}`}
            x1={MARGIN}
            y1={MARGIN + i * STRING_GAP}
            x2={MARGIN + FRET_GAP * SCALE_BOX_FRETS}
            y2={MARGIN + i * STRING_GAP}
            className="fretboard-string"
          />
        ))}
        {Array.from({ length: SCALE_BOX_FRETS + 1 }, (_, col) => (
          <line
            key={`fret-${col}`}
            x1={MARGIN + col * FRET_GAP}
            y1={MARGIN}
            x2={MARGIN + col * FRET_GAP}
            y2={MARGIN + STRING_GAP * (STRING_COUNT - 1)}
            className={col === 0 && isOpenPosition ? 'fretboard-fret fretboard-nut' : 'fretboard-fret'}
          />
        ))}
        {!isOpenPosition && (
          <text
            x={MARGIN + FRET_GAP * 0.7}
            y={MARGIN + STRING_GAP * (STRING_COUNT - 1) + 12}
            className="fretboard-fret-label"
            textAnchor="middle"
          >
            {startFret}fr
          </text>
        )}
        {notes.map((n) => {
          const i = STRING_ORDER.indexOf(n.string);
          const y = MARGIN + i * STRING_GAP;
          const relativeFret = n.fret - startFret;
          const x = MARGIN + (relativeFret + 0.5) * FRET_GAP;
          return (
            <circle
              key={`${n.string}-${n.fret}`}
              cx={x}
              cy={y}
              r={DOT_RADIUS}
              className={n.isRoot ? 'fretboard-dot fretboard-dot--root' : 'fretboard-dot'}
            />
          );
        })}
      </svg>
      <div className="fretboard-diagram-label">
        {position}-shape · {label}
      </div>
    </div>
  );
}
