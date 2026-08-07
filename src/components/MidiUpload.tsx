type Props = {
  onFile: (file: File) => void;
  error?: string | null;
  label?: string;
  id?: string;
};

export function MidiUpload({ onFile, error, label = 'Import drum MIDI', id = 'midi-upload' }: Props) {
  return (
    <div className="midi-upload">
      <label htmlFor={id}>
        {label}
        <input
          id={id}
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
