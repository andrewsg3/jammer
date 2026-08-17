import { ScaleArpeggioTrainer } from './practice/ScaleArpeggioTrainer';

// Desktop's 4th view mode -- a bank of practice exercises (see CLAUDE.md's
// "Practice philosophy for jazz guitar improvisation" section). Used to show
// fretboard fingering diagrams for the last-clicked chord; that job moved to
// a floating popover usable from every view instead (see
// ChordFingeringPopover.tsx), per direct user feedback -- "I don't think we
// should need to go to a new view to see chord fingering" -- so this tab was
// freed up for its own, bigger purpose. Scales & Arpeggios (below) is the
// first of the four exercise categories actually built; the rest are still a
// placeholder naming what's planned, not functioning exercise pickers.
const PLANNED_EXERCISES = [
  { title: 'Trading fours', description: 'Alternate 4-bar blocks with a bot soloist over a backing track.' },
  { title: 'Licks over changes', description: 'A bank of short phrases, browsable by the harmonic context they fit.' },
  {
    title: 'Scale substitutions',
    description: 'Which scale (and which substitution) fits which chord, including reharm ideas.',
  },
];

export function PracticeView() {
  return (
    <div className="practice-view">
      <h2 className="practice-view-title">Practice</h2>
      <section className="scale-trainer-section">
        <h3 className="practice-view-section-title">Scales &amp; Arpeggios</h3>
        <ScaleArpeggioTrainer />
      </section>
      <section>
        <h3 className="practice-view-section-title">More exercises, planned</h3>
        <ul className="practice-view-exercise-list">
          {PLANNED_EXERCISES.map((ex) => (
            <li key={ex.title} className="practice-view-exercise">
              <span className="practice-view-exercise-title">{ex.title}</span>
              <span className="practice-view-exercise-description">{ex.description}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
