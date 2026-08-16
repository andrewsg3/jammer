import { useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { SectionMarker } from '../../data/sections';
import type { DrumStyle, BassStyle, KeysStyle } from '../../data/instrumentStyles';
import { colLine, LOOP_TRACK, SECTION_TRACK } from './gridMath';

type StyleTrack = 'drumStyle' | 'bassStyle' | 'keysStyle';

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
  onUpdateSectionStyle: (section: SectionMarker, track: StyleTrack, styleName: string | undefined) => void;
  drumStyleOptions: DrumStyle[];
  bassStyleOptions: BassStyle[];
  keysStyleOptions: KeysStyle[];
  onLoopBackgroundMouseDown: (e: ReactMouseEvent) => void;
  onLoopStartHandleMouseDown: (e: ReactMouseEvent) => void;
  onLoopEndHandleMouseDown: (e: ReactMouseEvent) => void;
};

const DEFAULT_OPTION = '(song default)';

/** A section's own drums/bass/keys playstyle overrides -- see
 * SectionMarker.drumStyle et al.'s doc comment (data/sections.ts) for the data
 * model, and CLAUDE.md's "Per-section instrument arrangement" idea this is the
 * first concrete slice of. Three plain <select>s rather than anything fancier --
 * a minimal, functional v1, not a polished mixer panel. */
function SectionStylePopover({
  section,
  onUpdateSectionStyle,
  drumStyleOptions,
  bassStyleOptions,
  keysStyleOptions,
  onClose,
}: {
  section: SectionMarker;
  onUpdateSectionStyle: Props['onUpdateSectionStyle'];
  drumStyleOptions: DrumStyle[];
  bassStyleOptions: BassStyle[];
  keysStyleOptions: KeysStyle[];
  onClose: () => void;
}) {
  const rows: { track: StyleTrack; label: string; options: { name: string }[] }[] = [
    { track: 'drumStyle', label: 'Drums', options: drumStyleOptions },
    { track: 'bassStyle', label: 'Bass', options: bassStyleOptions },
    { track: 'keysStyle', label: 'Keys', options: keysStyleOptions },
  ];
  return (
    <div className="section-style-popover" onMouseDown={(e) => e.stopPropagation()}>
      {rows.map(({ track, label, options }) => (
        <label key={track} className="section-style-popover-row">
          <span>{label}</span>
          <select
            value={section[track] ?? ''}
            onChange={(e) => onUpdateSectionStyle(section, track, e.target.value || undefined)}
          >
            <option value="">{DEFAULT_OPTION}</option>
            {options.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type="button" className="section-style-popover-close" onClick={onClose}>
        Done
      </button>
    </div>
  );
}

/** Loop range row (LOOP_TRACK) plus the full-height playhead line and section
 * badges (rendered at SECTION_TRACK, above the ruler) — none of these three are
 * really "the loop row's own" content, but they all live here since this is the
 * component that otherwise owns "click/drag against a beat position" behavior
 * for a whole system. The loop row itself starts neutral (grey/transparent)
 * and only the beats actually inside [loopStart, loopEnd) turn amber
 * (.loop-row-active) — the inverse of the old dim-the-excluded-region
 * approach, and a closer match to Hookpad's own loop row. Section drag-select
 * (create a new section by highlighting a bar range) lives in RulerRow.tsx
 * instead, layered onto that row's existing scrub gesture via Shift — see its
 * own doc comment. */
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
  onUpdateSectionStyle,
  drumStyleOptions,
  bassStyleOptions,
  keysStyleOptions,
  onLoopBackgroundMouseDown,
  onLoopStartHandleMouseDown,
  onLoopEndHandleMouseDown,
}: Props) {
  const activeStart = Math.max(0, Math.min(beatsPerSystem, loopStart - systemStart));
  const activeEnd = Math.max(0, Math.min(beatsPerSystem, loopEnd - systemStart));
  const [openStyleSectionId, setOpenStyleSectionId] = useState<string | null>(null);

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
            className="section-marker-style-toggle"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setOpenStyleSectionId((id) => (id === section.id ? null : section.id))}
            aria-label={`Edit playstyle for section ${section.label}`}
            title="Per-section drums/bass/keys playstyle"
          >
            🎛
          </button>
          <button
            type="button"
            className="section-marker-remove"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onRemoveSection(section)}
            aria-label={`Remove section ${section.label}`}
          >
            ×
          </button>
          {openStyleSectionId === section.id && (
            <SectionStylePopover
              section={section}
              onUpdateSectionStyle={onUpdateSectionStyle}
              drumStyleOptions={drumStyleOptions}
              bassStyleOptions={bassStyleOptions}
              keysStyleOptions={keysStyleOptions}
              onClose={() => setOpenStyleSectionId(null)}
            />
          )}
        </div>
      ))}
      {showPlayhead && (
        <div className="edit-grid-playhead" style={{ gridRow: '1 / -1', gridColumn: colLine(playheadBeat - systemStart) }} />
      )}
    </>
  );
}
