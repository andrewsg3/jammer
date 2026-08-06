import type { ScaleName } from '../data/progressions';
import type { SongPreset } from '../data/songPresets';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

type Props = {
  songPresets: SongPreset[];
  onLoadSongPreset: (preset: SongPreset) => void;
  currentSongName: string;
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

function TopBarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="top-bar-field">
      <span className="top-bar-field-label">{label}</span>
      {children}
    </div>
  );
}

export function TopBar({
  songPresets,
  onLoadSongPreset,
  currentSongName,
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
    <header className="top-bar">
      <div className="top-bar-inner">
        <h1 className="app-title">trackback</h1>

        <TopBarField label="Song">
          <select
            id="song-preset-quick"
            aria-label="Song preset"
            value={currentSongName}
            onChange={(e) => {
              const preset = songPresets.find((p) => p.name === e.target.value);
              if (preset) onLoadSongPreset(preset);
            }}
          >
            {/* Shown when the title's been edited (or a custom preset loaded) and no
                longer matches a bundled preset name — keeps the select's value valid. */}
            {!songPresets.some((p) => p.name === currentSongName) && (
              <option value={currentSongName}>{currentSongName}</option>
            )}
            {songPresets.map((preset) => (
              <option key={preset.name} value={preset.name}>
                {preset.name}
              </option>
            ))}
          </select>
        </TopBarField>

        <TopBarField label="Key">
          <div className="top-bar-key-group">
            <select
              id="top-bar-key"
              aria-label="Key"
              value={musicalKey}
              onChange={(e) => onKeyChange(e.target.value)}
            >
              {/* Some presets use a flat spelling (e.g. "Bb") not in the canonical
                  sharp-only KEYS list — inject it so the select shows it correctly
                  instead of silently falling back to whichever option is first. */}
              {!KEYS.includes(musicalKey) && <option value={musicalKey}>{musicalKey}</option>}
              {KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              id="top-bar-scale"
              aria-label="Scale"
              value={scale}
              onChange={(e) => onScaleChange(e.target.value as ScaleName)}
            >
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </div>
        </TopBarField>

        <TopBarField label="Tempo">
          <div className="top-bar-tempo-group">
            <input
              id="top-bar-tempo"
              aria-label="Tempo"
              type="number"
              min={40}
              max={220}
              value={tempo}
              onChange={(e) => onTempoChange(Number(e.target.value))}
            />
            <span>bpm</span>
          </div>
        </TopBarField>

        <label className="top-bar-metronome">
          <input
            type="checkbox"
            checked={metronomeOn}
            onChange={(e) => onMetronomeChange(e.target.checked)}
          />
          Metronome
        </label>

        <button type="button" className="play-button-prominent" onClick={onTogglePlay}>
          {isPlaying ? '■ Stop' : '▶ Play'}
        </button>
      </div>
    </header>
  );
}
