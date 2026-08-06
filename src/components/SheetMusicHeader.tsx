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
      <div className="sheet-header-title-block">
        <AutoWidthInput
          className="sheet-title"
          value={title}
          onChange={onTitleChange}
          placeholder="Untitled"
          ariaLabel="Song title"
        />
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
      <div className="sheet-header-side">
        <button type="button" className="clear-button" onClick={onClear}>
          Clear
        </button>
        <div className="sheet-marks">
          <span className="sheet-tempo">♩ = {tempo}</span>
          <span className="sheet-time-signature" aria-label="Time signature 4/4">
            <span>4</span>
            <span>4</span>
          </span>
        </div>
      </div>
    </div>
  );
}
