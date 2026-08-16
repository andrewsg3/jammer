import type { MouseEvent as ReactMouseEvent } from 'react';
import type { PendingSectionRange } from '../EditGrid';
import { EDIT_BARS_PER_ROW, RULER_TRACK, colLine } from './gridMath';

type Props = {
  systemIndex: number;
  systemStart: number;
  beatsPerSystem: number;
  beatsPerBar: number;
  // Plain click-or-drag scrubs the playhead; Shift+drag instead drag-selects
  // a bar range for a new section -- both routed through this one handler
  // (EditGrid.tsx's handleRulerMouseDown branches on e.shiftKey) rather than
  // exposing two separate mousedown props, since only one gesture can ever be
  // live from a single mousedown anyway. The ruler is always clickable even
  // when a chart is fully packed with chords (unlike the chord row, which has
  // no empty cells to click through then) or when the loop row is in use for
  // its own job (setting the loop range, not the playhead) -- which is also
  // why section drag-select lives here rather than needing a row of its own.
  onScrubMouseDown: (e: ReactMouseEvent) => void;
  // Drag-selected, not-yet-committed bar range (Shift+drag above) -- see
  // EditGrid.tsx's handleSectionRangeMouseDown and
  // EditGridHandle.commitPendingSectionRange/clearPendingSectionRange for how
  // App.tsx's SectionRangeToolbar turns this into a real section. null while
  // nothing's drag-selected.
  pendingSectionRange: PendingSectionRange | null;
};

/** Bar ruler for one system — just the bar number, centered, one cell per
 * bar. Matches Hookpad's own ruler (bar numbers only, no per-beat sub-ticks).
 * Also the playhead-scrub surface, and (Shift+drag) the section drag-select
 * surface -- see onScrubMouseDown. */
export function RulerRow({ systemIndex, systemStart, beatsPerSystem, beatsPerBar, onScrubMouseDown, pendingSectionRange }: Props) {
  const bars = Array.from({ length: EDIT_BARS_PER_ROW }, (_, i) => i);

  const pendingLocalStart =
    pendingSectionRange === null ? null : Math.max(0, Math.min(beatsPerSystem, pendingSectionRange.startBeat - systemStart));
  const pendingLocalEnd =
    pendingSectionRange === null ? null : Math.max(0, Math.min(beatsPerSystem, pendingSectionRange.endBeat - systemStart));

  return (
    <>
      {/* Full-width background so the ruler reads as its own row (with a
          border-bottom marking where the loop row starts) instead of just
          floating bar-number labels over whatever's underneath -- one of four
          explicit group dividers (ruler/loop/melody/chords), see each
          group's own CSS rule for the other three. Also the actual scrub/
          section-drag-select target -- the bar-number labels sit on top of
          it but don't need their own handler, this background spans the
          full row underneath. */}
      <div
        className="ruler-row-bg"
        style={{ gridRow: RULER_TRACK, gridColumn: '1 / -1' }}
        onMouseDown={onScrubMouseDown}
        title="Click/drag to move the playhead — Shift+drag to select bars for a new section"
      />
      {pendingLocalStart !== null && pendingLocalEnd !== null && pendingLocalEnd > pendingLocalStart && (
        <div
          className="section-range-pending"
          style={{ gridRow: RULER_TRACK, gridColumn: `${colLine(pendingLocalStart)} / ${colLine(pendingLocalEnd)}` }}
        />
      )}
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
