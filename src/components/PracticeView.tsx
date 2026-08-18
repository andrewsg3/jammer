import { ScaleArpeggioTrainer } from './practice/ScaleArpeggioTrainer';
import type { PracticeCurrentSong } from './practice/ScaleArpeggioTrainer';

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

type Props = {
  // Read-only song state, plus the app's real Play/Stop -- see CLAUDE.md's
  // "Song-scoped practice mode" section for why this is a deliberate,
  // narrow exception to Practice otherwise having no editing/mixer of its
  // own. currentSong is nullable so Practice keeps working (an honest empty
  // state) if there's ever no song loaded at all.
  currentSong: PracticeCurrentSong | null;
  // Raw playback state -- the Play/Stop button reflects this directly (so it
  // flips to "Stop" the instant playback is triggered, same as TopBar's own
  // button). countInActive is separate: the chart highlight and the scale
  // panel's "which chord is currently sounding" tracking both need to stay
  // off during count-in silence, same as Chord Grid's own isPlaying prop
  // (`isPlaying && !countInActive`) -- see ScaleArpeggioTrainer.tsx.
  isPlaying: boolean;
  countInActive: boolean;
  playheadBeat: number;
  instrumentsLoading: boolean;
  onTogglePlay: () => void;
  // App.tsx's own loopStart/loopEnd (the same state Compose's LoopRow and
  // playback itself already use) plus a way to set it -- see CLAUDE.md's
  // "Loop a section, from Play Along/Practice" section. Not part of the
  // read-only currentSong slice above since it's app-wide playback state, not
  // song data.
  loopStart: number;
  loopEnd: number;
  onLoopRangeChange: (loopStart: number, loopEnd: number) => void;
};

export function PracticeView({
  currentSong,
  isPlaying,
  countInActive,
  playheadBeat,
  instrumentsLoading,
  onTogglePlay,
  loopStart,
  loopEnd,
  onLoopRangeChange,
}: Props) {
  return (
    <div className="practice-view">
      <h2 className="practice-view-title">Practice</h2>
      <section className="scale-trainer-section">
        <h3 className="practice-view-section-title">Scales &amp; Arpeggios</h3>
        <ScaleArpeggioTrainer
          currentSong={currentSong}
          isPlaying={isPlaying}
          countInActive={countInActive}
          playheadBeat={playheadBeat}
          instrumentsLoading={instrumentsLoading}
          onTogglePlay={onTogglePlay}
          loopStart={loopStart}
          loopEnd={loopEnd}
          onLoopRangeChange={onLoopRangeChange}
        />
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
