import { findPositionNotes, positionStartFret, SCALE_BOX_FRETS } from '../../data/scaleFretboard';
import type { ScalePosition } from '../../data/scaleFretboard';

const STRING_COUNT = 6;
// Sized much larger than a typical hand-rolled fretboard diagram, per direct
// user request -- this is the Practice tab's own primary visual (it's what's
// shown while you play), not a small reference glyph like FretboardDiagram.tsx's
// chord-popover diagrams, so it can afford to dominate the scale panel rather
// than sit modestly inside it.
const MARGIN = 40;
const STRING_GAP = 40;
const FRET_GAP = 62;
// SCALE_BOX_FRETS is "how many frets beyond the start fret" (see
// data/scaleFretboard.ts's own doc comment) -- the box actually has to render
// one more fret position than that (startFret..startFret+SCALE_BOX_FRETS
// inclusive), or findPositionNotes' own last column of real scale tones would
// render past the grid's right edge with no fret lines behind it, silently
// looking like empty space rather than notes cut off.
const BOX_FRET_COUNT = SCALE_BOX_FRETS + 1;
// Frets run left-to-right, strings top-to-bottom -- see FretboardDiagram.tsx's
// own note on the rotated layout this and that component share.
const WIDTH = MARGIN * 2 + FRET_GAP * BOX_FRET_COUNT;
// Extra room below the strings for the start-fret label ("8fr") -- it used to
// share the plain bottom MARGIN with barely any clearance from the last
// string row, reading as fouling the diagram. Its own vertical offset
// (LABEL_OFFSET_Y below) and font size (.scale-fretboard-diagram
// .fretboard-fret-label in index.css) both grew per direct user request, so
// the box needs genuinely more height, not just a repositioned label within
// the same old margin.
const LABEL_OFFSET_Y = 46;
const HEIGHT = MARGIN + STRING_GAP * (STRING_COUNT - 1) + LABEL_OFFSET_Y + 20;
const DOT_RADIUS = 11;

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
 * one here, unlike chord voicings. Root notes render in the app's accent
 * color, every other scale tone in plain black -- the `.scale-fretboard-
 * diagram` class above scopes that override to just this component's own
 * dots in index.css, deliberately not touching the shared `.fretboard-dot`/
 * `.fretboard-dot--root` rules FretboardDiagram.tsx (the chord-popover
 * diagrams, which never even use the `--root` variant) also uses -- per
 * direct user request, so the CAGED chord-shape popover stays visually
 * unchanged. Every dot also carries its own scale-degree number (data/
 * scaleFretboard.ts's `degreeLabel` -- "1", "b3", "#5"-as-"b6", etc., see
 * that file's own note on the one spelling ambiguity this glosses over),
 * root dots keeping the accent color per direct user request while the
 * label text itself flips to a contrasting color on top of whichever dot
 * color it's sitting on (index.css). Frets run left-to-right with low E
 * at the bottom row, same rotated layout as FretboardDiagram.tsx.
 */
export function ScaleFretboardDiagram({ root, intervals, position, label }: Props) {
  const startFret = positionStartFret(root, position);
  const notes = findPositionNotes(root, intervals, position);
  const isOpenPosition = startFret === 0;

  return (
    <div className="fretboard-diagram scale-fretboard-diagram">
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
            x2={MARGIN + FRET_GAP * BOX_FRET_COUNT}
            y2={MARGIN + i * STRING_GAP}
            className="fretboard-string"
          />
        ))}
        {Array.from({ length: BOX_FRET_COUNT + 1 }, (_, col) => (
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
            y={MARGIN + STRING_GAP * (STRING_COUNT - 1) + LABEL_OFFSET_Y}
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
            <g key={`${n.string}-${n.fret}`}>
              <circle cx={x} cy={y} r={DOT_RADIUS} className={n.isRoot ? 'fretboard-dot fretboard-dot--root' : 'fretboard-dot'} />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                className={n.isRoot ? 'fretboard-dot-label fretboard-dot-label--root' : 'fretboard-dot-label'}
              >
                {n.degreeLabel}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="fretboard-diagram-label">
        {position}-SHAPE · {label}
      </div>
    </div>
  );
}
