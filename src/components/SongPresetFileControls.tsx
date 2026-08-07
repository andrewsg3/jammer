import { useRef } from 'react';

type Props = {
  onSave: () => void;
  onImportFile: (file: File) => void;
  error?: string | null;
  // Icon-only rendering for the top bar's tight row, vs. the full text-labeled
  // buttons that fit the sidebar's own vertical stack of controls.
  compact?: boolean;
};

export function SongPresetFileControls({ onSave, onImportFile, error, compact = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`song-preset-file-controls${compact ? ' song-preset-file-controls-compact' : ''}`}>
      <div className="song-preset-actions">
        <button type="button" onClick={onSave} title="Save song…" aria-label="Save song">
          {compact ? '💾' : 'Save song…'}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Load from file…"
          aria-label="Load song from file"
        >
          {compact ? '📂' : 'Load from file…'}
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
