import { useRef } from 'react';

type Props = {
  onSave: () => void;
  onImportFile: (file: File) => void;
  error?: string | null;
};

export function SongPresetFileControls({ onSave, onImportFile, error }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="song-preset-file-controls">
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
