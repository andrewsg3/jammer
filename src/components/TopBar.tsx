import { useRef } from 'react';
import { SCALE_NAMES, SCALE_LABELS } from '../data/progressions';
import type { ScaleName } from '../data/progressions';
import type { SongPreset } from '../data/songPresets';
import { SongPresetFileControls } from './SongPresetFileControls';

const MIN_TEMPO = 40;
const MAX_TEMPO = 220;
const TAP_RESET_GAP_MS = 2000;
const TAP_HISTORY_SIZE = 8;

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
  isPlaying: boolean;
  onTogglePlay: () => void;
  instrumentsLoading: boolean;
  onSaveSongPreset: () => void;
  onImportSongPresetFile: (file: File) => void;
  songPresetError?: string | null;
  onOpenSettings: () => void;
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
  isPlaying,
  onTogglePlay,
  instrumentsLoading,
  onSaveSongPreset,
  onImportSongPresetFile,
  songPresetError,
  onOpenSettings,
}: Props) {
  const tapTimesRef = useRef<number[]>([]);

  const handleTapTempo = () => {
    const now = performance.now();
    const times = tapTimesRef.current;
    const last = times[times.length - 1];
    if (last !== undefined && now - last > TAP_RESET_GAP_MS) {
      times.length = 0; // gap too long — this tap starts a fresh sequence
    }
    times.push(now);
    if (times.length > TAP_HISTORY_SIZE) times.shift();
    if (times.length < 2) return; // need at least one interval to estimate a tempo

    const intervals = times.slice(1).map((t, i) => t - times[i]);
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgMs);
    onTempoChange(Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, bpm)));
  };

  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <div className="top-bar-brand">
          <h1 className="app-title">JazzMate v0.1</h1>
          <a
            href="https://www.buymeacoffee.com/andrewsg"
            target="_blank"
            rel="noopener noreferrer"
            className="coffee-link"
          >
            ☕ Support Jazzmate
          </a>
        </div>

        <TopBarField label="Song">
          <div className="top-bar-song-group">
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
            <SongPresetFileControls
              onSave={onSaveSongPreset}
              onImportFile={onImportSongPresetFile}
              error={songPresetError}
              compact
            />
            <button
              type="button"
              className="top-bar-icon-button"
              onClick={() => window.print()}
              title="Print sheet (or save as PDF via the browser's print dialog)"
              aria-label="Print sheet"
            >
              🖨️
            </button>
          </div>
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
              {SCALE_NAMES.map((s) => (
                <option key={s} value={s}>
                  {SCALE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </TopBarField>

        <TopBarField label="Tempo">
          <div className="top-bar-tempo-group">
            <input
              id="top-bar-tempo"
              aria-label="Tempo"
              type="number"
              min={MIN_TEMPO}
              max={MAX_TEMPO}
              value={tempo}
              onChange={(e) => onTempoChange(Number(e.target.value))}
            />
            <span>bpm</span>
            <button
              type="button"
              className="tap-tempo-button"
              onClick={handleTapTempo}
              title="Tap to set tempo"
            >
              Tap
            </button>
          </div>
        </TopBarField>

        <button
          type="button"
          className="play-button-prominent"
          onClick={onTogglePlay}
          disabled={!isPlaying && instrumentsLoading}
          title={!isPlaying && instrumentsLoading ? 'Loading instrument samples…' : undefined}
        >
          {!isPlaying && instrumentsLoading ? 'Loading…' : isPlaying ? '■ Stop' : '▶ Play'}
        </button>

        <button
          type="button"
          className="top-bar-icon-button"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
