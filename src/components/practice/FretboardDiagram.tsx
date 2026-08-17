import { absoluteFretting, rootFretFor } from '../../data/fretboard';
import type { ShapeFretting } from '../../data/fretboard';

const STRING_COUNT = 6;
// How many fret cells to draw right of the shape's own root fret -- every
// CAGED_SHAPES entry today only ever uses relative frets 0-2, so 3 cells
// (with a little headroom) comfortably fits all of them without needing to
// scale per-shape.
const FRETS_SHOWN = 4;

const MARGIN = 18;
const STRING_GAP = 14;
const FRET_GAP = 22;
// Frets run left-to-right now (see the rotation note below), strings
// top-to-bottom -- so it's FRET_GAP*FRETS_SHOWN driving width and
// STRING_GAP*(STRING_COUNT-1) driving height, the reverse of the
// pre-rotation layout.
const WIDTH = MARGIN * 2 + FRET_GAP * FRETS_SHOWN;
const HEIGHT = MARGIN * 2 + STRING_GAP * (STRING_COUNT - 1);
const DOT_RADIUS = 5;

// Top-to-bottom physical order: high e first, low E last -- i.e. low E sits
// at the bottom row, matching how the neck looks from the player's own
// fretting hand once frets run left-to-right (nut on the left) instead of
// top-to-bottom -- per direct user request ("rotated 90deg to have the low
// E string at bottom"), the inverse of the un-rotated wall-poster convention
// this app used before (strings left-to-right, low E leftmost, frets
// top-to-bottom) that ScaleFretboardDiagram.tsx still... no, both were
// rotated together, see that component's own note.
const STRING_ORDER: (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6];

type Props = {
  root: string;
  shape: ShapeFretting;
};

/** A single movable CAGED-style chord shape, drawn as a small hand-rolled SVG
 * fretboard diagram (6 strings, a few frets, dots for fretted notes, "x" for
 * muted strings) -- same "good enough to read at a glance, not a full
 * engraving system" spirit as this app's melody notation (see CLAUDE.md's
 * "How melody notation works"). Nothing here reuses VexFlow; a fretboard grid
 * isn't something a music-notation engraver renders anyway. Frets run
 * left-to-right (nut side on the left) with low E at the bottom row -- a
 * rotated layout from this component's original top-to-bottom-frets,
 * low-E-on-the-left orientation, per direct user request to match how the
 * neck actually looks to the player's own fretting hand. */
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
        {/* Strings -- horizontal, high e at top, low E at bottom */}
        {STRING_ORDER.map((stringNum, i) => (
          <line
            key={`string-${stringNum}`}
            x1={MARGIN}
            y1={MARGIN + i * STRING_GAP}
            x2={MARGIN + FRET_GAP * FRETS_SHOWN}
            y2={MARGIN + i * STRING_GAP}
            className="fretboard-string"
          />
        ))}
        {/* Frets -- vertical, nut on the left (thick) only in open position;
            otherwise a plain fret line, labeled by the barre fret number below. */}
        {Array.from({ length: FRETS_SHOWN + 1 }, (_, col) => (
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
            {barreFret}fr
          </text>
        )}
        {/* Muted/fretted markers */}
        {STRING_ORDER.map((stringNum, i) => {
          const fret = frettedByString.get(stringNum);
          const y = MARGIN + i * STRING_GAP;
          if (fret === null || fret === undefined) {
            return (
              <text
                key={`mute-${stringNum}`}
                x={MARGIN - 6}
                y={y}
                dominantBaseline="central"
                className="fretboard-mute"
                textAnchor="end"
              >
                ×
              </text>
            );
          }
          const relativeFret = fret - barreFret;
          const x = MARGIN + (relativeFret + 0.5) * FRET_GAP;
          return <circle key={`dot-${stringNum}`} cx={x} cy={y} r={DOT_RADIUS} className="fretboard-dot" />;
        })}
      </svg>
      <div className="fretboard-diagram-label">{shape.shape}-shape</div>
    </div>
  );
}
