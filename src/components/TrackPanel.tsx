import { StylePicker } from './StylePicker';
import { VolumeSlider } from './VolumeSlider';

type NamedOption = { name: string };

type Props<TStyle extends NamedOption, TInstrument extends NamedOption> = {
  label: string;
  accent: 'drums' | 'bass' | 'harmony';
  styleOptions: TStyle[];
  selectedStyle: TStyle;
  onStyleChange: (style: TStyle) => void;
  instrumentOptions: TInstrument[];
  selectedInstrument: TInstrument;
  onInstrumentChange: (instrument: TInstrument) => void;
  volume: number;
  onVolumeChange: (value: number) => void;
};

export function TrackPanel<TStyle extends NamedOption, TInstrument extends NamedOption>({
  label,
  accent,
  styleOptions,
  selectedStyle,
  onStyleChange,
  instrumentOptions,
  selectedInstrument,
  onInstrumentChange,
  volume,
  onVolumeChange,
}: Props<TStyle, TInstrument>) {
  return (
    <div className={`track-panel track-panel-${accent}`}>
      <h3 className="track-panel-title">{label}</h3>
      <StylePicker label="Style" options={styleOptions} selected={selectedStyle} onSelect={onStyleChange} />
      <StylePicker
        label="Sound"
        options={instrumentOptions}
        selected={selectedInstrument}
        onSelect={onInstrumentChange}
      />
      <VolumeSlider id={`volume-${accent}`} label="Volume" value={volume} onChange={onVolumeChange} />
    </div>
  );
}
