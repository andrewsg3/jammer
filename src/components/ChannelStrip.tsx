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
  // Optional per-voice sub-mix disclosure — currently only Drums uses this.
  expanded?: boolean;
  onToggleExpanded?: () => void;
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
  expanded,
  onToggleExpanded,
}: Props<TStyle, TInstrument>) {
  return (
    <div className={`channel-strip channel-strip-${accent}`}>
      {onToggleExpanded && (
        <button
          type="button"
          className="channel-strip-expand"
          onClick={onToggleExpanded}
          aria-label={expanded ? `Collapse ${label} voice mix` : `Expand ${label} voice mix`}
          title={expanded ? 'Collapse voice mix' : 'Expand voice mix'}
        >
          {expanded ? '◂' : '▸'}
        </button>
      )}
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
