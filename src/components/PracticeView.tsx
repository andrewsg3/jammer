import { chordNameParts } from '../data/progressions';
import type { Chord, NotationStyle } from '../data/progressions';
import { CAGED_SHAPES } from '../data/fretboard';
import { FretboardDiagram } from './practice/FretboardDiagram';

type Props = {
  chord: Chord | null;
  notationStyle: NotationStyle;
};

/** Desktop's 4th view mode -- guitar fretboard diagrams for whatever chord
 * was last clicked/auditioned anywhere else in the app (ChordPalette, Chord
 * Finder, and Edit grid's chord blocks all already funnel every click through
 * App.tsx's onAuditionChord/handleAudition; this view just also remembers
 * the most recent one -- see App.tsx's practiceChord state). Chord Grid and
 * Lead Sheet are read-only and don't audition on click, so they don't feed
 * this. Read-only itself too -- nothing here edits the song. */
export function PracticeView({ chord, notationStyle }: Props) {
  if (!chord) {
    return (
      <div className="practice-view practice-view-empty">
        <p className="chord-grid-hint">Click any chord anywhere in the app to see how to play it here.</p>
      </div>
    );
  }

  const { root, core, ext, bass } = chordNameParts(chord, notationStyle);
  const shapes = CAGED_SHAPES[chord.quality];

  return (
    <div className="practice-view">
      <h2 className="practice-view-chord-name">
        {root}
        {core}
        {ext && <sup className="chord-ext">{ext}</sup>}
        {bass}
      </h2>
      {!shapes || shapes.length === 0 ? (
        <p className="chord-grid-hint">
          No fingering diagrams yet for this chord quality — see CLAUDE.md's "Guitar fingering diagrams" section.
        </p>
      ) : (
        <div className="fretboard-diagram-row">
          {shapes.map((shape) => (
            <FretboardDiagram key={shape.shape} root={chord.root} shape={shape} />
          ))}
        </div>
      )}
    </div>
  );
}
