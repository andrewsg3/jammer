import { findPositionNotes, positionStartFret, SCALE_BOX_FRETS } from '../../data/scaleFretboard';
import type { ScalePosition } from '../../data/scaleFretboard';

const STRING_COUNT = 6;
const MARGIN = 18;
const STRING_GAP = 14;
const FRET_GAP = 22;
const WIDTH = MARGIN * 2 + STRING_GAP * (STRING_COUNT - 1);
const HEIGHT = MARGIN * 2 + FRET_GAP * SCALE_BOX_FRETS;
const DOT_RADIUS = 5;

// Same low-E-to-high-E left-to-right physical order FretboardDiagram.tsx uses.
const STRING_ORDER: (6 | 5 | 4 | 3 | 2 | 1)[] = [6, 5, 4, 3, 2, 1];

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
 * diagrams always naming their own root.
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
            x1={MARGIN + i * STRING_GAP}
            y1={MARGIN}
            x2={MARGIN + i * STRING_GAP}
            y2={MARGIN + FRET_GAP * SCALE_BOX_FRETS}
            className="fretboard-string"
          />
        ))}
        {Array.from({ length: SCALE_BOX_FRETS + 1 }, (_, row) => (
          <line
            key={`fret-${row}`}
            x1={MARGIN}
            y1={MARGIN + row * FRET_GAP}
            x2={MARGIN + STRING_GAP * (STRING_COUNT - 1)}
            y2={MARGIN + row * FRET_GAP}
            className={row === 0 && isOpenPosition ? 'fretboard-fret fretboard-nut' : 'fretboard-fret'}
          />
        ))}
        {!isOpenPosition && (
          <text x={MARGIN - 6} y={MARGIN + FRET_GAP * 0.7} className="fretboard-fret-label" textAnchor="end">
            {startFret}fr
          </text>
        )}
        {notes.map((n) => {
          const i = STRING_ORDER.indexOf(n.string);
          const x = MARGIN + i * STRING_GAP;
          const relativeFret = n.fret - startFret;
          const y = MARGIN + (relativeFret + 0.5) * FRET_GAP;
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
