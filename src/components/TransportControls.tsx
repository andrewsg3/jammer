import type { ScaleName } from '../data/progressions';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

type Props = {
  musicalKey: string;
  onKeyChange: (key: string) => void;
  scale: ScaleName;
  onScaleChange: (scale: ScaleName) => void;
  tempo: number;
  onTempoChange: (tempo: number) => void;
  metronomeOn: boolean;
  onMetronomeChange: (enabled: boolean) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
};

export function TransportControls({
  musicalKey,
  onKeyChange,
  scale,
  onScaleChange,
  tempo,
  onTempoChange,
  metronomeOn,
  onMetronomeChange,
  isPlaying,
  onTogglePlay,
}: Props) {
  return (
    <div className="transport-controls">
      <div className="transport-row">
        <div>
          <label htmlFor="key">Key</label>
          <select id="key" value={musicalKey} onChange={(e) => onKeyChange(e.target.value)}>
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="scale">Scale</label>
          <select id="scale" value={scale} onChange={(e) => onScaleChange(e.target.value as ScaleName)}>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="tempo">Tempo</label>
        <input
          id="tempo"
          type="number"
          min={40}
          max={220}
          value={tempo}
          onChange={(e) => onTempoChange(Number(e.target.value))}
        />
        <span>bpm</span>
      </div>
      <div className="metronome-toggle">
        <label htmlFor="metronome">
          <input
            id="metronome"
            type="checkbox"
            checked={metronomeOn}
            onChange={(e) => onMetronomeChange(e.target.checked)}
          />
          {' '}Metronome
        </label>
      </div>
      <button type="button" className="play-button" onClick={onTogglePlay}>
        {isPlaying ? 'Stop' : 'Play'}
      </button>
    </div>
  );
}
