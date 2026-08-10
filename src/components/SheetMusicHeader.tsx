import { useEffect, useRef } from 'react';
import { STAFF_HEIGHT, STAFF_LINE_GAP } from './staffLayout';

type Props = {
  title: string;
  onTitleChange: (title: string) => void;
  subtitle: string;
  onSubtitleChange: (subtitle: string) => void;
  author: string;
  onAuthorChange: (author: string) => void;
  playStyle: string;
  onPlayStyleChange: (playStyle: string) => void;
  tempo: number;
  onClear: () => void;
  // The decorative blank staff exists to read as a continuation of ChordGrid's
  // own staff below it (see the comment on .sheet-header-band's children) — true
  // there since the two share left/right insets. The beat-grid compact view has
  // no staff of its own for this to continue, so App.tsx passes false there.
  // Defaults true so every existing caller (ChordGrid.tsx) keeps its staff
  // without having to pass this explicitly.
  showStaff?: boolean;
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
  // An explicit ch-based CSS width, not the size attribute — size's width-per-
  // character estimate is based on the font's normal-case metrics, but this
  // header renders everything through text-transform:uppercase, and capital
  // letters run noticeably wider than that estimate budgets for. The 1.3x pads
  // past exact measurement rather than trying to match it precisely.
  const text = value || placeholder;
  const widthCh = Math.max(text.length * 1.3, 3);
  return (
    <input
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={{ width: `${widthCh}ch` }}
    />
  );
}

// Unlike the title, a long author name needs to actually wrap across lines —
// a single-line <input> (see AutoWidthInput above) can't do that at all, no
// matter how its container is positioned, so this is a real <textarea>
// instead, auto-growing its height to fit however many lines wrap.
function AutoGrowTextarea({
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
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={1}
    />
  );
}

export function SheetMusicHeader({
  title,
  onTitleChange,
  subtitle,
  onSubtitleChange,
  author,
  onAuthorChange,
  playStyle,
  onPlayStyleChange,
  tempo,
  onClear,
  showStaff = true,
}: Props) {
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
      <div className="sheet-header-band" style={{ minHeight: STAFF_HEIGHT }}>
        {showStaff && (
          <div className="sheet-header-staff" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="sheet-header-staff-line" style={{ top: i * STAFF_LINE_GAP }} />
            ))}
          </div>
        )}
        <div className="sheet-header-text">
          <div className="sheet-header-tempo-block">
            <AutoWidthInput
              className="sheet-play-style"
              value={playStyle}
              onChange={onPlayStyleChange}
              placeholder="Style"
              ariaLabel="Play style (e.g. Medium Swing, Ballad, Bossa Nova)"
            />
            <span className="sheet-header-tempo">♩ = {tempo}</span>
          </div>
          <div className="sheet-header-title-block">
            <AutoWidthInput
              className="sheet-title"
              value={title}
              onChange={onTitleChange}
              placeholder="Untitled"
              ariaLabel="Song title"
            />
            <AutoWidthInput
              className="sheet-subtitle"
              value={subtitle}
              onChange={onSubtitleChange}
              placeholder="Subtitle"
              ariaLabel="Subtitle (e.g. 'from Black Orpheus')"
            />
          </div>
          <div className="sheet-author-line">
            <AutoGrowTextarea
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
