import { StylePicker } from './StylePicker';
import { VerticalFader } from './VerticalFader';

type NamedOption = { name: string };

type Props<TStyle extends NamedOption, TInstrument extends NamedOption, TFeel extends NamedOption> = {
  label: string;
  accent: 'drums' | 'bass' | 'harmony' | 'metronome' | 'melody';
  // Style/instrument/feel pickers are all optional — Metronome has none of them,
  // just a volume fader and a mute button; Feel is currently Drums-only.
  styleOptions?: TStyle[];
  selectedStyle?: TStyle;
  onStyleChange?: (style: TStyle) => void;
  instrumentOptions?: TInstrument[];
  selectedInstrument?: TInstrument;
  onInstrumentChange?: (instrument: TInstrument) => void;
  feelOptions?: TFeel[];
  selectedFeel?: TFeel;
  onFeelChange?: (feel: TFeel) => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  muted: boolean;
  onToggleMuted: () => void;
  // Optional test toggle for a per-track effect — currently Harmony-only (chorus).
  effectEnabled?: boolean;
  onToggleEffect?: () => void;
  // Optional per-voice sub-mix disclosure — currently only Drums uses this. Rendered
  // as a floating popout (not a flex sibling) so expanding never reflows the rest of
  // the layout — it overlays on top instead of squeezing the grid or other strips.
  expanded?: boolean;
  onToggleExpanded?: () => void;
  expandedContent?: React.ReactNode;
};

// Same box shape as a real StylePicker (label + select), just invisible — reserves
// its height without being focusable or announced to screen readers.
function PickerPlaceholder() {
  return (
    <div className="style-picker style-picker-placeholder" aria-hidden="true">
      <label>&nbsp;</label>
      <select disabled tabIndex={-1}>
        <option>&nbsp;</option>
      </select>
    </div>
  );
}

export function ChannelStrip<TStyle extends NamedOption, TInstrument extends NamedOption, TFeel extends NamedOption>({
  label,
  accent,
  styleOptions,
  selectedStyle,
  onStyleChange,
  instrumentOptions,
  selectedInstrument,
  onInstrumentChange,
  feelOptions,
  selectedFeel,
  onFeelChange,
  volume,
  onVolumeChange,
  muted,
  onToggleMuted,
  effectEnabled,
  onToggleEffect,
  expanded,
  onToggleExpanded,
  expandedContent,
}: Props<TStyle, TInstrument, TFeel>) {
  const classes = [
    'channel-strip',
    `channel-strip-${accent}`,
    expanded && 'channel-strip-raised',
    muted && 'channel-strip-muted',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
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
      {styleOptions && selectedStyle && onStyleChange ? (
        <StylePicker label="Style" options={styleOptions} selected={selectedStyle} onSelect={onStyleChange} />
      ) : (
        // A strip with no style picker (Metronome) still needs the vertical space
        // reserved — otherwise its fader sits higher than the other strips' faders.
        <PickerPlaceholder />
      )}
      {instrumentOptions && selectedInstrument && onInstrumentChange ? (
        <StylePicker
          label="Sound"
          options={instrumentOptions}
          selected={selectedInstrument}
          onSelect={onInstrumentChange}
        />
      ) : (
        <PickerPlaceholder />
      )}
      {feelOptions && selectedFeel && onFeelChange ? (
        <StylePicker label="Feel" options={feelOptions} selected={selectedFeel} onSelect={onFeelChange} />
      ) : (
        <PickerPlaceholder />
      )}
      <VerticalFader id={`volume-${accent}`} value={volume} onChange={onVolumeChange} />
      <button
        type="button"
        className="channel-strip-mute"
        onClick={onToggleMuted}
        aria-pressed={muted}
        aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
        title={muted ? 'Unmute' : 'Mute'}
      >
        M
      </button>
      {onToggleEffect && (
        <button
          type="button"
          className="channel-strip-fx"
          onClick={onToggleEffect}
          aria-pressed={effectEnabled}
          aria-label={effectEnabled ? 'Disable test effect' : 'Enable test effect'}
          title={effectEnabled ? 'Disable test effect (chorus)' : 'Enable test effect (chorus)'}
        >
          FX
        </button>
      )}
      <span className="channel-strip-label">{label}</span>
      {expanded && expandedContent && <div className="channel-strip-popout">{expandedContent}</div>}
    </div>
  );
}
