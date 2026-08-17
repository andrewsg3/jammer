import { useEffect, useRef } from 'react';
import { chordNameParts } from '../data/progressions';
import type { Chord, NotationStyle, ScaleName } from '../data/progressions';
import { CAGED_SHAPES } from '../data/fretboard';
import { FretboardDiagram } from './practice/FretboardDiagram';
import { getChordSubstitutions } from '../data/chordSubstitutions';

type Props = {
  chord: Chord;
  notationStyle: NotationStyle;
  showSubstitutions: boolean;
  musicalKey: string;
  scale: ScaleName;
  onClose: () => void;
};

function ChordNameLabel({ chord, notationStyle }: { chord: Chord; notationStyle: NotationStyle }) {
  const { root, core, ext, bass } = chordNameParts(chord, notationStyle);
  return (
    <>
      {root}
      {core}
      {ext && <sup className="chord-ext">{ext}</sup>}
      {bass}
    </>
  );
}

/**
 * A floating "how do I play this" peek, opened by clicking any chord anywhere
 * in the app -- the palette/Chord Finder and Edit grid's chord blocks (already
 * routed through App.tsx's handleAudition), and now Chord Grid's/Lead Sheet's
 * own chord labels too (onChordClick, newly added to both for exactly this).
 * Replaces the old dedicated Practice tab for this job, per direct user
 * feedback: "I don't think we should need to go to a new view to see chord
 * fingering" -- Practice is now a separate, bigger exercise-bank view instead
 * (see PracticeView.tsx). Fixed-position, not anchored to the exact click
 * pixel -- the click sites here are too structurally different (palette
 * buttons, VexFlow-overlay markers, grid cells) to thread real coordinates
 * through cleanly, so this always renders bottom-right, updating in place on
 * every subsequent chord click rather than jumping around the screen.
 *
 * showSubstitutions is only ever true from Edit mode (App.tsx's
 * handleAudition, which only ever fires from Edit-mode-only components) --
 * Chord Grid/Lead Sheet's own onChordClick always passes false, keeping
 * those two views' "no reharm suggestions, just look up a fingering"
 * character distinct from Edit's.
 */
export function ChordFingeringPopover({ chord, notationStyle, showSubstitutions, musicalKey, scale, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Capture phase, mousedown (not click) -- same reasoning as
    // MelodyNoteToolbar's own document-level dismiss listener: fires before
    // whatever the click would otherwise do, but harmlessly, since a click on
    // a *different* chord just replaces this popover's content right after
    // via its own onClick, net result unaffected by the extra close-then-
    // reopen in between.
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [onClose]);

  const shapes = CAGED_SHAPES[chord.quality];
  const substitutions = showSubstitutions ? getChordSubstitutions(chord, musicalKey, scale) : [];

  return (
    <div className="chord-fingering-popover" ref={ref}>
      <div className="chord-fingering-popover-header">
        <h3 className="chord-fingering-popover-chord-name">
          <ChordNameLabel chord={chord} notationStyle={notationStyle} />
        </h3>
        <button type="button" className="chord-fingering-popover-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {!shapes || shapes.length === 0 ? (
        <p className="chord-fingering-popover-hint">No fingering diagrams yet for this chord quality.</p>
      ) : (
        <div className="fretboard-diagram-row">
          {shapes.map((shape) => (
            <FretboardDiagram key={shape.shape} root={chord.root} shape={shape} />
          ))}
        </div>
      )}
      {showSubstitutions && substitutions.length > 0 && (
        <div className="chord-fingering-popover-subs">
          <h4 className="chord-fingering-popover-subs-title">Substitutions</h4>
          {substitutions.map((sub) => {
            const subShapes = CAGED_SHAPES[sub.chord.quality];
            return (
              <div key={sub.label} className="chord-fingering-popover-sub">
                <div className="chord-fingering-popover-sub-label">
                  {sub.label}: <ChordNameLabel chord={sub.chord} notationStyle={notationStyle} />
                </div>
                {subShapes && subShapes.length > 0 && (
                  <div className="fretboard-diagram-row fretboard-diagram-row--compact">
                    <FretboardDiagram root={sub.chord.root} shape={subShapes[0]} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
