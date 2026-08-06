import { StylePicker } from './StylePicker';
import { VerticalFader } from './VerticalFader';

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

export function ChannelStrip<TStyle extends NamedOption, TInstrument extends NamedOption>({
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
    <div className={`channel-strip channel-strip-${accent}`}>
      <StylePicker label="Style" options={styleOptions} selected={selectedStyle} onSelect={onStyleChange} />
      <StylePicker
        label="Sound"
        options={instrumentOptions}
        selected={selectedInstrument}
        onSelect={onInstrumentChange}
      />
      <VerticalFader id={`volume-${accent}`} value={volume} onChange={onVolumeChange} />
      <span className="channel-strip-label">{label}</span>
    </div>
  );
}
