import { STAFF_HEIGHT, STAFF_LINE_GAP } from './staffLayout';

type Props = {
  title: string;
  onTitleChange: (title: string) => void;
  author: string;
  onAuthorChange: (author: string) => void;
  tempo: number;
  onClear: () => void;
};

// Auto-widening text input — sizes to its content like a title on an actual
// printed page, rather than a fixed-width form field.
function AutoWidthInput({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className: string;
  ariaLabel: string;
}) {
  return (
    <input
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      size={Math.max((value || placeholder).length, 1)}
    />
  );
}

export function SheetMusicHeader({ title, onTitleChange, author, onAuthorChange, tempo, onClear }: Props) {
  return (
    <div className="sheet-header">
      <button type="button" className="clear-button sheet-clear-button" onClick={onClear}>
        Clear
      </button>
      {/* Tempo/title/author sit on top of a blank staff — same STAFF_HEIGHT/
          STAFF_LINE_GAP as every row in ChordGrid.tsx (shared via staffLayout.ts),
          and the same left/right inset as .chord-grid's padding, so this staff
          reads as a continuation of the grid's. Clef/key signature/time signature
          render on the grid's own first staff instead (ChordGrid.tsx) — tempo only
          lives here, not duplicated there. */}
      <div className="sheet-header-band" style={{ height: STAFF_HEIGHT }}>
        <div className="sheet-header-staff" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="sheet-header-staff-line" style={{ top: i * STAFF_LINE_GAP }} />
          ))}
        </div>
        <div className="sheet-header-text">
          <span className="sheet-header-tempo">♩ = {tempo}</span>
          <div className="sheet-header-title-block">
            <AutoWidthInput
              className="sheet-title"
              value={title}
              onChange={onTitleChange}
              placeholder="Untitled"
              ariaLabel="Song title"
            />
          </div>
          <div className="sheet-author-line">
            <span>by</span>
            <AutoWidthInput
              className="sheet-author"
              value={author}
              onChange={onAuthorChange}
              placeholder="Unknown"
              ariaLabel="Author"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
