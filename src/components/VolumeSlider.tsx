type Props = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export function VolumeSlider({ id, label, value, onChange }: Props) {
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
