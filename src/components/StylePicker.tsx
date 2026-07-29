type StyleOption = { name: string };

type Props<T extends StyleOption> = {
  label: string;
  options: T[];
  selected: T;
  onSelect: (option: T) => void;
};

export function StylePicker<T extends StyleOption>({ label, options, selected, onSelect }: Props<T>) {
  const id = `style-picker-${label.toLowerCase()}`;
  return (
    <div className="style-picker">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={selected.name}
        onChange={(e) => {
          const option = options.find((o) => o.name === e.target.value);
          if (option) onSelect(option);
        }}
      >
        {options.map((option) => (
          <option key={option.name} value={option.name}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
