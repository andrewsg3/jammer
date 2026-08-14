import type { MouseEvent as ReactMouseEvent } from 'react';
import type { SectionMarker } from '../../data/sections';
import { colLine, LOOP_TRACK, SECTION_TRACK } from './gridMath';

type Props = {
  systemStart: number;
  beatsPerSystem: number;
  loopStart: number;
  loopEnd: number;
  showLoopStartHandle: boolean;
  showLoopEndHandle: boolean;
  showPlayhead: boolean;
  playheadBeat: number;
  sections: SectionMarker[];
  editingSectionId: string | null;
  editingSectionLabel: string;
  onEditingSectionLabelChange: (value: string) => void;
  onStartEditingSection: (section: SectionMarker) => (e: ReactMouseEvent) => void;
  onCommitEditingSection: (section: SectionMarker) => () => void;
  onCancelEditingSection: () => void;
  onSectionMouseDown: (section: SectionMarker) => (e: ReactMouseEvent) => void;
  onRemoveSection: (section: SectionMarker) => void;
  onLoopBackgroundMouseDown: (e: ReactMouseEvent) => void;
  onLoopStartHandleMouseDown: (e: ReactMouseEvent) => void;
  onLoopEndHandleMouseDown: (e: ReactMouseEvent) => void;
};

/** Loop range row (LOOP_TRACK) plus the full-height playhead line and section
 * badges (rendered at SECTION_TRACK, above the ruler) — none of these three are
 * really "the loop row's own" content, but they all live here since this is the
 * component that otherwise owns "click/drag against a beat position" behavior
 * for a whole system. The loop row itself starts neutral (grey/transparent)
 * and only the beats actually inside [loopStart, loopEnd) turn amber
 * (.loop-row-active) — the inverse of the old dim-the-excluded-region
 * approach, and a closer match to Hookpad's own loop row. */
export function LoopRow({
  systemStart,
  beatsPerSystem,
  loopStart,
  loopEnd,
  showLoopStartHandle,
  showLoopEndHandle,
  showPlayhead,
  playheadBeat,
  sections,
  editingSectionId,
  editingSectionLabel,
  onEditingSectionLabelChange,
  onStartEditingSection,
  onCommitEditingSection,
  onCancelEditingSection,
  onSectionMouseDown,
  onRemoveSection,
  onLoopBackgroundMouseDown,
  onLoopStartHandleMouseDown,
  onLoopEndHandleMouseDown,
}: Props) {
  const activeStart = Math.max(0, Math.min(beatsPerSystem, loopStart - systemStart));
  const activeEnd = Math.max(0, Math.min(beatsPerSystem, loopEnd - systemStart));

  return (
    <>
      <div
        className="loop-row"
        style={{ gridRow: LOOP_TRACK, gridColumn: '1 / -1' }}
        onMouseDown={(e) => {
          if (e.target !== e.currentTarget) return;
          onLoopBackgroundMouseDown(e);
        }}
      />
      {activeEnd > activeStart && (
        <div
          className="loop-row-active"
          style={{ gridRow: LOOP_TRACK, gridColumn: `${colLine(activeStart)} / ${colLine(activeEnd)}` }}
        />
      )}
      {showLoopStartHandle && (
        <div
          className="loop-handle loop-handle-start"
          style={{ gridRow: LOOP_TRACK, gridColumn: colLine(loopStart - systemStart) }}
          onMouseDown={onLoopStartHandleMouseDown}
          role="slider"
          aria-label="Loop start"
          aria-valuenow={loopStart}
        >
          ↻
        </div>
      )}
      {showLoopEndHandle && (
        // No visible glyph -- the refresh icon only displays at the loop's
        // start (matching Hookpad's own loop row); this stays a real,
        // hoverable drag target so the end edge is still resizable.
        <div
          className="loop-handle loop-handle-end"
          style={{ gridRow: LOOP_TRACK, gridColumn: colLine(loopEnd - systemStart) }}
          onMouseDown={onLoopEndHandleMouseDown}
          role="slider"
          aria-label="Loop end"
          aria-valuenow={loopEnd}
        />
      )}
      {sections.map((section) => (
        <div
          key={section.id}
          className="edit-grid-section"
          style={{ gridRow: SECTION_TRACK, gridColumn: colLine(section.startBeat - systemStart) }}
          onMouseDown={onSectionMouseDown(section)}
        >
          {editingSectionId === section.id ? (
            <input
              className="section-marker-label-input"
              value={editingSectionLabel}
              autoFocus
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => onEditingSectionLabelChange(e.target.value)}
              onBlur={onCommitEditingSection(section)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommitEditingSection(section)();
                else if (e.key === 'Escape') onCancelEditingSection();
              }}
            />
          ) : (
            <span className="section-marker-label" onMouseDown={onStartEditingSection(section)}>
              {section.label}
            </span>
          )}
          <button
            type="button"
            className="section-marker-remove"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onRemoveSection(section)}
            aria-label={`Remove section ${section.label}`}
          >
            ×
          </button>
        </div>
      ))}
      {showPlayhead && (
        <div className="edit-grid-playhead" style={{ gridRow: '1 / -1', gridColumn: colLine(playheadBeat - systemStart) }} />
      )}
    </>
  );
}
