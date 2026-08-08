import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Chord, ChordPlacement, NotationStyle, ScaleName } from '../data/progressions';
import { chordName, chordNameParts, resolveSelection } from '../data/progressions';
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
import { bundledSongPresets, resolveLoopRange, resolvePlacementStarts, type SongPreset } from '../data/songPresets';
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
  stop,
} from '../audio/engine';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Four 4/4 bars per line — the minimal "chord + blanks for its held duration" chart
// shape the user described, not real rhythm notation (see CLAUDE.md's melody
// notation section for why this codebase doesn't attempt that).
const BEATS_PER_BAR = 4;
const BARS_PER_ROW = 4;
const BEATS_PER_ROW = BEATS_PER_BAR * BARS_PER_ROW;

type BeatCell = {
  beat: number;
  placement: ChordPlacement | null;
  // What this cell shows: 'name' for a chord's actual label (whether it starts
  // exactly here — anywhere within a bar — or this bar simply hasn't matched the
  // previous one yet), 'repeat' for the "%" same-as-last-bar mark, or null (blank,
  // either mid-bar hold or silence). A chord held across a bar line is *not* the
  // same as the mark being blank there — e.g. one chord spanning bars 1-2 should
  // read "name" then "%", not "name" then nothing, so it stays visibly "the same
  // chord, still sounding" rather than looking unmarked.
  mark: 'name' | 'repeat' | null;
};

// A run of consecutive beat cells rendered as one grid item (via CSS grid-column
// spanning) rather than one item per beat — lets a "%" or chord name center itself
// against its actual visual width (a whole bar, half a bar, whatever it really
// spans) instead of always centering within a single 1-beat-wide cell. A run never
// crosses a bar line: every bar boundary always carries its own mark (see
// beatCells above), which is exactly what ends the previous run.
type BeatRun = {
  startBeat: number;
  length: number;
  placement: ChordPlacement | null;
  mark: 'name' | 'repeat' | null;
};
const DEFAULT_KEYS_STYLE = keysStyles.find((s) => s.name === 'Sustained 7ths')!;
const DEFAULT_BASS_STYLE = baseBassStyles.find((s) => s.name === 'Walking')!;

type Track = 'drums' | 'bass' | 'keys';

// Same starting points as the desktop mixer (App.tsx) — tracks at 70% for
// headroom, master/metronome at 100% — except drums, which start quieter here:
// on a phone's small speaker the drum samples otherwise dominate the mix.
const DEFAULT_VOLUMES = { master: 100, drums: 20, bass: 70, keys: 70, metronome: 100 };

// UI-only preferences (not song data — those still stay JSON-file-only, per
// CLAUDE.md's no-accounts/no-server-side stance). Small enough, and unrelated
// enough to that constraint's actual reasoning, to justify the one
// localStorage exception in an otherwise storage-free app.
const PREFS_STORAGE_KEY = 'jammer-mobile-prefs';
type StoredPrefs = { volumes?: typeof DEFAULT_VOLUMES; accentColor?: string; notationStyle?: NotationStyle };

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

/** Same real-book convention as ChordGrid's chord labels: the -/°/+/^ triad-quality
 * marker sets full size next to the root, 7ths/9ths/alterations set smaller and
 * raised (.chord-ext, shared with desktop). */
function ChordLabel({ chord, notation }: { chord: Chord; notation: NotationStyle }) {
  const { root, core, ext, bass } = chordNameParts(chord, notation);
  return (
    <>
      {root}
      {core}
      {ext && <sup className="chord-ext">{ext}</sup>}
      {bass}
    </>
  );
}

/**
 * Playback-only companion view for phones — a bundled song, a scrolling chord
 * chart, and transport/key/tempo controls. Deliberately can't build or edit a
 * progression (that's ChordGrid's job, and its drag/resize/select interactions
 * don't translate to touch); see the "Direction" notes in CLAUDE.md.
 */
export function MobilePlayer() {
  const [preset, setPreset] = useState<SongPreset | null>(bundledSongPresets[0] ?? null);
  const [musicalKey, setMusicalKey] = useState(preset?.key ?? 'C');
  const [scale, setScale] = useState<ScaleName>(preset?.scale ?? 'major');
  const [tempo, setTempoState] = useState(preset?.tempo ?? 120);
  const [drumStyles, setDrumStyles] = useState<DrumStyle[]>(baseDrumStyles);
  const [bassStyles, setBassStyles] = useState<BassStyle[]>(baseBassStyles);
  const [isPlaying, setIsPlaying] = useState(false);
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
  const [metronomeOn, setMetronomeOn] = useState(preset?.metronome ?? false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volumes, setVolumes] = useState(() => loadStoredPrefs().volumes ?? DEFAULT_VOLUMES);
  const [notationStyle, setNotationStyle] = useState<NotationStyle>(
    () => loadStoredPrefs().notationStyle ?? 'symbol',
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
    saveStoredPrefs({ volumes, notationStyle, accentColor });
  }, [volumes, notationStyle, accentColor]);

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

  const resolvedPlacements = useMemo(
    () => (preset ? resolvePlacementStarts(preset.placements) : []),
    [preset],
  );
  const loopRange = useMemo(
    () => (preset ? resolveLoopRange(preset, resolvedPlacements) : { loopStart: 0, loopEnd: 0 }),
    [preset, resolvedPlacements],
  );
  const placements: ChordPlacement[] = useMemo(
    () => resolvedPlacements.map((p, i) => ({ id: `mobile-${i}`, ...p })),
    [resolvedPlacements],
  );
  const sections: SectionMarker[] = useMemo(
    () => (preset?.sections ?? []).map((s, i) => ({ id: `mobile-section-${i}`, ...s })),
    [preset],
  );

  // A flat list of beat cells — CSS grid auto-flow wraps every BEATS_PER_ROW (four
  // bars) into a new visual row, so the whole chart is one grid rather than a stack
  // of independently-bordered row boxes (the previous per-row version could show a
  // hairline seam between rows where two adjacent boxes' borders didn't quite meet).
  // A chord's first beat always carries a label — mid-bar beats are otherwise blank,
  // same convention as a hand-written lead sheet ("F", three blank beats, "Bb",
  // three blank beats) — except every bar boundary itself gets a mark, either the
  // chord's name (first bar it's heard) or "%" (still the same chord as last bar,
  // whether that's a held chord carrying across the line or a fresh repeat).
  const beatCells = useMemo(() => {
    // Not rounded up to a full row — a song that ends mid-row (e.g. 12 Bar Blues'
    // 10 bars, not a multiple of the 4-bars-per-row width) should just stop there,
    // not trail off into empty bars with nothing in them.
    const totalBeats = placements.reduce((max, p) => Math.max(max, p.startBeat + p.lengthBeats), 0);
    // The chord that was sounding at the previous bar's own boundary — compared
    // against each new bar boundary to decide "name" vs "%".
    let previousBarChordName: string | null = null;
    return Array.from({ length: totalBeats }, (_, beat): BeatCell => {
      const placement = placements.find((p) => beat >= p.startBeat && beat < p.startBeat + p.lengthBeats) ?? null;
      const isChordStart = placement?.startBeat === beat;
      let mark: BeatCell['mark'] = isChordStart ? 'name' : null;
      if (beat % BEATS_PER_BAR === 0) {
        const chordNameHere = placement
          ? chordName(resolveSelection(musicalKey, scale, placement.selection), notationStyle)
          : null;
        if (!placement) {
          mark = null;
        } else if (isChordStart) {
          // A fresh attack lands exactly on this bar boundary — the only case that
          // actually needs comparing against the previous bar, to catch two
          // adjacent placements that happen to share a chord.
          mark = chordNameHere === previousBarChordName ? 'repeat' : 'name';
        } else {
          // This boundary falls inside a placement that already started earlier —
          // whether at the previous bar's own boundary or mid-bar — so it's always
          // a continuation, already labeled at its true start beat. Comparing
          // against previousBarChordName here would wrongly re-show the name if
          // that start beat wasn't itself a bar boundary.
          mark = 'repeat';
        }
        previousBarChordName = chordNameHere;
      }
      return { beat, placement, mark };
    });
  }, [placements, musicalKey, scale, notationStyle]);

  const beatRuns = useMemo(() => {
    const runs: BeatRun[] = [];
    for (const cell of beatCells) {
      const last = runs[runs.length - 1];
      // A cell continues the previous run only when it's unmarked (a mid-bar hold)
      // and still the same placement — anything else (its own mark, a different
      // placement, entering/leaving a gap) starts a new run.
      if (last && cell.mark === null && cell.placement === last.placement) {
        last.length += 1;
      } else {
        runs.push({ startBeat: cell.beat, length: 1, placement: cell.placement, mark: cell.mark });
      }
    }
    return runs;
  }, [beatCells]);

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
    if (preset) {
      setMusicalKey(preset.key);
      setScale(preset.scale);
      setTempoState(preset.tempo);
      setMetronomeOn(preset.metronome);
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

  // Backgrounding the page (screen lock, minimizing, even just the notification
  // shade being pulled down) can force the engine to stop itself — see onAutoStop's
  // doc comment in audio/engine.ts. Sync the UI rather than leaving the now-playing
  // modal up over silence.
  useEffect(() => onAutoStop(() => {
    setIsPlaying(false);
    setPlayheadBeat(0);
  }), []);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
      setPlayheadBeat(0);
      return;
    }
    if (!preset || placements.length === 0 || instrumentsLoading) return;
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
    instrumentsLoading,
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
        <h1 className="app-title">jammer v0</h1>
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
      </header>

      <div className="mobile-player__paper">
        <div className="mobile-player__paper-grid">
          {beatRuns.map((run) => (
            <div
              key={run.startBeat}
              style={{ gridColumn: `span ${run.length}` }}
              className={
                'mobile-player__paper-cell' +
                (run.startBeat % BEATS_PER_ROW === 0 ? ' mobile-player__paper-cell--row-start' : '') +
                ((run.startBeat + run.length) % BEATS_PER_BAR === 0 ? ' mobile-player__paper-cell--bar-end' : '') +
                (run.placement && run.placement === currentPlacement ? ' mobile-player__paper-cell--active' : '')
              }
            >
              {run.mark === 'repeat' && run.placement && (
                <span
                  className="mobile-player__paper-repeat"
                  aria-label={`Same as previous bar: ${chordName(resolveSelection(musicalKey, scale, run.placement.selection), notationStyle)}`}
                >
                  %
                </span>
              )}
              {run.mark === 'name' && run.placement && (
                <span className="mobile-player__paper-chord">
                  <ChordLabel
                    chord={resolveSelection(musicalKey, scale, run.placement.selection)}
                    notation={notationStyle}
                  />
                </span>
              )}
            </div>
          ))}
        </div>
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
              min={40}
              max={240}
              value={tempo}
              onChange={(e) => setTempoState(Number(e.target.value))}
            />
          </label>
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
              ☕ Buy me a coffee :)
            </a>
          </div>
        </div>
      )}

      {isPlaying && currentPlacement && (
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
    </div>
  );
}
