import { useCallback, useEffect, useRef, useState } from 'react';
import { ChordGrid, totalBeatsFor } from './components/ChordGrid';
import { BeatGridSheet } from './components/BeatGridSheet';
import { SheetMusicHeader } from './components/SheetMusicHeader';
import { ChordPalette } from './components/ChordPalette';
import { TopBar } from './components/TopBar';
import { SettingsModal } from './components/SettingsModal';
import { ChannelStrip } from './components/ChannelStrip';
import { MiniFader } from './components/MiniFader';
import type { Chord, ChordPlacement, ChordSelection, NotationStyle, ScaleName } from './data/progressions';
import {
  baseDrumStyles,
  baseBassStyles,
  keysStyles,
  keysInstruments,
  bassInstruments,
  drumsInstruments,
  type DrumStyle,
  type BassStyle,
  type Instrument,
  type TimeFeel,
} from './data/instrumentStyles';
import { loadBundledDrumStyles } from './data/drumLibrary';
import { loadBundledBassStyles } from './data/bassLibrary';
import { parseMidiDrumPattern } from './data/midiDrumImport';
import { parseMidiMelodyFile } from './data/midiMelodyImport';
import type { MelodyNote } from './data/melody';
import type { SectionMarker } from './data/sections';
import {
  bundledSongPresets,
  downloadSongPreset,
  parseSongPresetFile,
  resolveSongPreset,
  deriveSectionsAndArrangement,
  resolveLoopRange,
  type SongPreset,
} from './data/songPresets';
import {
  play,
  stop,
  auditionChord,
  auditionExoticScale,
  setTempo as setTransportTempo,
  getCurrentBeat,
  setChordsVolume,
  setBassVolume,
  setDrumsVolume,
  setMetronomeVolume,
  setMasterVolume,
  setKickVolume,
  setSnareVolume,
  setRimVolume,
  setHihatVolume,
  setHihatOpenVolume,
  setHihatFootVolume,
  setRideVolume,
  setRideBellVolume,
  setCrashVolume,
  setTomsVolume,
  setChordsInstrument,
  setBassInstrument,
  setDrumsInstrument,
  setChordsMuted,
  setBassMuted,
  setDrumsMuted,
  setMetronomeMuted,
  setChordsChorusEnabled,
  setChordsReverbEnabled,
  setBassCompressionEnabled,
  setDrumsCompressionEnabled,
  setDrumsReverbEnabled,
  setMelodyVolume,
  setMelodyMuted,
  isKeysInstrumentLoaded,
  isBassInstrumentLoaded,
  onAutoStop,
  type CountInBeats,
} from './audio/engine';

// Fallback only — used if bundledSongPresets is somehow empty (e.g. all preset
// files failed validation), so the app never opens to a totally blank grid.
const STARTER_PLACEMENTS: ChordPlacement[] = [
  { id: 'starter-0', selection: { type: 'diatonic', degree: 0 }, startBeat: 0, lengthBeats: 4 },
  { id: 'starter-1', selection: { type: 'secondaryDominant', degree: 5 }, startBeat: 4, lengthBeats: 4 },
  { id: 'starter-2', selection: { type: 'diatonic', degree: 5 }, startBeat: 8, lengthBeats: 4 },
  { id: 'starter-3', selection: { type: 'diatonic', degree: 1 }, startBeat: 12, lengthBeats: 4 },
];

type TimeFeelOption = { name: string; value: TimeFeel };
const TIME_FEEL_OPTIONS: TimeFeelOption[] = [
  { name: 'Normal', value: 'normal' },
  { name: 'Half-Time', value: 'half' },
  { name: 'Double-Time', value: 'double' },
];

// The URL's ?song= name wins over the hardcoded fallback, so a refresh (or a shared
// link) reopens whatever song was actually loaded rather than always Autumn Leaves.
const urlSongName = new URLSearchParams(window.location.search).get('song');
const DEFAULT_SONG_PRESET =
  bundledSongPresets.find((p) => p.name === urlSongName) ??
  bundledSongPresets.find((p) => p.name === 'Autumn Leaves') ??
  null;
const DEFAULT_RESOLVED = DEFAULT_SONG_PRESET
  ? resolveSongPreset(DEFAULT_SONG_PRESET)
  : { placements: [], sections: [] };
const DEFAULT_RESOLVED_PLACEMENTS = DEFAULT_RESOLVED.placements;
const DEFAULT_BEATS_PER_BAR = DEFAULT_SONG_PRESET?.beatsPerBar ?? 4;
const DEFAULT_LOOP_RANGE = DEFAULT_SONG_PRESET
  ? resolveLoopRange(DEFAULT_SONG_PRESET, DEFAULT_RESOLVED_PLACEMENTS)
  : { loopStart: 0, loopEnd: DEFAULT_BEATS_PER_BAR * 4 };

/** Keeps ?song= in sync with whatever's actually loaded, without adding a back-button
 * stop per song switch — a plain refresh should reopen the same song, not navigate. */
function setSongInUrl(name: string | null): void {
  const url = new URL(window.location.href);
  if (name) url.searchParams.set('song', name);
  else url.searchParams.delete('song');
  window.history.replaceState(null, '', url);
}

// UI-only preferences (not song data — those still stay JSON-file-only, per
// CLAUDE.md's no-accounts/no-server-side stance). Same reasoning/exception
// MobilePlayer.tsx already carved out for its own prefs, just desktop's own
// storage key/shape rather than sharing mobile's — the two views' settings are
// independent (grid style in particular is desktop-only; mobile has no editor).
const DESKTOP_PREFS_STORAGE_KEY = 'jazzmate-desktop-prefs';
type DesktopStoredPrefs = { notationStyle?: NotationStyle; compactGridView?: boolean; accentColor?: string };

function loadStoredDesktopPrefs(): DesktopStoredPrefs {
  try {
    const raw = localStorage.getItem(DESKTOP_PREFS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredDesktopPrefs(prefs: DesktopStoredPrefs): void {
  try {
    localStorage.setItem(DESKTOP_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing, storage disabled/full, etc. — preferences just won't
    // persist this session, not worth surfacing as an error.
  }
}

function App() {
  const [songTitle, setSongTitle] = useState(DEFAULT_SONG_PRESET?.name ?? 'Untitled');
  const [songSubtitle, setSongSubtitle] = useState(DEFAULT_SONG_PRESET?.subtitle ?? '');
  const [songAuthor, setSongAuthor] = useState(DEFAULT_SONG_PRESET?.author ?? '');
  const [songPlayStyle, setSongPlayStyle] = useState(DEFAULT_SONG_PRESET?.playStyle ?? '');
  const [musicalKey, setMusicalKey] = useState(DEFAULT_SONG_PRESET?.key ?? 'C');
  const [scale, setScale] = useState<ScaleName>(DEFAULT_SONG_PRESET?.scale ?? 'major');
  const [notationStyle, setNotationStyle] = useState<NotationStyle>(
    () => loadStoredDesktopPrefs().notationStyle ?? 'symbol',
  );
  // Swaps the grid panel for the same beat-grid chart the mobile companion view
  // uses (BeatGridSheet.tsx) — see that file's own doc comment for the current
  // state of editing parity with the normal ChordGrid view.
  const [compactGridView, setCompactGridView] = useState(() => loadStoredDesktopPrefs().compactGridView ?? false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Falls back to whatever --accent already resolved to (light/dark default) if
  // nothing's stored yet — a manual pick simply overrides that CSS variable at
  // the root. Same mechanism as MobilePlayer.tsx's own accent picker — one shared
  // CSS variable, so either view's choice is what the other would see too if both
  // happened to run in the same browser profile.
  const [accentColor, setAccentColor] = useState(
    () => loadStoredDesktopPrefs().accentColor ?? getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentColor);
  }, [accentColor]);

  useEffect(() => {
    saveStoredDesktopPrefs({ notationStyle, compactGridView, accentColor });
  }, [notationStyle, compactGridView, accentColor]);

  const handleResetAccent = () => {
    document.documentElement.style.removeProperty('--accent');
    setAccentColor(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  };
  const [placements, setPlacements] = useState<ChordPlacement[]>(
    DEFAULT_SONG_PRESET
      ? DEFAULT_RESOLVED_PLACEMENTS.map((p) => ({ id: crypto.randomUUID(), ...p }))
      : STARTER_PLACEMENTS,
  );
  const [tempo, setTempo] = useState(DEFAULT_SONG_PRESET?.tempo ?? 124);
  // Simple meter only (always over a "4" denominator) -- see CLAUDE.md's "Beats
  // per bar" section. Drives chart/notation rendering (ChordGrid.tsx,
  // BeatGridSheet.tsx); the accompaniment engines (drums/bass/keys pattern
  // generators) don't read this yet -- see CLAUDE.md for that deferred scope.
  const [beatsPerBar, setBeatsPerBar] = useState(DEFAULT_BEATS_PER_BAR);
  const [countInBeats, setCountInBeats] = useState<CountInBeats>(4);
  const [drumStyles, setDrumStyles] = useState<DrumStyle[]>(baseDrumStyles);
  const [drumStyle, setDrumStyle] = useState<DrumStyle>(baseDrumStyles[0]);
  const [drumsTimeFeel, setDrumsTimeFeel] = useState<TimeFeelOption>(
    TIME_FEEL_OPTIONS.find((o) => o.value === DEFAULT_SONG_PRESET?.drumsTimeFeel) ?? TIME_FEEL_OPTIONS[0],
  );
  const [bassStyles, setBassStyles] = useState<BassStyle[]>(baseBassStyles);
  const [bassStyle, setBassStyle] = useState(
    baseBassStyles.find((s) => s.name === DEFAULT_SONG_PRESET?.bassStyle) ??
      baseBassStyles.find((s) => s.name === 'Walking')!,
  );
  const [bassTimeFeel, setBassTimeFeel] = useState<TimeFeelOption>(
    TIME_FEEL_OPTIONS.find((o) => o.value === DEFAULT_SONG_PRESET?.bassTimeFeel) ?? TIME_FEEL_OPTIONS[0],
  );
  const [keysStyle, setKeysStyle] = useState(
    keysStyles.find((s) => s.name === DEFAULT_SONG_PRESET?.keysStyle) ??
      keysStyles.find((s) => s.name === 'Sustained 7ths')!,
  );
  const [keysTimeFeel, setKeysTimeFeel] = useState<TimeFeelOption>(
    TIME_FEEL_OPTIONS.find((o) => o.value === DEFAULT_SONG_PRESET?.keysTimeFeel) ?? TIME_FEEL_OPTIONS[0],
  );
  const [metronomeMuted, setMetronomeMutedState] = useState(!(DEFAULT_SONG_PRESET?.metronome ?? false));
  const [chordsMuted, setChordsMutedState] = useState(false);
  const [chordsChorusEnabled, setChordsChorusEnabledState] = useState(false);
  const [chordsReverbEnabled, setChordsReverbEnabledState] = useState(true);
  const [bassCompressionEnabled, setBassCompressionEnabledState] = useState(true);
  const [bassMuted, setBassMutedState] = useState(false);
  const [drumsCompressionEnabled, setDrumsCompressionEnabledState] = useState(true);
  const [drumsReverbEnabled, setDrumsReverbEnabledState] = useState(true);
  const [drumsMuted, setDrumsMutedState] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // True for the count-in's own real-time duration after Play is pressed — the
  // engine (audio/engine.ts's play()) delays the Transport's actual start by
  // exactly that long, but isPlaying/playheadBeat both go true/set immediately
  // when Play is clicked, so without this the compact grid view's active-chord
  // highlight (and the staff view's playhead) would jump onto the first chord
  // during the count-in clicks, before the song has actually started.
  const [countInActive, setCountInActive] = useState(false);
  const countInTimeoutRef = useRef<number | null>(null);
  const [customDrumStyle, setCustomDrumStyle] = useState<DrumStyle | null>(null);
  const [midiError, setMidiError] = useState<string | null>(null);
  const [melody, setMelody] = useState<MelodyNote[]>(DEFAULT_SONG_PRESET?.melody ?? []);
  const [melodyError, setMelodyError] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionMarker[]>(
    DEFAULT_RESOLVED.sections.map((s) => ({ id: crypto.randomUUID(), ...s })),
  );
  const [melodyMuted, setMelodyMutedState] = useState(false);
  const [songPresetError, setSongPresetError] = useState<string | null>(null);
  const [loopStart, setLoopStart] = useState(DEFAULT_LOOP_RANGE.loopStart);
  const [loopEnd, setLoopEnd] = useState(DEFAULT_LOOP_RANGE.loopEnd);
  const [playheadBeat, setPlayheadBeat] = useState(0);
  // The four main track faders start at 70%, not 100 — headroom to boost
  // whichever track needs it, rather than already maxed out with nowhere to go.
  const [chordsVolume, setChordsVolumeState] = useState(70);
  const [bassVolume, setBassVolumeState] = useState(70);
  const [drumsVolume, setDrumsVolumeState] = useState(70);
  const [metronomeVolume, setMetronomeVolumeState] = useState(100);
  const [melodyVolume, setMelodyVolumeState] = useState(70);
  const [masterVolume, setMasterVolumeState] = useState(100);
  const [drumsExpanded, setDrumsExpanded] = useState(false);
  const [kickVolume, setKickVolumeState] = useState(100);
  const [snareVolume, setSnareVolumeState] = useState(100);
  const [rimVolume, setRimVolumeState] = useState(100);
  // Cymbals default quieter than the rest of the kit — the real recorded samples
  // (hihat/ride/crash family) sit much louder relative to the drum shells than the
  // old synths ever did, so 100% here was overwhelming the mix out of the gate.
  const [hihatVolume, setHihatVolumeState] = useState(50);
  const [hihatOpenVolume, setHihatOpenVolumeState] = useState(50);
  const [hihatFootVolume, setHihatFootVolumeState] = useState(50);
  const [rideVolume, setRideVolumeState] = useState(50);
  const [rideBellVolume, setRideBellVolumeState] = useState(50);
  const [crashVolume, setCrashVolumeState] = useState(50);
  const [tomsVolume, setTomsVolumeState] = useState(100);
  const [chordsInstrument, setChordsInstrumentState] = useState<Instrument>(
    keysInstruments.find((i) => i.name === DEFAULT_SONG_PRESET?.chordsInstrument) ?? keysInstruments[0],
  );
  const [bassInstrument, setBassInstrumentState] = useState<Instrument>(
    bassInstruments.find((i) => i.name === DEFAULT_SONG_PRESET?.bassInstrument) ?? bassInstruments[0],
  );
  const [drumsInstrument, setDrumsInstrumentState] = useState<Instrument>(
    drumsInstruments.find((i) => i.name === DEFAULT_SONG_PRESET?.drumsInstrument) ?? drumsInstruments[0],
  );

  useEffect(() => setChordsInstrument(chordsInstrument.name), [chordsInstrument]);
  useEffect(() => setBassInstrument(bassInstrument.name), [bassInstrument]);
  useEffect(() => setDrumsInstrument(drumsInstrument.name), [drumsInstrument]);

  // Gates Play + shows a loading modal while the Harmony and/or Bass instrument
  // is sample-based (e.g. Acoustic Piano, sampled Upright/Electric bass) and
  // still loading its buffer(s) — the setChordsInstrument/setBassInstrument
  // effects just above already kicked off those loads eagerly (not lazily at
  // first Play — see keys.ts's and bass.ts's setInstrument) by the time this
  // one's initial check runs. Polling rather than a load callback since
  // Tone.Sampler doesn't expose one after construction, only at construction
  // time — see isInstrumentLoaded.
  const [instrumentsLoading, setInstrumentsLoadingState] = useState(true);
  useEffect(() => {
    const checkLoaded = () => isKeysInstrumentLoaded() && isBassInstrumentLoaded();
    if (checkLoaded()) {
      setInstrumentsLoadingState(false);
      return;
    }
    setInstrumentsLoadingState(true);
    const interval = window.setInterval(() => {
      if (checkLoaded()) {
        setInstrumentsLoadingState(false);
        window.clearInterval(interval);
      }
    }, 150);
    return () => window.clearInterval(interval);
  }, [chordsInstrument, bassInstrument]);

  // Canonicalizes ?song= on first load — clears a stale/unrecognized value, or fills
  // it in when the app opened with none, so the URL always matches what's loaded.
  useEffect(() => {
    setSongInUrl(DEFAULT_SONG_PRESET?.name ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadBundledDrumStyles().then((loaded) => {
      if (cancelled) return;
      const all = [...baseDrumStyles, ...loaded];
      setDrumStyles(all);
      // Upgrade the initial "None" placeholder to the default song's drum style once
      // it's ready — but leave it alone if the user already picked something during
      // the brief load.
      setDrumStyle((current) =>
        current.name === 'None'
          ? (all.find((s) => s.name === DEFAULT_SONG_PRESET?.drumStyle) ?? current)
          : current,
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadBundledBassStyles().then((loaded) => {
      if (cancelled) return;
      setBassStyles([...baseBassStyles, ...loaded]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => setChordsVolume(chordsVolume), [chordsVolume]);
  useEffect(() => setBassVolume(bassVolume), [bassVolume]);
  useEffect(() => setDrumsVolume(drumsVolume), [drumsVolume]);
  useEffect(() => setMetronomeVolume(metronomeVolume), [metronomeVolume]);
  useEffect(() => setMelodyVolume(melodyVolume), [melodyVolume]);
  useEffect(() => setMasterVolume(masterVolume), [masterVolume]);
  useEffect(() => setKickVolume(kickVolume), [kickVolume]);
  useEffect(() => setSnareVolume(snareVolume), [snareVolume]);
  useEffect(() => setRimVolume(rimVolume), [rimVolume]);
  useEffect(() => setHihatVolume(hihatVolume), [hihatVolume]);
  useEffect(() => setHihatOpenVolume(hihatOpenVolume), [hihatOpenVolume]);
  useEffect(() => setHihatFootVolume(hihatFootVolume), [hihatFootVolume]);
  useEffect(() => setRideVolume(rideVolume), [rideVolume]);
  useEffect(() => setRideBellVolume(rideBellVolume), [rideBellVolume]);
  useEffect(() => setCrashVolume(crashVolume), [crashVolume]);
  useEffect(() => setTomsVolume(tomsVolume), [tomsVolume]);
  useEffect(() => setChordsMuted(chordsMuted), [chordsMuted]);
  useEffect(() => setChordsChorusEnabled(chordsChorusEnabled), [chordsChorusEnabled]);
  useEffect(() => setChordsReverbEnabled(chordsReverbEnabled), [chordsReverbEnabled]);
  useEffect(() => setBassCompressionEnabled(bassCompressionEnabled), [bassCompressionEnabled]);
  useEffect(() => setDrumsCompressionEnabled(drumsCompressionEnabled), [drumsCompressionEnabled]);
  useEffect(() => setDrumsReverbEnabled(drumsReverbEnabled), [drumsReverbEnabled]);
  useEffect(() => setBassMuted(bassMuted), [bassMuted]);
  useEffect(() => setDrumsMuted(drumsMuted), [drumsMuted]);
  useEffect(() => setMetronomeMuted(metronomeMuted), [metronomeMuted]);
  useEffect(() => setMelodyMuted(melodyMuted), [melodyMuted]);

  useEffect(() => {
    if (isPlaying) setTransportTempo(tempo);
  }, [tempo, isPlaying]);

  useEffect(() => {
    // While playing, the playhead tracks the transport; the stop handlers themselves
    // reset it back to 0, so there's nothing to do here once playback ends.
    if (!isPlaying) return;
    let frameId: number;
    const tick = () => {
      setPlayheadBeat(Math.floor(getCurrentBeat()));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying]);

  // Backgrounding the tab (or, on mobile, locking the screen) can force the engine
  // to stop itself — see onAutoStop's doc comment in audio/engine.ts. Sync the UI
  // rather than leaving Play showing "Pause" over silence.
  useEffect(() => onAutoStop(() => {
    if (countInTimeoutRef.current !== null) {
      window.clearTimeout(countInTimeoutRef.current);
      countInTimeoutRef.current = null;
    }
    setIsPlaying(false);
    setCountInActive(false);
    setPlayheadBeat(0);
  }), []);

  const handleAudition = (chord: Chord) => {
    auditionChord(chord);
  };

  const handleAuditionExoticScale = (chord: Chord, scaleRoot: string, intervals: number[]) => {
    auditionExoticScale(chord, scaleRoot, intervals);
  };

  const handleDropChord = (selection: ChordSelection, startBeat: number, lengthBeats: number) => {
    setPlacements((prev) => [...prev, { id: crypto.randomUUID(), selection, startBeat, lengthBeats }]);
  };

  // Click-to-add (ChordPalette.tsx): appends at the end of the current
  // progression rather than a cursor position -- same "next open slot" formula
  // ChordGrid.tsx's own paste/add-section handlers already use. No-ops (rather
  // than clipping the chord short) if there isn't room left for the full
  // requested length, same as handleAddSectionClick's own bounds check.
  const handleAddChordAtEnd = (selection: ChordSelection, lengthBeats: number) => {
    setPlacements((prev) => {
      const startBeat = prev.length === 0 ? 0 : Math.max(...prev.map((p) => p.startBeat + p.lengthBeats));
      if (startBeat + lengthBeats > totalBeatsFor(beatsPerBar)) return prev;
      return [...prev, { id: crypto.randomUUID(), selection, startBeat, lengthBeats }];
    });
  };

  const handleReplaceChord = (placement: ChordPlacement, selection: ChordSelection) => {
    setPlacements((prev) => prev.map((p) => (p.id === placement.id ? { ...p, selection } : p)));
  };

  const handleResize = (placement: ChordPlacement, newLength: number) => {
    setPlacements((prev) =>
      prev.map((p) => (p.id === placement.id ? { ...p, lengthBeats: newLength } : p)),
    );
  };

  const handleMove = (placement: ChordPlacement, newStartBeat: number) => {
    setPlacements((prev) =>
      prev.map((p) => (p.id === placement.id ? { ...p, startBeat: newStartBeat } : p)),
    );
  };

  const handleRemove = (placement: ChordPlacement) => {
    setPlacements((prev) => prev.filter((p) => p.id !== placement.id));
  };

  const handleClear = () => setPlacements([]);

  const handlePastePlacements = (newPlacements: ChordPlacement[]) => {
    setPlacements((prev) => [...prev, ...newPlacements]);
  };

  const handleLoopChange = (start: number, end: number) => {
    setLoopStart(start);
    setLoopEnd(end);
  };

  const handlePlayheadChange = (beat: number) => setPlayheadBeat(beat);

  const handleAddSection = (startBeat: number, lengthBeats: number) => {
    // Cycles A, B, C, ... Z, A, B, ... — good enough for how many sections a lead
    // sheet actually has; nothing stops renaming past Z by hand anyway.
    const label = String.fromCharCode(65 + (sections.length % 26));
    setSections((prev) => [...prev, { id: crypto.randomUUID(), label, startBeat, lengthBeats }]);
  };

  const handleRenameSection = (section: SectionMarker, label: string) => {
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, label } : s)));
  };

  const handleMoveSection = (section: SectionMarker, newStartBeat: number) => {
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, startBeat: newStartBeat } : s)));
  };

  const handleRemoveSection = (section: SectionMarker) => {
    setSections((prev) => prev.filter((s) => s.id !== section.id));
  };

  // Melody editing (see ChordGrid.tsx's "Edit Melody" mode) -- indexes into the
  // melody array are used as note identity, same as ChordGrid's own comment on
  // this explains (MelodyNote has no persisted id).
  const handleAddMelodyNote = (note: MelodyNote) => {
    setMelody((prev) => [...prev, note]);
  };

  const handleUpdateMelodyNote = (index: number, patch: Partial<MelodyNote>) => {
    setMelody((prev) => prev.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  };

  const handleRemoveMelodyNote = (index: number) => {
    setMelody((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLoadSongPreset = (preset: SongPreset) => {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
    }
    setPlayheadBeat(0);
    // Only bundled presets are addressable by name — an imported one-off file has
    // nothing for a refresh to look up, so it just falls back to the default song.
    setSongInUrl(bundledSongPresets.some((p) => p.name === preset.name) ? preset.name : null);
    setSongTitle(preset.name);
    setSongSubtitle(preset.subtitle ?? '');
    setSongAuthor(preset.author ?? '');
    setSongPlayStyle(preset.playStyle ?? '');
    setMusicalKey(preset.key);
    setScale(preset.scale);
    setTempo(preset.tempo);
    setBeatsPerBar(preset.beatsPerBar ?? 4);
    setMetronomeMutedState(!preset.metronome);
    const resolved = resolveSongPreset(preset);
    const resolvedPlacements = resolved.placements;
    const loopRange = resolveLoopRange(preset, resolvedPlacements);
    setLoopStart(loopRange.loopStart);
    setLoopEnd(loopRange.loopEnd);
    setPlacements(resolvedPlacements.map((p) => ({ id: crypto.randomUUID(), ...p })));

    if (preset.customDrumPattern) {
      const style: DrumStyle = { name: preset.drumStyle, pattern: preset.customDrumPattern };
      setCustomDrumStyle(style);
      setDrumStyle(style);
    } else {
      setCustomDrumStyle(null);
      setDrumStyle(drumStyles.find((s) => s.name === preset.drumStyle) ?? drumStyles[0]);
    }
    setBassStyle(bassStyles.find((s) => s.name === preset.bassStyle) ?? bassStyles[0]);
    setKeysStyle(keysStyles.find((s) => s.name === preset.keysStyle) ?? keysStyles[0]);
    setDrumsTimeFeel(
      TIME_FEEL_OPTIONS.find((o) => o.value === preset.drumsTimeFeel) ?? TIME_FEEL_OPTIONS[0],
    );
    setBassTimeFeel(TIME_FEEL_OPTIONS.find((o) => o.value === preset.bassTimeFeel) ?? TIME_FEEL_OPTIONS[0]);
    setKeysTimeFeel(TIME_FEEL_OPTIONS.find((o) => o.value === preset.keysTimeFeel) ?? TIME_FEEL_OPTIONS[0]);
    setChordsInstrumentState(
      keysInstruments.find((i) => i.name === preset.chordsInstrument) ?? keysInstruments[0],
    );
    setBassInstrumentState(bassInstruments.find((i) => i.name === preset.bassInstrument) ?? bassInstruments[0]);
    setDrumsInstrumentState(
      drumsInstruments.find((i) => i.name === preset.drumsInstrument) ?? drumsInstruments[0],
    );
    setMelody(preset.melody ?? []);
    setSections(resolved.sections.map((s) => ({ id: crypto.randomUUID(), ...s })));
    setSongPresetError(null);
  };

  const handleSaveSongPreset = () => {
    const flatPlacements = placements.map(({ selection, startBeat, lengthBeats }) => ({
      selection,
      startBeat,
      lengthBeats,
    }));
    const flatSections = sections.map(({ label, startBeat, lengthBeats }) => ({ label, startBeat, lengthBeats }));
    // Prefer the sections+arrangement shape whenever it can represent the current
    // chart losslessly (see deriveSectionsAndArrangement) -- that's what actually
    // avoids retyping a repeated section. Falls back to the flat shape when there
    // are no sections, or the sections don't cleanly tile the chart.
    const derived = deriveSectionsAndArrangement(flatPlacements, flatSections);
    const preset: SongPreset = {
      version: 1,
      name: songTitle,
      subtitle: songSubtitle || undefined,
      author: songAuthor || undefined,
      playStyle: songPlayStyle || undefined,
      key: musicalKey,
      scale,
      tempo,
      beatsPerBar,
      metronome: !metronomeMuted,
      loopStart,
      loopEnd,
      drumStyle: drumStyle.name,
      bassStyle: bassStyle.name,
      keysStyle: keysStyle.name,
      drumsTimeFeel: drumsTimeFeel.value,
      bassTimeFeel: bassTimeFeel.value,
      keysTimeFeel: keysTimeFeel.value,
      chordsInstrument: chordsInstrument.name,
      bassInstrument: bassInstrument.name,
      drumsInstrument: drumsInstrument.name,
      customDrumPattern:
        customDrumStyle && drumStyle.name === customDrumStyle.name ? customDrumStyle.pattern : null,
      melody: melody.length > 0 ? melody : undefined,
      ...(derived
        ? { sectionDefs: derived.sectionDefs, arrangement: derived.arrangement }
        : { sections: flatSections.length > 0 ? flatSections : undefined, placements: flatPlacements }),
    };
    downloadSongPreset(preset);
  };

  const handleImportSongPresetFile = async (file: File) => {
    try {
      const preset = await parseSongPresetFile(file);
      handleLoadSongPreset(preset);
    } catch (e) {
      setSongPresetError((e as Error).message);
    }
  };

  const handleMidiUpload = async (file: File) => {
    try {
      const pattern = await parseMidiDrumPattern(file);
      const name = `Custom: ${file.name.replace(/\.(mid|midi)$/i, '')}`;
      const style: DrumStyle = { name, pattern };
      setCustomDrumStyle(style);
      setDrumStyle(style);
      setMidiError(null);
    } catch (e) {
      setMidiError((e as Error).message);
    }
  };

  const handleMelodyMidiUpload = async (file: File) => {
    try {
      const { notes } = await parseMidiMelodyFile(file);
      setMelody(notes);
      setMelodyError(null);
    } catch (e) {
      setMelodyError((e as Error).message);
    }
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
    if (placements.length === 0) return;
    if (instrumentsLoading) return; // still loading sample buffers — see the modal below
    if (countInBeats > 0) {
      setCountInActive(true);
      countInTimeoutRef.current = window.setTimeout(() => {
        setCountInActive(false);
        countInTimeoutRef.current = null;
      }, (countInBeats * 60 * 1000) / tempo);
    }
    await play({
      key: musicalKey,
      scale,
      placements,
      loopStartBeat: loopStart,
      loopEndBeat: loopEnd,
      startBeat: playheadBeat,
      tempo,
      drums: drumStyle.pattern,
      drumsTimeFeel: drumsTimeFeel.value,
      bass: bassStyle.rule,
      bassPattern: bassStyle.pattern ?? null,
      bassTimeFeel: bassTimeFeel.value,
      keys: keysStyle.rule,
      keysTimeFeel: keysTimeFeel.value,
      melody,
      sections,
      countInBeats,
      beatsPerBar,
    });
    setIsPlaying(true);
  }, [
    isPlaying,
    placements,
    musicalKey,
    scale,
    loopStart,
    loopEnd,
    playheadBeat,
    tempo,
    drumStyle,
    drumsTimeFeel,
    bassStyle,
    bassTimeFeel,
    keysStyle,
    keysTimeFeel,
    melody,
    countInBeats,
    sections,
    instrumentsLoading,
    beatsPerBar,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      // Skip when typing/selecting, and when a button or <summary> has focus —
      // both already trigger a native click on Space, which would double-fire.
      if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY)$/.test(target.tagName)) return;
      e.preventDefault();
      handleTogglePlay();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay]);

  // "Hidden" styles (e.g. a song's own bundled pattern) stay resolvable by name for
  // handleLoadSongPreset's lookup above (which searches the full drumStyles/bassStyles),
  // but shouldn't clutter the dropdown for every other song — except the one that's
  // actually selected right now, which needs to keep showing correctly rather than
  // falling back to "None" because it's missing from the option list.
  const visibleDrumStyles = drumStyles.filter((s) => !s.hidden || s.name === drumStyle.name);
  const visibleBassStyles = bassStyles.filter((s) => !s.hidden || s.name === bassStyle.name);

  return (
    <>
      <TopBar
        songPresets={bundledSongPresets}
        onLoadSongPreset={handleLoadSongPreset}
        currentSongName={songTitle}
        musicalKey={musicalKey}
        onKeyChange={setMusicalKey}
        scale={scale}
        onScaleChange={setScale}
        tempo={tempo}
        onTempoChange={setTempo}
        beatsPerBar={beatsPerBar}
        onBeatsPerBarChange={setBeatsPerBar}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        instrumentsLoading={instrumentsLoading}
        onSaveSongPreset={handleSaveSongPreset}
        onImportSongPresetFile={handleImportSongPresetFile}
        songPresetError={songPresetError}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        notationStyle={notationStyle}
        onNotationStyleChange={setNotationStyle}
        compactGridView={compactGridView}
        onCompactGridViewChange={setCompactGridView}
        countInBeats={countInBeats}
        onCountInBeatsChange={setCountInBeats}
        accentColor={accentColor}
        onAccentColorChange={setAccentColor}
        onResetAccent={handleResetAccent}
      />
      {instrumentsLoading && (
        <div className="loading-modal-backdrop">
          <div className="loading-modal" role="alert" aria-live="polite">
            <div className="loading-modal-spinner" aria-hidden="true" />
            <p>Loading instrument samples…</p>
          </div>
        </div>
      )}
      <main className="app">
        <ChordPalette
          musicalKey={musicalKey}
          scale={scale}
          notationStyle={notationStyle}
          onAudition={handleAudition}
          onAuditionExoticScale={handleAuditionExoticScale}
          onAddChord={handleAddChordAtEnd}
        />
        <div className="layout">
          <div className="layout-grid">
            {compactGridView ? (
              <div className="beat-grid-sheet-page">
                <SheetMusicHeader
                  title={songTitle}
                  onTitleChange={setSongTitle}
                  subtitle={songSubtitle}
                  onSubtitleChange={setSongSubtitle}
                  author={songAuthor}
                  onAuthorChange={setSongAuthor}
                  playStyle={songPlayStyle}
                  onPlayStyleChange={setSongPlayStyle}
                  tempo={tempo}
                  onClear={handleClear}
                  showStaff={false}
                />
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
            ) : (
              <ChordGrid
                placements={placements}
                melody={melody}
                sections={sections}
                musicalKey={musicalKey}
                scale={scale}
                notationStyle={notationStyle}
                loopStart={loopStart}
                loopEnd={loopEnd}
                playheadBeat={playheadBeat}
                isPlaying={isPlaying}
                onPlayheadChange={handlePlayheadChange}
                onDropChord={handleDropChord}
                onReplaceChord={handleReplaceChord}
                onResize={handleResize}
                onMove={handleMove}
                onRemove={handleRemove}
                onClear={handleClear}
                onLoopChange={handleLoopChange}
                onAuditionChord={handleAudition}
                onPastePlacements={handlePastePlacements}
                onAddSection={handleAddSection}
                onRenameSection={handleRenameSection}
                onMoveSection={handleMoveSection}
                onRemoveSection={handleRemoveSection}
                onAddMelodyNote={handleAddMelodyNote}
                onUpdateMelodyNote={handleUpdateMelodyNote}
                onRemoveMelodyNote={handleRemoveMelodyNote}
                title={songTitle}
                onTitleChange={setSongTitle}
                subtitle={songSubtitle}
                onSubtitleChange={setSongSubtitle}
                author={songAuthor}
                onAuthorChange={setSongAuthor}
                playStyle={songPlayStyle}
                onPlayStyleChange={setSongPlayStyle}
                tempo={tempo}
                beatsPerBar={beatsPerBar}
              />
            )}
          </div>
          <div className="channel-strip-column">
            <h2 className="panel-title">Instruments</h2>
            <div className="channel-strip-rail">
            <ChannelStrip
              label="Drums"
              accent="drums"
              styleOptions={customDrumStyle ? [...visibleDrumStyles, customDrumStyle] : visibleDrumStyles}
              selectedStyle={drumStyle}
              onStyleChange={setDrumStyle}
              instrumentOptions={drumsInstruments}
              selectedInstrument={drumsInstrument}
              onInstrumentChange={setDrumsInstrumentState}
              feelOptions={TIME_FEEL_OPTIONS}
              selectedFeel={drumsTimeFeel}
              onFeelChange={setDrumsTimeFeel}
              volume={drumsVolume}
              onVolumeChange={setDrumsVolumeState}
              muted={drumsMuted}
              onToggleMuted={() => setDrumsMutedState((v) => !v)}
              midiImport={{ label: 'Import drum MIDI', onFile: handleMidiUpload, error: midiError }}
              effects={[
                {
                  key: 'comp',
                  label: 'Comp',
                  enabled: drumsCompressionEnabled,
                  onToggle: () => setDrumsCompressionEnabledState((v) => !v),
                },
                {
                  key: 'reverb',
                  label: 'Reverb',
                  enabled: drumsReverbEnabled,
                  onToggle: () => setDrumsReverbEnabledState((v) => !v),
                },
              ]}
              expanded={drumsExpanded}
              onToggleExpanded={() => setDrumsExpanded((v) => !v)}
              expandedContent={
                <>
                  <MiniFader id="volume-kick" label="Kick" value={kickVolume} onChange={setKickVolumeState} />
                  <MiniFader id="volume-snare" label="Snare" value={snareVolume} onChange={setSnareVolumeState} />
                  <MiniFader id="volume-rim" label="Rim" value={rimVolume} onChange={setRimVolumeState} />
                  <MiniFader id="volume-hihat" label="Hihat" value={hihatVolume} onChange={setHihatVolumeState} />
                  <MiniFader
                    id="volume-hihat-open"
                    label="HH Open"
                    value={hihatOpenVolume}
                    onChange={setHihatOpenVolumeState}
                  />
                  <MiniFader
                    id="volume-hihat-foot"
                    label="HH Foot"
                    value={hihatFootVolume}
                    onChange={setHihatFootVolumeState}
                  />
                  <MiniFader id="volume-ride" label="Ride" value={rideVolume} onChange={setRideVolumeState} />
                  <MiniFader
                    id="volume-ride-bell"
                    label="Ride Bell"
                    value={rideBellVolume}
                    onChange={setRideBellVolumeState}
                  />
                  <MiniFader id="volume-crash" label="Crash" value={crashVolume} onChange={setCrashVolumeState} />
                  <MiniFader id="volume-toms" label="Toms" value={tomsVolume} onChange={setTomsVolumeState} />
                </>
              }
            />
            <ChannelStrip
              label="Bass"
              accent="bass"
              styleOptions={visibleBassStyles}
              selectedStyle={bassStyle}
              onStyleChange={setBassStyle}
              instrumentOptions={bassInstruments}
              selectedInstrument={bassInstrument}
              onInstrumentChange={setBassInstrumentState}
              feelOptions={TIME_FEEL_OPTIONS}
              selectedFeel={bassTimeFeel}
              onFeelChange={setBassTimeFeel}
              volume={bassVolume}
              onVolumeChange={setBassVolumeState}
              muted={bassMuted}
              onToggleMuted={() => setBassMutedState((v) => !v)}
              effects={[
                {
                  key: 'comp',
                  label: 'Comp',
                  enabled: bassCompressionEnabled,
                  onToggle: () => setBassCompressionEnabledState((v) => !v),
                },
              ]}
            />
            <ChannelStrip
              label="Harmony"
              accent="harmony"
              styleOptions={keysStyles}
              selectedStyle={keysStyle}
              onStyleChange={setKeysStyle}
              instrumentOptions={keysInstruments}
              selectedInstrument={chordsInstrument}
              onInstrumentChange={setChordsInstrumentState}
              feelOptions={TIME_FEEL_OPTIONS}
              selectedFeel={keysTimeFeel}
              onFeelChange={setKeysTimeFeel}
              volume={chordsVolume}
              onVolumeChange={setChordsVolumeState}
              muted={chordsMuted}
              onToggleMuted={() => setChordsMutedState((v) => !v)}
              effects={[
                {
                  key: 'chorus',
                  label: 'Chorus',
                  enabled: chordsChorusEnabled,
                  onToggle: () => setChordsChorusEnabledState((v) => !v),
                },
                {
                  key: 'reverb',
                  label: 'Reverb',
                  enabled: chordsReverbEnabled,
                  onToggle: () => setChordsReverbEnabledState((v) => !v),
                },
              ]}
            />
            <ChannelStrip
              label="Melody"
              accent="melody"
              volume={melodyVolume}
              onVolumeChange={setMelodyVolumeState}
              muted={melodyMuted}
              onToggleMuted={() => setMelodyMutedState((v) => !v)}
              midiImport={{ label: 'Import melody MIDI', onFile: handleMelodyMidiUpload, error: melodyError }}
            />
            <ChannelStrip
              label="Metronome"
              accent="metronome"
              volume={metronomeVolume}
              onVolumeChange={setMetronomeVolumeState}
              muted={metronomeMuted}
              onToggleMuted={() => setMetronomeMutedState((v) => !v)}
            />
            <ChannelStrip label="Master" accent="master" volume={masterVolume} onVolumeChange={setMasterVolumeState} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
