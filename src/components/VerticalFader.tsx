type Props = {
  id: string;
  value: number;
  onChange: (value: number) => void;
};

/** A DAW-style vertical volume fader — a plain range input rotated via CSS. */
export function VerticalFader({ id, value, onChange }: Props) {
  return (
    <div className="vertical-fader">
      <input
        id={id}
        className="vertical-fader-input"
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-orientation="vertical"
        aria-label="Volume"
      />
    </div>
  );
}
