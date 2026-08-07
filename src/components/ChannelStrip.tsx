import { StylePicker } from './StylePicker';
import { VerticalFader } from './VerticalFader';

type NamedOption = { name: string };

type Props<TStyle extends NamedOption, TInstrument extends NamedOption, TFeel extends NamedOption> = {
  label: string;
  accent: 'drums' | 'bass' | 'harmony' | 'metronome' | 'melody' | 'master';
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
  // Optional — Master has no mute concept, unlike every real instrument track.
  muted?: boolean;
  onToggleMuted?: () => void;
  // Zero or more per-track effect toggles (Harmony: Chorus/Reverb; Bass: Comp) —
  // each is its own always-connected node whose wet/amount just flips on/off
  // (see keys.ts/bass.ts), not something rewiring the audio graph live.
  effects?: { key: string; label: string; enabled: boolean; onToggle: () => void }[];
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
  effects,
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
      {onToggleMuted && (
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
      )}
      {effects && effects.length > 0 && (
        <div className="channel-strip-fx-row">
          {effects.map((fx) => (
            <button
              key={fx.key}
              type="button"
              className="channel-strip-fx"
              onClick={fx.onToggle}
              aria-pressed={fx.enabled}
              aria-label={fx.enabled ? `Disable ${fx.label}` : `Enable ${fx.label}`}
              title={fx.enabled ? `Disable ${fx.label}` : `Enable ${fx.label}`}
            >
              {fx.label}
            </button>
          ))}
        </div>
      )}
      <span className="channel-strip-label">{label}</span>
      {expanded && expandedContent && <div className="channel-strip-popout">{expandedContent}</div>}
    </div>
  );
}
