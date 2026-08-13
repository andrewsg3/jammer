import type { MelodyNoteModifyKind } from './EditGrid';

type Props = {
  hasSelectedNote: boolean;
  onModify: (kind: MelodyNoteModifyKind) => void;
};

const BUTTONS: { kind: MelodyNoteModifyKind; label: string; title: string }[] = [
  { kind: 'diatonicUp', label: 'Raise', title: 'Move to the next scale degree up' },
  { kind: 'diatonicDown', label: 'Lower', title: 'Move to the next scale degree down' },
  { kind: 'octaveUp', label: 'Raise Octave', title: 'Raise selected note an octave' },
  { kind: 'octaveDown', label: 'Lower Octave', title: 'Lower selected note an octave' },
  { kind: 'semitoneUp', label: 'Raise Semitone', title: 'Raise selected note a half step' },
  { kind: 'semitoneDown', label: 'Lower Semitone', title: 'Lower selected note a half step' },
];

/** Replaces ChordPalette's top row while the melody grid is active (a note
 * selected, or the step-entry cursor live) -- see EditGrid.tsx's
 * onMelodyActiveChange/EditGridHandle and App.tsx's own swap between the two.
 * Buttons stay visible but disabled once the cursor's active with nothing
 * selected, rather than the whole toolbar flickering in and out as the user
 * steps through empty cells. */
export function MelodyNoteToolbar({ hasSelectedNote, onModify }: Props) {
  return (
    <div className="melody-note-toolbar">
      {!hasSelectedNote && <span className="melody-note-toolbar-hint">Select a note to edit it</span>}
      {BUTTONS.map(({ kind, label, title }) => (
        <button key={kind} type="button" disabled={!hasSelectedNote} title={title} onClick={() => onModify(kind)}>
          {label}
        </button>
      ))}
      <button
        type="button"
        className="melody-note-toolbar-triplet"
        disabled={!hasSelectedNote}
        title="Rescale selected note into a triplet subdivision of its current length"
        onClick={() => onModify('triplet')}
      >
        Make Triplet
      </button>
    </div>
  );
}
