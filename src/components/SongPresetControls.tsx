import { useRef } from 'react';
import type { SongPreset } from '../data/songPresets';

type Props = {
  presets: SongPreset[];
  onLoad: (preset: SongPreset) => void;
  onSave: () => void;
  onImportFile: (file: File) => void;
  error?: string | null;
};

export function SongPresetControls({ presets, onLoad, onSave, onImportFile, error }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="song-preset-controls">
      <label htmlFor="song-preset-select">Song preset</label>
      <select
        id="song-preset-select"
        defaultValue=""
        onChange={(e) => {
          const preset = presets.find((p) => p.name === e.target.value);
          if (preset) onLoad(preset);
          e.target.value = ''; // resets to placeholder — this is an action, not persistent state
        }}
      >
        <option value="" disabled>
          Load a full song…
        </option>
        {presets.map((preset) => (
          <option key={preset.name} value={preset.name}>
            {preset.name}
          </option>
        ))}
      </select>
      <div className="song-preset-actions">
        <button type="button" onClick={onSave}>
          Save song…
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Load from file…
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
