type Props = {
  bars: number;
  onAdd: () => void;
  onCancel: () => void;
};

/** Replaces ChordPalette's top row while a bar range is drag-selected on the
 * section track (App.tsx swaps the two based on EditGrid's
 * onSectionRangeChange) -- same full-width single-row shape as
 * MelodyNoteToolbar, so the swap doesn't shift any layout below it. */
export function SectionRangeToolbar({ bars, onAdd, onCancel }: Props) {
  return (
    <div className="section-range-toolbar">
      <span className="section-range-toolbar-hint">
        {bars} bar{bars === 1 ? '' : 's'} selected
      </span>
      <button type="button" onClick={onAdd}>
        Add Section
      </button>
      <button type="button" className="section-range-toolbar-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
