type Props = {
  chordsVolume: number;
  onChordsVolumeChange: (value: number) => void;
  bassVolume: number;
  onBassVolumeChange: (value: number) => void;
  drumsVolume: number;
  onDrumsVolumeChange: (value: number) => void;
  metronomeVolume: number;
  onMetronomeVolumeChange: (value: number) => void;
};

type SliderProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function VolumeSlider({ id, label, value, onChange }: SliderProps) {
  return (
    <div className="volume-slider">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function MixerControls({
  chordsVolume,
  onChordsVolumeChange,
  bassVolume,
  onBassVolumeChange,
  drumsVolume,
  onDrumsVolumeChange,
  metronomeVolume,
  onMetronomeVolumeChange,
}: Props) {
  return (
    <div className="mixer-controls">
      <VolumeSlider id="volume-chords" label="Chords" value={chordsVolume} onChange={onChordsVolumeChange} />
      <VolumeSlider id="volume-bass" label="Bass" value={bassVolume} onChange={onBassVolumeChange} />
      <VolumeSlider id="volume-drums" label="Drums" value={drumsVolume} onChange={onDrumsVolumeChange} />
      <VolumeSlider
        id="volume-metronome"
        label="Metronome"
        value={metronomeVolume}
        onChange={onMetronomeVolumeChange}
      />
    </div>
  );
}
