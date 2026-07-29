type Props = {
  onFile: (file: File) => void;
  error?: string | null;
};

export function MidiUpload({ onFile, error }: Props) {
  return (
    <div className="midi-upload">
      <label htmlFor="midi-upload">
        Import drum MIDI
        <input
          id="midi-upload"
          type="file"
          accept=".mid,.midi"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
      </label>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
