import type { MouseEvent as ReactMouseEvent } from 'react';
import { EDIT_BARS_PER_ROW, RULER_TRACK, colLine } from './gridMath';

type Props = {
  systemIndex: number;
  beatsPerBar: number;
  // Click-or-drag-to-scrub the playhead -- the ruler is always clickable even
  // when a chart is fully packed with chords (unlike the chord row, which has
  // no empty cells to click through then) or when the loop row is in use for
  // its own job (setting the loop range, not the playhead).
  onScrubMouseDown: (e: ReactMouseEvent) => void;
};

/** Bar ruler for one system — just the bar number, centered, one cell per
 * bar. Matches Hookpad's own ruler (bar numbers only, no per-beat sub-ticks).
 * Also the playhead-scrub surface -- see onScrubMouseDown. */
export function RulerRow({ systemIndex, beatsPerBar, onScrubMouseDown }: Props) {
  const bars = Array.from({ length: EDIT_BARS_PER_ROW }, (_, i) => i);

  return (
    <>
      {/* Full-width background so the ruler reads as its own row (with a
          border-bottom marking where the loop row starts) instead of just
          floating bar-number labels over whatever's underneath -- one of four
          explicit group dividers (ruler/loop/melody/chords), see each
          group's own CSS rule for the other three. Also the actual scrub
          target -- the bar-number labels sit on top of it but don't need
          their own handler, this background spans the full row underneath. */}
      <div
        className="ruler-row-bg"
        style={{ gridRow: RULER_TRACK, gridColumn: '1 / -1' }}
        onMouseDown={onScrubMouseDown}
      />
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
