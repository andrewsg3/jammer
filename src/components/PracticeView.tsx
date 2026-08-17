// Desktop's 4th view mode -- a bank of practice exercises, not yet built (see
// CLAUDE.md's "Practice philosophy for jazz guitar improvisation" section).
// Used to show fretboard fingering diagrams for the last-clicked chord; that
// job moved to a floating popover usable from every view instead (see
// ChordFingeringPopover.tsx), per direct user feedback -- "I don't think we
// should need to go to a new view to see chord fingering" -- so this tab was
// freed up for its own, bigger purpose: a real exercise bank (trading fours,
// licks/riffs keyed to specific chord changes, scale/arpeggio drilling, scale
// substitutions over changes), same categories the user named when redirecting
// this view's scope. None of the four are built yet -- this is a placeholder
// naming what's planned, not a functioning exercise picker.
const PLANNED_EXERCISES = [
  { title: 'Trading fours', description: 'Alternate 4-bar blocks with a bot soloist over a backing track.' },
  { title: 'Licks over changes', description: 'A bank of short phrases, browsable by the harmonic context they fit.' },
  { title: 'Scales & arpeggios', description: 'Drill scale/arpeggio shapes on the neck, in position, up to tempo.' },
  {
    title: 'Scale substitutions',
    description: 'Which scale (and which substitution) fits which chord, including reharm ideas.',
  },
];

export function PracticeView() {
  return (
    <div className="practice-view">
      <h2 className="practice-view-title">Practice</h2>
      <p className="chord-grid-hint">
        A bank of practice exercises is planned here — click any chord anywhere in the app to see its fingering (and,
        in Edit mode, substitution ideas) in a popover instead.
      </p>
      <ul className="practice-view-exercise-list">
        {PLANNED_EXERCISES.map((ex) => (
          <li key={ex.title} className="practice-view-exercise">
            <span className="practice-view-exercise-title">{ex.title}</span>
            <span className="practice-view-exercise-description">{ex.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
