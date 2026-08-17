import { absoluteFretting, rootFretFor } from '../../data/fretboard';
import type { ShapeFretting } from '../../data/fretboard';

const STRING_COUNT = 6;
// How many fret cells to draw below the shape's own root fret -- every
// CAGED_SHAPES entry today only ever uses relative frets 0-2, so 3 cells
// (with a little headroom) comfortably fits all of them without needing to
// scale per-shape.
const FRETS_SHOWN = 4;

const MARGIN = 18;
const STRING_GAP = 14;
const FRET_GAP = 22;
const WIDTH = MARGIN * 2 + STRING_GAP * (STRING_COUNT - 1);
const HEIGHT = MARGIN * 2 + FRET_GAP * FRETS_SHOWN;
const DOT_RADIUS = 5;

// Physical string order left-to-right on a chord diagram is low E to high E,
// i.e. string 6 first -- the reverse of ShapeFretting.frets' own index order
// isn't reversed (both already go 6,5,4,3,2,1), so this is just documenting
// that alignment, not transforming anything.
const STRING_ORDER: (6 | 5 | 4 | 3 | 2 | 1)[] = [6, 5, 4, 3, 2, 1];

type Props = {
  root: string;
  shape: ShapeFretting;
};

/** A single movable CAGED-style chord shape, drawn as a small hand-rolled SVG
 * fretboard diagram (6 strings, a few frets, dots for fretted notes, "x" for
 * muted strings) -- same "good enough to read at a glance, not a full
 * engraving system" spirit as this app's melody notation (see CLAUDE.md's
 * "How melody notation works"). Nothing here reuses VexFlow; a fretboard grid
 * isn't something a music-notation engraver renders anyway. */
export function FretboardDiagram({ root, shape }: Props) {
  const barreFret = rootFretFor(root, shape);
  const fretting = absoluteFretting(root, shape);
  const frettedByString = new Map(fretting.map((f) => [f.string, f.fret]));
  const isOpenPosition = barreFret === 0;

  return (
    <div className="fretboard-diagram">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={`${shape.shape}-shape fretting, barred at fret ${barreFret}`}
      >
        {/* Strings */}
        {STRING_ORDER.map((stringNum, i) => (
          <line
            key={`string-${stringNum}`}
            x1={MARGIN + i * STRING_GAP}
            y1={MARGIN}
            x2={MARGIN + i * STRING_GAP}
            y2={MARGIN + FRET_GAP * FRETS_SHOWN}
            className="fretboard-string"
          />
        ))}
        {/* Frets -- the top line is thick (the nut) only in open position;
            otherwise it's a plain fret line and the barre fret number labels it. */}
        {Array.from({ length: FRETS_SHOWN + 1 }, (_, row) => (
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
            {barreFret}fr
          </text>
        )}
        {/* Muted/fretted markers */}
        {STRING_ORDER.map((stringNum, i) => {
          const fret = frettedByString.get(stringNum);
          const x = MARGIN + i * STRING_GAP;
          if (fret === null || fret === undefined) {
            return (
              <text key={`mute-${stringNum}`} x={x} y={MARGIN - 6} className="fretboard-mute" textAnchor="middle">
                ×
              </text>
            );
          }
          const relativeFret = fret - barreFret;
          const y = MARGIN + (relativeFret + 0.5) * FRET_GAP;
          return <circle key={`dot-${stringNum}`} cx={x} cy={y} r={DOT_RADIUS} className="fretboard-dot" />;
        })}
      </svg>
      <div className="fretboard-diagram-label">{shape.shape}-shape</div>
    </div>
  );
}
