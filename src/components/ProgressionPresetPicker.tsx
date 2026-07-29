import type { ProgressionPreset } from '../data/progressionPresets';

type Props = {
  presets: ProgressionPreset[];
  onSelect: (preset: ProgressionPreset) => void;
};

export function ProgressionPresetPicker({ presets, onSelect }: Props) {
  return (
    <div className="progression-preset-picker">
      <label htmlFor="progression-preset">Progression preset</label>
      <select
        id="progression-preset"
        defaultValue=""
        onChange={(e) => {
          const preset = presets.find((p) => p.name === e.target.value);
          if (preset) onSelect(preset);
          e.target.value = ''; // resets to placeholder — this is an action, not persistent state
        }}
      >
        <option value="" disabled>
          Load a preset…
        </option>
        {presets.map((preset) => (
          <option key={preset.name} value={preset.name}>
            {preset.name}
          </option>
        ))}
      </select>
    </div>
  );
}
