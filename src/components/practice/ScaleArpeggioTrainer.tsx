import { useEffect, useRef, useState } from 'react';
import { QUALITY_GROUPS, QUALITY_INTERVALS, QUALITY_LABELS } from '../../data/progressions';
import type { ChordQuality } from '../../data/progressions';
import { EXOTIC_SCALE_GROUPS } from '../../data/exoticScales';
import { SCALE_POSITIONS } from '../../data/scaleFretboard';
import { ScaleFretboardDiagram } from './ScaleFretboardDiagram';
import { getPracticeBeatCount, startPracticeMetronome, stopPracticeMetronome } from '../../audio/practiceMetronome';

const ALL_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEATS_PER_BAR = 4;
const DEFAULT_BPM = 80;
const DEFAULT_CYCLE_BEATS = 8;

type Mode = 'scale' | 'arpeggio';

const ALL_SCALES = EXOTIC_SCALE_GROUPS.flatMap((g) => g.scales);
const DEFAULT_SCALE_NAME = ALL_SCALES[0].name;
const DEFAULT_ARPEGGIO_QUALITY: ChordQuality = 'maj7';

function intervalsFor(mode: Mode, scaleName: string, arpeggioQuality: ChordQuality): number[] {
  if (mode === 'arpeggio') return QUALITY_INTERVALS[arpeggioQuality];
  return ALL_SCALES.find((s) => s.name === scaleName)?.intervals ?? ALL_SCALES[0].intervals;
}

function labelFor(root: string, mode: Mode, scaleName: string, arpeggioQuality: ChordQuality): string {
  return mode === 'arpeggio' ? `${root} ${QUALITY_LABELS[arpeggioQuality]} arpeggio` : `${root} ${scaleName}`;
}

/**
 * Practice tab's first real exercise (see CLAUDE.md's "Practice philosophy"
 * section) -- any scale or arpeggio, any root, shown as CAGED-position
 * fretboard boxes (see data/scaleFretboard.ts for why this is E/A-shape only
 * for now, same honest scope the chord fingering popover already has).
 * Reuses the standalone Tone.Clock metronome (audio/practiceMetronome.ts) so
 * this works independent of whatever's loaded/playing elsewhere in the app.
 * Cycling positions every N clicks is opt-in -- with the metronome off, both
 * curated positions just show side by side for reference.
 */
export function ScaleArpeggioTrainer() {
  const [mode, setMode] = useState<Mode>('scale');
  const [root, setRoot] = useState('C');
  const [scaleName, setScaleName] = useState(DEFAULT_SCALE_NAME);
  const [arpeggioQuality, setArpeggioQuality] = useState<ChordQuality>(DEFAULT_ARPEGGIO_QUALITY);
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [cycleEveryBeats, setCycleEveryBeats] = useState(DEFAULT_CYCLE_BEATS);
  const [isRunning, setIsRunning] = useState(false);
  const [beatCount, setBeatCount] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    const tick = () => {
      setBeatCount(getPracticeBeatCount());
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [isRunning]);

  // Stop the click (and cancel the rAF poll above) on unmount -- switching away
  // from Practice mode shouldn't leave a metronome clicking in the background.
  useEffect(() => () => stopPracticeMetronome(), []);

  const handleToggleMetronome = () => {
    if (isRunning) {
      stopPracticeMetronome();
      setIsRunning(false);
      setBeatCount(0);
    } else {
      startPracticeMetronome(bpm, BEATS_PER_BAR);
      setIsRunning(true);
      setBeatCount(0);
    }
  };

  const intervals = intervalsFor(mode, scaleName, arpeggioQuality);
  const label = labelFor(root, mode, scaleName, arpeggioQuality);
  const cyclePositionIndex = Math.floor(beatCount / Math.max(1, cycleEveryBeats)) % SCALE_POSITIONS.length;
  const beatInBar = beatCount % BEATS_PER_BAR;

  return (
    <div className="scale-trainer">
      <div className="scale-trainer-controls">
        <div className="scale-trainer-mode-toggle" role="group" aria-label="Scale or arpeggio">
          <button
            type="button"
            className={'scale-trainer-mode-button' + (mode === 'scale' ? ' scale-trainer-mode-button--active' : '')}
            onClick={() => setMode('scale')}
          >
            Scale
          </button>
          <button
            type="button"
            className={'scale-trainer-mode-button' + (mode === 'arpeggio' ? ' scale-trainer-mode-button--active' : '')}
            onClick={() => setMode('arpeggio')}
          >
            Arpeggio
          </button>
        </div>
        <label className="scale-trainer-field">
          Root
          <select value={root} onChange={(e) => setRoot(e.target.value)}>
            {ALL_ROOTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {mode === 'scale' ? (
          <label className="scale-trainer-field">
            Scale
            <select value={scaleName} onChange={(e) => setScaleName(e.target.value)}>
              {EXOTIC_SCALE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.scales.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ) : (
          <label className="scale-trainer-field">
            Arpeggio
            <select value={arpeggioQuality} onChange={(e) => setArpeggioQuality(e.target.value as ChordQuality)}>
              {QUALITY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.qualities.map((q) => (
                    <option key={q} value={q}>
                      {QUALITY_LABELS[q]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="scale-trainer-metronome">
        <label className="scale-trainer-field scale-trainer-field--narrow">
          BPM
          <input
            type="number"
            min={30}
            max={240}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value) || DEFAULT_BPM)}
            disabled={isRunning}
          />
        </label>
        <label className="scale-trainer-field scale-trainer-field--narrow">
          Cycle position every
          <input
            type="number"
            min={1}
            max={64}
            value={cycleEveryBeats}
            onChange={(e) => setCycleEveryBeats(Number(e.target.value) || DEFAULT_CYCLE_BEATS)}
          />
          beats
        </label>
        <button type="button" className="scale-trainer-metronome-toggle" onClick={handleToggleMetronome}>
          {isRunning ? 'Stop' : 'Start metronome'}
        </button>
        {isRunning && (
          <div className="scale-trainer-beat-indicator" aria-live="polite">
            {Array.from({ length: BEATS_PER_BAR }, (_, i) => (
              <span
                key={i}
                className={'scale-trainer-beat-dot' + (i === beatInBar ? ' scale-trainer-beat-dot--active' : '')}
              />
            ))}
          </div>
        )}
      </div>

      <div className="fretboard-diagram-row">
        {isRunning ? (
          <ScaleFretboardDiagram
            root={root}
            intervals={intervals}
            position={SCALE_POSITIONS[cyclePositionIndex]}
            label={label}
          />
        ) : (
          SCALE_POSITIONS.map((pos) => (
            <ScaleFretboardDiagram key={pos} root={root} intervals={intervals} position={pos} label={label} />
          ))
        )}
      </div>
      <p className="chord-grid-hint scale-trainer-hint">
        Only E-shape/A-shape positions are curated so far — see CLAUDE.md's "Guitar fingering diagrams" section for
        the remaining C/G/D-shape gap.
      </p>
    </div>
  );
}
