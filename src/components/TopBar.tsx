import { useRef } from 'react';
import { SCALE_NAMES, SCALE_LABELS } from '../data/progressions';
import type { ScaleName } from '../data/progressions';
import type { SongPreset } from '../data/songPresets';
import { SongPresetFileControls } from './SongPresetFileControls';
import { APP_NAME, APP_TITLE } from '../appInfo';
import { COUNT_IN_OPTIONS, type CountInBars } from '../audio/engine';
import type { AppMode, ViewMode } from '../App';
import type { MenuTarget } from './MenuView';

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'chordGrid', label: 'Chord Grid' },
  { value: 'leadSheet', label: 'Lead Sheet' },
];

const APP_MODE_OPTIONS: { value: MenuTarget; label: string }[] = [
  { value: 'compose', label: 'Compose' },
  { value: 'playAlong', label: 'Play Along' },
  { value: 'practice', label: 'Practice' },
];

// Which of the 3 ViewModes each of TopBar's three real AppModes actually
// shows -- Compose is Edit-only (so its own tab switcher is pointless and
// doesn't render at all, see below); Play Along switches between the two
// read-only chart views; Practice has no "views" of its own at all (one
// page, one layout), same reasoning as Compose's own single-option hiding.
// TopBar never renders for 'menu' (see App.tsx's early return), so this only
// needs the other three.
const VIEW_MODES_BY_APP_MODE: Record<'compose' | 'playAlong' | 'practice', ViewMode[]> = {
  compose: ['edit'],
  playAlong: ['chordGrid', 'leadSheet'],
  practice: [],
};

const MIN_TEMPO = 40;
const MAX_TEMPO = 220;
const TAP_RESET_GAP_MS = 2000;
const TAP_HISTORY_SIZE = 8;

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Simple meters only (always over a "4" denominator) -- see CLAUDE.md's "Beats
// per bar" section for the full scope and why 6/9/12 here mean 6/4, 9/4, 12/4,
// not the compound 6/8, 9/8, 12/8 a musician might otherwise expect.
const BEATS_PER_BAR_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 12];

type Props = {
  // Always 'compose', 'playAlong', or 'practice' -- App.tsx only ever
  // renders TopBar once past its own early return for 'menu'. Shared
  // across all three now (see CLAUDE.md's "Harmonized header" section) --
  // some fields below are hidden or disabled specifically for 'practice',
  // since Practice still can't edit song state even though it shares this
  // header.
  appMode: AppMode;
  // Switches between Compose/Play Along/Practice without leaving this header
  // -- reuses App.tsx's existing handleSelectMenuTarget (the same handler
  // MenuView's own cards call), so mode-appropriate viewMode nudging stays
  // in one place rather than being duplicated here.
  onAppModeChange: (target: MenuTarget) => void;
  onBackToMenu: () => void;
  songPresets: SongPreset[];
  onLoadSongPreset: (preset: SongPreset) => void;
  currentSongName: string;
  musicalKey: string;
  onKeyChange: (key: string) => void;
  scale: ScaleName;
  onScaleChange: (scale: ScaleName) => void;
  tempo: number;
  onTempoChange: (tempo: number) => void;
  // Moved here from the Settings modal -- see SettingsModal.tsx's own note --
  // so it's directly visible/editable in every mode, Practice included.
  countInBars: CountInBars;
  onCountInBarsChange: (bars: CountInBars) => void;
  beatsPerBar: number;
  onBeatsPerBarChange: (beatsPerBar: number) => void;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  instrumentsLoading: boolean;
  onSaveSongPreset: () => void;
  onImportSongPresetFile: (file: File) => void;
  songPresetError?: string | null;
  onOpenSettings: () => void;
  onOpenLickEditor: () => void;
};

function TopBarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="top-bar-field">
      <span className="top-bar-field-label">{label}</span>
      {children}
    </div>
  );
}

export function TopBar({
  appMode,
  onAppModeChange,
  onBackToMenu,
  songPresets,
  onLoadSongPreset,
  currentSongName,
  musicalKey,
  onKeyChange,
  scale,
  onScaleChange,
  tempo,
  onTempoChange,
  countInBars,
  onCountInBarsChange,
  beatsPerBar,
  onBeatsPerBarChange,
  viewMode,
  onViewModeChange,
  isPlaying,
  onTogglePlay,
  instrumentsLoading,
  onSaveSongPreset,
  onImportSongPresetFile,
  songPresetError,
  onOpenSettings,
  onOpenLickEditor,
}: Props) {
  const tapTimesRef = useRef<number[]>([]);
  // Practice can't edit the song's own key/scale/meter or switch songs from
  // here (see App.tsx's own "read-only slice" note) -- everything else in
  // this header (mode switcher, tempo/count-in, Settings, Lick Editor) stays
  // fully live in every mode.
  const isPractice = appMode === 'practice';
  // Meter (beatsPerBar) is real song *structure* -- changing it reflows every
  // bar in the chart, not a listening preference like Key/Scale can arguably
  // be (transposing to follow along in a different key is a legitimate Play
  // Along use, per direct user distinction between the two) -- so it's
  // editable in Compose only, not just "not Practice" like Key/Scale/Song
  // are. Per direct user feedback: "Should not be able to change time
  // signature in play along mode."
  const meterLocked = appMode !== 'compose';
  // Guaranteed to be 'compose', 'playAlong', or 'practice' (see Props' own
  // comment) -- the fallback here is just so a stray/impossible appMode value
  // degrades to "show every tab" rather than showing none.
  const allowedViewModes =
    VIEW_MODES_BY_APP_MODE[appMode as 'compose' | 'playAlong' | 'practice'] ?? VIEW_MODE_OPTIONS.map((o) => o.value);
  const visibleViewModeOptions = VIEW_MODE_OPTIONS.filter((o) => allowedViewModes.includes(o.value));

  const handleTapTempo = () => {
    const now = performance.now();
    const times = tapTimesRef.current;
    const last = times[times.length - 1];
    if (last !== undefined && now - last > TAP_RESET_GAP_MS) {
      times.length = 0; // gap too long — this tap starts a fresh sequence
    }
    times.push(now);
    if (times.length > TAP_HISTORY_SIZE) times.shift();
    if (times.length < 2) return; // need at least one interval to estimate a tempo

    const intervals = times.slice(1).map((t, i) => t - times[i]);
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgMs);
    onTempoChange(Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, bpm)));
  };

  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <div className="top-bar-brand">
          <h1 className="app-title">{APP_TITLE}</h1>
          <a
            href="https://www.buymeacoffee.com/andrewsg"
            target="_blank"
            rel="noopener noreferrer"
            className="coffee-link"
          >
            ☕ Support {APP_NAME}
          </a>
        </div>

        {/* "← Menu" (back to the landing screen) and the mode switcher (lateral
            movement between Compose/Play Along/Practice) used to be two
            separate controls in different parts of the header -- a plain
            standalone button in the brand corner, then a whole second switcher
            over here -- which read as redundant per direct user feedback, even
            though they're technically different actions. Folded into one
            cluster: "← Menu" is just the first, non-"tab" button in the same
            view-mode-switch row, so it reads as one navigation control instead
            of two competing ones. */}
        <TopBarField label="Mode">
          <div className="view-mode-switch" role="tablist" aria-label="Mode">
            <button type="button" className="view-mode-button" onClick={onBackToMenu} title="Back to Menu">
              ← Menu
            </button>
            {APP_MODE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={appMode === value}
                className={`view-mode-button${appMode === value ? ' view-mode-button-active' : ''}`}
                onClick={() => onAppModeChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </TopBarField>

        <TopBarField label="Song">
          <div className="top-bar-song-group">
            <select
              id="song-preset-quick"
              aria-label="Song preset"
              value={currentSongName}
              disabled={isPractice}
              onChange={(e) => {
                const preset = songPresets.find((p) => p.name === e.target.value);
                if (preset) onLoadSongPreset(preset);
              }}
            >
              {/* Shown when the title's been edited (or a custom preset loaded) and no
                  longer matches a bundled preset name — keeps the select's value valid. */}
              {!songPresets.some((p) => p.name === currentSongName) && (
                <option value={currentSongName}>{currentSongName}</option>
              )}
              {songPresets.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </select>
            {/* Save/import/print are editing/export actions -- hidden entirely in
                Practice (not just disabled) since they have no meaning when
                nothing on this page can be edited, same as the Play button and
                the View tabs below being hidden there instead of just grayed out. */}
            {!isPractice && (
              <>
                <SongPresetFileControls
                  onSave={onSaveSongPreset}
                  onImportFile={onImportSongPresetFile}
                  error={songPresetError}
                  compact
                />
                <button
                  type="button"
                  className="top-bar-icon-button"
                  onClick={() => window.print()}
                  title="Print sheet (or save as PDF via the browser's print dialog)"
                  aria-label="Print sheet"
                >
                  🖨️
                </button>
              </>
            )}
          </div>
        </TopBarField>

        <TopBarField label="Key">
          <div className="top-bar-key-group">
            <select
              id="top-bar-key"
              aria-label="Key"
              value={musicalKey}
              disabled={isPractice}
              onChange={(e) => onKeyChange(e.target.value)}
            >
              {/* Some presets use a flat spelling (e.g. "Bb") not in the canonical
                  sharp-only KEYS list — inject it so the select shows it correctly
                  instead of silently falling back to whichever option is first. */}
              {!KEYS.includes(musicalKey) && <option value={musicalKey}>{musicalKey}</option>}
              {KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              id="top-bar-scale"
              aria-label="Scale"
              value={scale}
              disabled={isPractice}
              onChange={(e) => onScaleChange(e.target.value as ScaleName)}
            >
              {SCALE_NAMES.map((s) => (
                <option key={s} value={s}>
                  {SCALE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </TopBarField>

        <TopBarField label="Meter">
          <select
            id="top-bar-beats-per-bar"
            aria-label="Beats per bar"
            value={beatsPerBar}
            disabled={meterLocked}
            onChange={(e) => onBeatsPerBarChange(Number(e.target.value))}
          >
            {/* A preset can carry a beatsPerBar outside this app's own picker list
                (hand-authored JSON, or a future value this list hasn't caught up
                to yet) -- inject it so the select shows it correctly instead of
                silently falling back to whichever option is first. */}
            {!BEATS_PER_BAR_OPTIONS.includes(beatsPerBar) && (
              <option value={beatsPerBar}>{beatsPerBar}/4</option>
            )}
            {BEATS_PER_BAR_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}/4
              </option>
            ))}
          </select>
        </TopBarField>

        {/* Compose only ever shows Edit -- nothing to switch between, so no tab
            switcher at all rather than a single, pointless tab. */}
        {visibleViewModeOptions.length > 1 && (
          <TopBarField label="View">
            <div className="view-mode-switch" role="tablist" aria-label="View">
              {visibleViewModeOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === value}
                  className={`view-mode-button${viewMode === value ? ' view-mode-button-active' : ''}`}
                  onClick={() => onViewModeChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </TopBarField>
        )}

        <TopBarField label="Tempo">
          <div className="top-bar-tempo-group">
            <input
              id="top-bar-tempo"
              aria-label="Tempo"
              type="number"
              min={MIN_TEMPO}
              max={MAX_TEMPO}
              value={tempo}
              onChange={(e) => onTempoChange(Number(e.target.value))}
            />
            <span>bpm</span>
            <button
              type="button"
              className="tap-tempo-button"
              onClick={handleTapTempo}
              title="Tap to set tempo"
            >
              Tap
            </button>
          </div>
        </TopBarField>

        {/* Moved here from the Settings modal (see SettingsModal.tsx's own
            note) -- directly visible/editable next to Tempo in every mode,
            Practice included, rather than buried in a modal. */}
        <TopBarField label="Count-in">
          <select
            id="top-bar-count-in"
            aria-label="Count-in before play starts"
            value={countInBars}
            onChange={(e) => onCountInBarsChange(Number(e.target.value) as CountInBars)}
          >
            {COUNT_IN_OPTIONS.map((bars) => (
              <option key={bars} value={bars}>
                {bars === 0 ? 'Off' : `${bars} bar${bars === 1 ? '' : 's'}`}
              </option>
            ))}
          </select>
        </TopBarField>

        {/* Play/Stop is page-specific in Practice instead (its own button
            next to its own chart, wired to this same onTogglePlay/isPlaying --
            see ScaleArpeggioTrainer.tsx) -- hidden here rather than duplicated,
            per direct user feedback on where Play should live per page. */}
        {!isPractice && (
          <button
            type="button"
            className="play-button-prominent"
            onClick={onTogglePlay}
            disabled={!isPlaying && instrumentsLoading}
            title={!isPlaying && instrumentsLoading ? 'Loading instrument samples…' : undefined}
          >
            {!isPlaying && instrumentsLoading ? 'Loading…' : isPlaying ? '■ Stop' : '▶ Play'}
          </button>
        )}

        <button
          type="button"
          className="top-bar-icon-button"
          onClick={onOpenLickEditor}
          title="Lick Editor — program a guitar lick with real fret/string fingerings"
          aria-label="Open lick editor"
        >
          🎸
        </button>

        <button
          type="button"
          className="top-bar-icon-button"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
