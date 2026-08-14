import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChordPlacement, NotationStyle, ScaleName } from '../data/progressions';
import { resolveSelection } from '../data/progressions';
import { BeatGridSheet, ChordLabel } from './BeatGridSheet';
import {
  baseBassStyles,
  baseDrumStyles,
  bassInstruments,
  drumsInstruments,
  keysInstruments,
  keysStyles,
  type BassStyle,
  type DrumStyle,
} from '../data/instrumentStyles';
import { loadBundledDrumStyles } from '../data/drumLibrary';
import { loadBundledBassStyles } from '../data/bassLibrary';
import type { SectionMarker } from '../data/sections';
import { bundledSongPresets, resolveLoopRange, resolveSongPreset, type SongPreset } from '../data/songPresets';
import { APP_NAME, APP_TITLE } from '../appInfo';
import {
  getCurrentBeat,
  isBassInstrumentLoaded,
  isKeysInstrumentLoaded,
  play,
  setBassInstrument,
  setBassMuted,
  setBassVolume,
  setChordsInstrument,
  setChordsMuted,
  setChordsVolume,
  setDrumsInstrument,
  setDrumsMuted,
  setDrumsVolume,
  setMasterVolume,
  setMetronomeMuted,
  setMetronomeVolume,
  setTempo as setTransportTempo,
  onAutoStop,
  setAutoStopOnHide,
  stop,
  COUNT_IN_OPTIONS,
  type CountInBars,
} from '../audio/engine';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DEFAULT_KEYS_STYLE = keysStyles.find((s) => s.name === 'Sustained 7ths')!;
const DEFAULT_BASS_STYLE = baseBassStyles.find((s) => s.name === 'Walking')!;

// Same tap-tempo timing as TopBar.tsx's own desktop implementation (a gap
// this long resets the tap sequence; only the last N taps count toward the
// estimate) -- min/max stay this file's own existing slider range (40-240),
// not desktop's, so the Tap button can't push tempo somewhere the slider
// itself couldn't reach.
const TAP_RESET_GAP_MS = 2000;
const TAP_HISTORY_SIZE = 8;
const MIN_TEMPO = 40;
const MAX_TEMPO = 240;

type Track = 'drums' | 'bass' | 'keys';

// Same starting points as the desktop mixer (App.tsx) — tracks at 70% for
// headroom, master/metronome at 100% — except drums, which start quieter here:
// on a phone's small speaker the drum samples otherwise dominate the mix.
const DEFAULT_VOLUMES = { master: 100, drums: 30, bass: 80, keys: 60, metronome: 100 };

// UI-only preferences (not song data — those still stay JSON-file-only, per
// CLAUDE.md's no-accounts/no-server-side stance). Small enough, and unrelated
// enough to that constraint's actual reasoning, to justify the one
// localStorage exception in an otherwise storage-free app.
const PREFS_STORAGE_KEY = 'jazzmate-mobile-prefs';
type NowPlayingStyle = 'countdown' | 'grid';
type StoredPrefs = {
  volumes?: typeof DEFAULT_VOLUMES;
  accentColor?: string;
  notationStyle?: NotationStyle;
  countInBars?: CountInBars;
  nowPlayingStyle?: NowPlayingStyle;
};

function loadStoredPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredPrefs(prefs: StoredPrefs): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing, storage disabled/full, etc. — preferences just won't
    // persist this session, not worth surfacing as an error.
  }
}

// The URL's ?song= name wins over the first bundled preset, so a refresh (or a
// shared link) reopens whatever song was actually loaded rather than always the
// alphabetically-first one — same convention App.tsx already uses on desktop.
const urlSongName = new URLSearchParams(window.location.search).get('song');
const DEFAULT_MOBILE_PRESET =
  bundledSongPresets.find((p) => p.name === urlSongName) ?? bundledSongPresets[0] ?? null;

/** Keeps ?song= in sync with whatever's actually loaded, without adding a
 * back-button stop per song switch — a plain refresh should reopen the same
 * song, not navigate. Same idea as App.tsx's own setSongInUrl; kept as a
 * separate copy here since the two views share no common "app shell" module to
 * hang one shared helper off of. */
function setSongInUrl(name: string | null): void {
  const url = new URL(window.location.href);
  if (name) url.searchParams.set('song', name);
  else url.searchParams.delete('song');
  window.history.replaceState(null, '', url);
}

/**
 * Playback-only companion view for phones — a bundled song, a scrolling chord
 * chart, and transport/key/tempo controls. Deliberately can't build or edit a
 * progression (that's ChordGrid's job, and its drag/resize/select interactions
 * don't translate to touch); see the "Direction" notes in CLAUDE.md.
 */
export function MobilePlayer() {
  const [preset, setPreset] = useState<SongPreset | null>(DEFAULT_MOBILE_PRESET);
  const [musicalKey, setMusicalKey] = useState(preset?.key ?? 'C');
  const [scale, setScale] = useState<ScaleName>(preset?.scale ?? 'major');
  const [tempo, setTempoState] = useState(preset?.tempo ?? 120);
  // Playback-only, like key/scale/tempo above -- no mobile UI edits this (see
  // CLAUDE.md's mobile non-goals), just read straight from whichever preset is
  // loaded. Simple meter only, always over a "4" denominator -- see CLAUDE.md's
  // "Beats per bar" section.
  const beatsPerBar = preset?.beatsPerBar ?? 4;
  const [drumStyles, setDrumStyles] = useState<DrumStyle[]>(baseDrumStyles);
  const [bassStyles, setBassStyles] = useState<BassStyle[]>(baseBassStyles);
  const [isPlaying, setIsPlaying] = useState(false);
  // Same reasoning as App.tsx's own countInActive — the engine delays the
  // Transport's actual start by the count-in's real duration, but isPlaying
  // goes true immediately, so without this the beat-grid chart's active-chord
  // highlight would jump onto the first chord during the count-in clicks.
  const [countInActive, setCountInActive] = useState(false);
  const countInTimeoutRef = useRef<number | null>(null);
  const [playheadBeat, setPlayheadBeat] = useState(0);
  // true = audible — the button lights up when a track is ON, same convention as
  // the metronome button, rather than lighting up when muted (which read backwards:
  // a bright/highlighted button next to a plain one should mean "this is playing,"
  // not "this is the one I've silenced").
  const [trackOn, setTrackOn] = useState<Record<Track, boolean>>({
    drums: true,
    bass: true,
    keys: true,
  });
  // Defaults on regardless of the preset's own saved `metronome` value (many
  // bundled presets save it off) — a practice companion wants the click track
  // audible by default, even if desktop respects each song's own saved choice.
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volumes, setVolumes] = useState(() => loadStoredPrefs().volumes ?? DEFAULT_VOLUMES);
  const [notationStyle, setNotationStyle] = useState<NotationStyle>(
    () => loadStoredPrefs().notationStyle ?? 'symbol',
  );
  const [countInBars, setCountInBars] = useState<CountInBars>(() => loadStoredPrefs().countInBars ?? 0);
  // 'countdown': the existing Current + Next chord readout. 'grid': the same
  // BeatGridSheet chart the scrolling chart above already uses, fullscreen —
  // closer to what the desktop compact grid view looks like during playback.
  const [nowPlayingStyle, setNowPlayingStyle] = useState<NowPlayingStyle>(
    () => loadStoredPrefs().nowPlayingStyle ?? 'countdown',
  );
  // Falls back to whatever --accent already resolved to (light/dark default) if
  // nothing's stored yet — a manual pick simply overrides that CSS variable at
  // the root.
  const [accentColor, setAccentColor] = useState(
    () => loadStoredPrefs().accentColor ?? getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentColor);
  }, [accentColor]);

  useEffect(() => {
    saveStoredPrefs({ volumes, notationStyle, accentColor, countInBars, nowPlayingStyle });
  }, [volumes, notationStyle, accentColor, countInBars, nowPlayingStyle]);

  const handleResetAccent = () => {
    document.documentElement.style.removeProperty('--accent');
    setAccentColor(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  };

  useEffect(() => {
    let cancelled = false;
    loadBundledDrumStyles().then((loaded) => {
      if (!cancelled) setDrumStyles([...baseDrumStyles, ...loaded]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadBundledBassStyles().then((loaded) => {
      if (!cancelled) setBassStyles([...baseBassStyles, ...loaded]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = useMemo(
    () => (preset ? resolveSongPreset(preset) : { placements: [], sections: [] }),
    [preset],
  );
  const resolvedPlacements = resolved.placements;
  const loopRange = useMemo(
    () => (preset ? resolveLoopRange(preset, resolvedPlacements) : { loopStart: 0, loopEnd: 0 }),
    [preset, resolvedPlacements],
  );
  const placements: ChordPlacement[] = useMemo(
    () => resolvedPlacements.map((p, i) => ({ id: `mobile-${i}`, ...p })),
    [resolvedPlacements],
  );
  const sections: SectionMarker[] = useMemo(
    () => resolved.sections.map((s, i) => ({ id: `mobile-section-${i}`, ...s })),
    [resolved],
  );

  const drumStyle = useMemo(
    () => (preset?.customDrumPattern
      ? { name: preset.drumStyle, pattern: preset.customDrumPattern }
      : (drumStyles.find((s) => s.name === preset?.drumStyle) ?? drumStyles[0])),
    [drumStyles, preset],
  );
  const bassStyle = useMemo(
    () => bassStyles.find((s) => s.name === preset?.bassStyle) ?? DEFAULT_BASS_STYLE,
    [bassStyles, preset],
  );
  const keysStyle = useMemo(
    () => keysStyles.find((s) => s.name === preset?.keysStyle) ?? DEFAULT_KEYS_STYLE,
    [preset],
  );
  const chordsInstrument = useMemo(
    () => keysInstruments.find((i) => i.name === preset?.chordsInstrument) ?? keysInstruments[0],
    [preset],
  );
  const bassInstrument = useMemo(
    () => bassInstruments.find((i) => i.name === preset?.bassInstrument) ?? bassInstruments[0],
    [preset],
  );
  const drumsInstrument = useMemo(
    () => drumsInstruments.find((i) => i.name === preset?.drumsInstrument) ?? drumsInstruments[0],
    [preset],
  );

  useEffect(() => setChordsInstrument(chordsInstrument.name), [chordsInstrument]);
  useEffect(() => setBassInstrument(bassInstrument.name), [bassInstrument]);
  useEffect(() => setDrumsInstrument(drumsInstrument.name), [drumsInstrument]);

  // Same polling gate as App.tsx — sample-based instruments (Acoustic Piano etc.)
  // load asynchronously, so Play stays disabled until buffers are ready.
  const [instrumentsLoading, setInstrumentsLoading] = useState(true);
  useEffect(() => {
    const checkLoaded = () => isKeysInstrumentLoaded() && isBassInstrumentLoaded();
    if (checkLoaded()) {
      setInstrumentsLoading(false);
      return;
    }
    setInstrumentsLoading(true);
    const interval = window.setInterval(() => {
      if (checkLoaded()) {
        setInstrumentsLoading(false);
        window.clearInterval(interval);
      }
    }, 150);
    return () => window.clearInterval(interval);
  }, [chordsInstrument, bassInstrument]);

  useEffect(() => {
    stop();
    setIsPlaying(false);
    setPlayheadBeat(0);
    setSongInUrl(preset?.name ?? null);
    if (preset) {
      setMusicalKey(preset.key);
      setScale(preset.scale);
      setTempoState(preset.tempo);
      // Not preset.metronome — see metronomeOn's own doc comment for why mobile
      // always starts a freshly loaded song with the click track on.
      setMetronomeOn(true);
    }
  }, [preset]);

  useEffect(() => {
    if (isPlaying) setTransportTempo(tempo);
  }, [tempo, isPlaying]);

  // A plain interval, not requestAnimationFrame — unlike App.tsx's desktop grid
  // (which needs a smoothly-sweeping pixel-position playhead cursor), nothing
  // here needs sub-beat resolution: playheadBeat only ever drives discrete
  // per-beat comparisons (chart highlighting, the countdown, section lookup).
  // Polling 60x/sec just to floor() the same value repeatedly is real, avoidable
  // main-thread work — on a loaded/throttled phone that's exactly the kind of
  // contention that can push Tone.js's own scheduling past its lookahead window
  // and cause the "rushed" glitch (see onAutoStop's neighboring comment in
  // audio/engine.ts for the same failure mode's more severe, backgrounded form).
  // 100ms is still far tighter than a beat at any real tempo.
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setPlayheadBeat(Math.floor(getCurrentBeat()));
    }, 100);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => setDrumsMuted(!trackOn.drums), [trackOn.drums]);
  useEffect(() => setBassMuted(!trackOn.bass), [trackOn.bass]);
  useEffect(() => setChordsMuted(!trackOn.keys), [trackOn.keys]);
  useEffect(() => setMetronomeMuted(!metronomeOn), [metronomeOn]);

  useEffect(() => setMasterVolume(volumes.master), [volumes.master]);
  useEffect(() => setDrumsVolume(volumes.drums), [volumes.drums]);
  useEffect(() => setBassVolume(volumes.bass), [volumes.bass]);
  useEffect(() => setChordsVolume(volumes.keys), [volumes.keys]);
  useEffect(() => setMetronomeVolume(volumes.metronome), [volumes.metronome]);

  // Stop the transport on unmount rather than leaving it running behind a torn-down view.
  useEffect(() => () => stop(), []);

  // Opt into engine.ts's backgrounding-stops-playback behavior -- desktop
  // (App.tsx) deliberately never does, since only mobile browsers actually
  // suspend the AudioContext on backgrounding (see setAutoStopOnHide's own
  // doc comment).
  useEffect(() => {
    setAutoStopOnHide(true);
    return () => setAutoStopOnHide(false);
  }, []);

  // Backgrounding the page (screen lock, minimizing, even just the notification
  // shade being pulled down) can force the engine to stop itself — see onAutoStop's
  // doc comment in audio/engine.ts. Sync the UI rather than leaving the now-playing
  // modal up over silence.
  useEffect(() => onAutoStop(() => {
    if (countInTimeoutRef.current !== null) {
      window.clearTimeout(countInTimeoutRef.current);
      countInTimeoutRef.current = null;
    }
    setIsPlaying(false);
    setCountInActive(false);
    setPlayheadBeat(0);
  }), []);

  // Unlike desktop's TopBar.tsx, changing tempo here always stops playback
  // first if it's running -- both the slider (a continuous touch drag, which
  // would otherwise scrub the tempo audibly on every tick) and this Tap
  // button (see tapTimesRef below) route through this, matching the desktop/
  // mobile split the user asked for: Tap keeps playing on desktop, stops on
  // mobile.
  const stopIfPlaying = () => {
    if (!isPlaying) return;
    if (countInTimeoutRef.current !== null) {
      window.clearTimeout(countInTimeoutRef.current);
      countInTimeoutRef.current = null;
    }
    stop();
    setIsPlaying(false);
    setCountInActive(false);
    setPlayheadBeat(0);
  };

  const tapTimesRef = useRef<number[]>([]);
  const handleTapTempo = () => {
    const now = performance.now();
    const times = tapTimesRef.current;
    const last = times[times.length - 1];
    if (last !== undefined && now - last > TAP_RESET_GAP_MS) {
      times.length = 0;
    }
    times.push(now);
    if (times.length > TAP_HISTORY_SIZE) times.shift();
    if (times.length < 2) return;

    const intervals = times.slice(1).map((t, i) => t - times[i]);
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgMs);
    setTempoState(Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, bpm)));
    stopIfPlaying();
  };

  const handleTogglePlay = useCallback(async () => {
    if (countInTimeoutRef.current !== null) {
      window.clearTimeout(countInTimeoutRef.current);
      countInTimeoutRef.current = null;
    }
    if (isPlaying) {
      stop();
      setIsPlaying(false);
      setCountInActive(false);
      setPlayheadBeat(0);
      return;
    }
    if (!preset || placements.length === 0 || instrumentsLoading) return;
    if (countInBars > 0) {
      setCountInActive(true);
      countInTimeoutRef.current = window.setTimeout(() => {
        setCountInActive(false);
        countInTimeoutRef.current = null;
      }, (countInBars * beatsPerBar * 60 * 1000) / tempo);
    }
    await play({
      key: musicalKey,
      scale,
      placements,
      loopStartBeat: loopRange.loopStart,
      loopEndBeat: loopRange.loopEnd,
      startBeat: 0,
      tempo,
      drums: drumStyle.pattern,
      drumsTimeFeel: preset.drumsTimeFeel ?? 'normal',
      bass: bassStyle.rule,
      bassPattern: bassStyle.pattern ?? null,
      bassTimeFeel: preset.bassTimeFeel ?? 'normal',
      keys: keysStyle.rule,
      keysTimeFeel: preset.keysTimeFeel ?? 'normal',
      melody: preset.melody ?? [],
      sections,
      countInBars,
      beatsPerBar,
    });
    setIsPlaying(true);
  }, [
    isPlaying,
    preset,
    placements,
    musicalKey,
    scale,
    loopRange,
    tempo,
    drumStyle,
    bassStyle,
    keysStyle,
    sections,
    countInBars,
    instrumentsLoading,
    beatsPerBar,
  ]);

  const currentChordIndex = isPlaying
    ? placements.findIndex((p) => playheadBeat >= p.startBeat && playheadBeat < p.startBeat + p.lengthBeats)
    : -1;
  const currentPlacement = currentChordIndex !== -1 ? placements[currentChordIndex] : null;
  const nextPlacement =
    currentChordIndex !== -1 ? placements[(currentChordIndex + 1) % placements.length] : null;
  // Counts down to the next chord change, not up from the start of this one — a
  // glance should tell you "how long until I need to move my hand," not "how long
  // have I been here."
  const beatsUntilNextChord = currentPlacement
    ? currentPlacement.startBeat + currentPlacement.lengthBeats - playheadBeat
    : 0;
  // The section marker in effect at the playhead — a marker covers from its own
  // startBeat until the next one begins, so this is the latest marker reached so
  // far, not a range-containment check (there can be gaps, and the last section
  // should keep showing through to the end of the song).
  const currentSection = isPlaying
    ? sections.reduce<SectionMarker | null>(
        (latest, s) => (s.startBeat <= playheadBeat && (!latest || s.startBeat > latest.startBeat) ? s : latest),
        null,
      )
    : null;

  if (!preset) {
    return (
      <div className="mobile-player">
        <p className="mobile-player__empty">No songs available.</p>
      </div>
    );
  }

  return (
    <div className="mobile-player">
      <div className="mobile-player__topbar">
        <h1 className="app-title">{APP_TITLE}</h1>
        <button
          className="mobile-player__settings-button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Volume settings"
        >
          ⚙
        </button>
      </div>

      <header className="mobile-player__header">
        <select
          className="mobile-player__preset-picker"
          value={preset.name}
          onChange={(e) => setPreset(bundledSongPresets.find((p) => p.name === e.target.value) ?? preset)}
          aria-label="Song"
        >
          {bundledSongPresets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        {preset.author && <div className="mobile-player__author">{preset.author}</div>}
        {preset.playStyle && <div className="mobile-player__play-style">{preset.playStyle}</div>}
      </header>

      <div className="mobile-player__paper">
        <BeatGridSheet
          placements={placements}
          musicalKey={musicalKey}
          scale={scale}
          notationStyle={notationStyle}
          playheadBeat={playheadBeat}
          isPlaying={isPlaying && !countInActive}
          sections={sections}
          beatsPerBar={beatsPerBar}
        />
      </div>

      <div className="mobile-player__controls">
        <div className="mobile-player__row">
          <label className="mobile-player__field">
            <span>Key</span>
            <select value={musicalKey} onChange={(e) => setMusicalKey(e.target.value)}>
              {KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="mobile-player__field mobile-player__field--grow">
            <span>Tempo {tempo}</span>
            <input
              type="range"
              min={MIN_TEMPO}
              max={MAX_TEMPO}
              value={tempo}
              onChange={(e) => {
                // A continuous touch-drag slider -- letting it live-update
                // playback would scrub the tempo audibly on every drag tick,
                // unlike desktop's discrete Tap button. Stop instead, and let
                // the user resume once they've settled on a tempo.
                setTempoState(Number(e.target.value));
                stopIfPlaying();
              }}
            />
          </label>
          <button type="button" className="mobile-player__tap-tempo" onClick={handleTapTempo} title="Tap to set tempo">
            Tap
          </button>
        </div>

        <button
          className="mobile-player__play"
          onClick={handleTogglePlay}
          disabled={instrumentsLoading}
        >
          {instrumentsLoading ? 'Loading…' : isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        <div className="mobile-player__mutes">
          {(['drums', 'bass', 'keys'] as const).map((track) => (
            <button
              key={track}
              className={'mobile-player__mute' + (trackOn[track] ? ' mobile-player__mute--active' : '')}
              onClick={() => setTrackOn((t) => ({ ...t, [track]: !t[track] }))}
              aria-pressed={trackOn[track]}
            >
              {track}
            </button>
          ))}
          <button
            className={'mobile-player__mute' + (metronomeOn ? ' mobile-player__mute--active' : '')}
            onClick={() => setMetronomeOn((v) => !v)}
            aria-pressed={metronomeOn}
          >
            metronome
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div
          className="mobile-player__settings-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Volume settings"
          onClick={() => setSettingsOpen(false)}
        >
          <div className="mobile-player__settings" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-player__settings-header">
              <h2>Settings</h2>
              <button
                className="mobile-player__settings-close"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <h3 className="mobile-player__settings-subheading">Appearance</h3>
            <label className="mobile-player__settings-row">
              <span>Notation</span>
              <select
                className="mobile-player__settings-select"
                value={notationStyle}
                onChange={(e) => setNotationStyle(e.target.value as NotationStyle)}
                aria-label="Chord notation style"
              >
                <option value="symbol">Symbol (-, °, ^7)</option>
                <option value="written">Written (m, dim, maj7)</option>
              </select>
            </label>
            <label className="mobile-player__settings-row">
              <span>Accent</span>
              <input
                type="color"
                className="mobile-player__settings-color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                aria-label="Accent color"
              />
              <button
                className="mobile-player__settings-reset"
                onClick={handleResetAccent}
                aria-label="Reset accent color to default"
              >
                ↺
              </button>
            </label>

            <h3 className="mobile-player__settings-subheading">Playback</h3>
            <label className="mobile-player__settings-row">
              <span>Count-in</span>
              <select
                className="mobile-player__settings-select"
                value={countInBars}
                onChange={(e) => setCountInBars(Number(e.target.value) as CountInBars)}
                aria-label="Count-in before play starts"
              >
                {COUNT_IN_OPTIONS.map((bars) => (
                  <option key={bars} value={bars}>
                    {bars === 0 ? 'Off' : `${bars} bar${bars === 1 ? '' : 's'}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="mobile-player__settings-row">
              <span>Now Playing</span>
              <select
                className="mobile-player__settings-select"
                value={nowPlayingStyle}
                onChange={(e) => setNowPlayingStyle(e.target.value as NowPlayingStyle)}
                aria-label="Now-playing display style"
              >
                <option value="countdown">Current + Next</option>
                <option value="grid">Grid</option>
              </select>
            </label>

            <h3 className="mobile-player__settings-subheading">Volume</h3>
            {(
              [
                ['master', 'Master'],
                ['drums', 'Drums'],
                ['bass', 'Bass'],
                ['keys', 'Keys'],
                ['metronome', 'Metronome'],
              ] as const
            ).map(([key, label]) => (
              <label className="mobile-player__settings-row" key={key}>
                <span>{label}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volumes[key]}
                  onChange={(e) => setVolumes((v) => ({ ...v, [key]: Number(e.target.value) }))}
                />
                <span className="mobile-player__settings-value">{volumes[key]}</span>
              </label>
            ))}

            <a
              href="https://www.buymeacoffee.com/andrewsg"
              target="_blank"
              rel="noopener noreferrer"
              className="mobile-player__settings-coffee-link"
            >
              ☕ Support {APP_NAME}
            </a>
          </div>
        </div>
      )}

      {isPlaying && currentPlacement && nowPlayingStyle === 'countdown' && (
        <div className="mobile-player__now-playing" role="dialog" aria-modal="true" aria-label="Now playing">
          {currentSection && (
            <div className="mobile-player__now-playing-section">{currentSection.label}</div>
          )}
          <div className="mobile-player__now-playing-row">
            <span className="mobile-player__now-playing-current">
              <ChordLabel
                chord={resolveSelection(musicalKey, scale, currentPlacement.selection)}
                notation={notationStyle}
              />
            </span>
            <span className="mobile-player__now-playing-countdown">{beatsUntilNextChord}</span>
          </div>
          {nextPlacement && (
            <div className="mobile-player__now-playing-row mobile-player__now-playing-row--next">
              <span className="mobile-player__now-playing-next">
                <ChordLabel
                  chord={resolveSelection(musicalKey, scale, nextPlacement.selection)}
                  notation={notationStyle}
                />
              </span>
              <span className="mobile-player__now-playing-next-duration">{nextPlacement.lengthBeats}</span>
            </div>
          )}
          <button className="mobile-player__now-playing-stop" onClick={handleTogglePlay}>
            ■ Stop
          </button>
        </div>
      )}

      {/* Same idea as the countdown modal above, styled like the desktop compact
          grid view instead — the full chart with the current bar highlighted,
          rather than a big current/next readout. Picked in Settings
          (nowPlayingStyle), not a separate button — it replaces the countdown
          modal rather than adding a third always-visible view. */}
      {isPlaying && currentPlacement && nowPlayingStyle === 'grid' && (
        <div
          className="mobile-player__now-playing mobile-player__now-playing--grid"
          role="dialog"
          aria-modal="true"
          aria-label="Now playing"
        >
          {currentSection && (
            <div className="mobile-player__now-playing-section">{currentSection.label}</div>
          )}
          <div className="mobile-player__now-playing-grid-chart beat-grid-sheet-page">
            <BeatGridSheet
              placements={placements}
              musicalKey={musicalKey}
              scale={scale}
              notationStyle={notationStyle}
              playheadBeat={playheadBeat}
              isPlaying={isPlaying && !countInActive}
              sections={sections}
              beatsPerBar={beatsPerBar}
            />
          </div>
          <button className="mobile-player__now-playing-stop" onClick={handleTogglePlay}>
            ■ Stop
          </button>
        </div>
      )}
    </div>
  );
}
