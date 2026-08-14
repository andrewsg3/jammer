import { EDIT_BARS_PER_ROW, RULER_TRACK, colLine } from './gridMath';

type Props = {
  systemIndex: number;
  beatsPerBar: number;
};

/** Bar ruler for one system — just the bar number, centered, one cell per
 * bar. Matches Hookpad's own ruler (bar numbers only, no per-beat sub-ticks).
 * Purely a display aid, not interactive. */
export function RulerRow({ systemIndex, beatsPerBar }: Props) {
  const bars = Array.from({ length: EDIT_BARS_PER_ROW }, (_, i) => i);

  return (
    <>
      {bars.map((bar) => {
        const barLocalStart = bar * beatsPerBar;
        const globalBarNumber = systemIndex * EDIT_BARS_PER_ROW + bar + 1;
        return (
          <div
            key={`bar-${bar}`}
            className="ruler-bar-number"
            style={{ gridRow: RULER_TRACK, gridColumn: `${colLine(barLocalStart)} / ${colLine(barLocalStart + beatsPerBar)}` }}
          >
            {globalBarNumber}
          </div>
        );
      })}
    </>
  );
}
