import { useCallback, useEffect, useState } from 'react';
import { ChordGrid } from './components/ChordGrid';
import { ChordPalette } from './components/ChordPalette';
import { TopBar } from './components/TopBar';
import { ChannelStrip } from './components/ChannelStrip';
import { VerticalFader } from './components/VerticalFader';
import { MiniFader } from './components/MiniFader';
import { MidiUpload } from './components/MidiUpload';
import { SongPresetFileControls } from './components/SongPresetFileControls';
import type { Chord, ChordPlacement, ChordSelection, ScaleName } from './data/progressions';
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
} from './data/instrumentStyles';
import { loadBundledDrumStyles } from './data/drumLibrary';
import { loadBundledBassStyles } from './data/bassLibrary';
import { parseMidiDrumPattern } from './data/midiDrumImport';
import {
  bundledSongPresets,
  downloadSongPreset,
  parseSongPresetFile,
  type SongPreset,
} from './data/songPresets';
import {
  play,
  stop,
  auditionChord,
  setTempo as setTransportTempo,
  getCurrentBeat,
  setChordsVolume,
  setBassVolume,
  setDrumsVolume,
  setMetronomeVolume,
  setMasterVolume,
  setKickVolume,
  setSnareVolume,
  setHihatVolume,
  setChordsInstrument,
  setBassInstrument,
  setDrumsInstrument,
  setChordsMuted,
  setBassMuted,
  setDrumsMuted,
  setMetronomeMuted,
} from './audio/engine';

// Fallback only — used if bundledSongPresets is somehow empty (e.g. all preset
// files failed validation), so the app never opens to a totally blank grid.
const STARTER_PLACEMENTS: ChordPlacement[] = [
  { id: 'starter-0', selection: { type: 'diatonic', degree: 0 }, startBeat: 0, lengthBeats: 4 },
  { id: 'starter-1', selection: { type: 'secondaryDominant', degree: 5 }, startBeat: 4, lengthBeats: 4 },
  { id: 'starter-2', selection: { type: 'diatonic', degree: 5 }, startBeat: 8, lengthBeats: 4 },
  { id: 'starter-3', selection: { type: 'diatonic', degree: 1 }, startBeat: 12, lengthBeats: 4 },
];

const DEFAULT_SONG_PRESET = bundledSongPresets.find((p) => p.name === 'Autumn Leaves') ?? null;

function App() {
  const [songTitle, setSongTitle] = useState(DEFAULT_SONG_PRESET?.name ?? 'Untitled');
  const [songAuthor, setSongAuthor] = useState(DEFAULT_SONG_PRESET?.author ?? '');
  const [musicalKey, setMusicalKey] = useState(DEFAULT_SONG_PRESET?.key ?? 'C');
  const [scale, setScale] = useState<ScaleName>(DEFAULT_SONG_PRESET?.scale ?? 'major');
  const [placements, setPlacements] = useState<ChordPlacement[]>(
    DEFAULT_SONG_PRESET
      ? DEFAULT_SONG_PRESET.placements.map((p) => ({ id: crypto.randomUUID(), ...p }))
      : STARTER_PLACEMENTS,
  );
  const [tempo, setTempo] = useState(DEFAULT_SONG_PRESET?.tempo ?? 124);
  const [drumStyles, setDrumStyles] = useState<DrumStyle[]>(baseDrumStyles);
  const [drumStyle, setDrumStyle] = useState<DrumStyle>(baseDrumStyles[0]);
  const [bassStyles, setBassStyles] = useState<BassStyle[]>(baseBassStyles);
  const [bassStyle, setBassStyle] = useState(
    baseBassStyles.find((s) => s.name === DEFAULT_SONG_PRESET?.bassStyle) ??
      baseBassStyles.find((s) => s.name === 'Walking')!,
  );
  const [keysStyle, setKeysStyle] = useState(
    keysStyles.find((s) => s.name === DEFAULT_SONG_PRESET?.keysStyle) ??
      keysStyles.find((s) => s.name === 'Sustained 7ths')!,
  );
  const [metronomeMuted, setMetronomeMutedState] = useState(!(DEFAULT_SONG_PRESET?.metronome ?? false));
  const [chordsMuted, setChordsMutedState] = useState(false);
  const [bassMuted, setBassMutedState] = useState(false);
  const [drumsMuted, setDrumsMutedState] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [customDrumStyle, setCustomDrumStyle] = useState<DrumStyle | null>(null);
  const [midiError, setMidiError] = useState<string | null>(null);
  const [songPresetError, setSongPresetError] = useState<string | null>(null);
  const [loopStart, setLoopStart] = useState(DEFAULT_SONG_PRESET?.loopStart ?? 0);
  const [loopEnd, setLoopEnd] = useState(DEFAULT_SONG_PRESET?.loopEnd ?? 16);
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);
  const [chordsVolume, setChordsVolumeState] = useState(100);
  const [bassVolume, setBassVolumeState] = useState(100);
  const [drumsVolume, setDrumsVolumeState] = useState(100);
  const [metronomeVolume, setMetronomeVolumeState] = useState(100);
  const [masterVolume, setMasterVolumeState] = useState(100);
  const [drumsExpanded, setDrumsExpanded] = useState(false);
  const [kickVolume, setKickVolumeState] = useState(100);
  const [snareVolume, setSnareVolumeState] = useState(100);
  const [hihatVolume, setHihatVolumeState] = useState(100);
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
  useEffect(() => setMasterVolume(masterVolume), [masterVolume]);
  useEffect(() => setKickVolume(kickVolume), [kickVolume]);
  useEffect(() => setSnareVolume(snareVolume), [snareVolume]);
  useEffect(() => setHihatVolume(hihatVolume), [hihatVolume]);
  useEffect(() => setChordsMuted(chordsMuted), [chordsMuted]);
  useEffect(() => setBassMuted(bassMuted), [bassMuted]);
  useEffect(() => setDrumsMuted(drumsMuted), [drumsMuted]);
  useEffect(() => setMetronomeMuted(metronomeMuted), [metronomeMuted]);

  useEffect(() => {
    if (isPlaying) setTransportTempo(tempo);
  }, [tempo, isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setPlayheadBeat(null);
      return;
    }
    let frameId: number;
    const tick = () => {
      setPlayheadBeat(Math.floor(getCurrentBeat()));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const handleAudition = (chord: Chord) => {
    auditionChord(chord);
  };

  const handleDropChord = (selection: ChordSelection, startBeat: number) => {
    setPlacements((prev) => [...prev, { id: crypto.randomUUID(), selection, startBeat, lengthBeats: 4 }]);
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

  const handleLoadSongPreset = (preset: SongPreset) => {
    setSongTitle(preset.name);
    setSongAuthor(preset.author ?? '');
    setMusicalKey(preset.key);
    setScale(preset.scale);
    setTempo(preset.tempo);
    setMetronomeMutedState(!preset.metronome);
    setLoopStart(preset.loopStart);
    setLoopEnd(preset.loopEnd);
    setPlacements(
      preset.placements.map((p) => ({
        id: crypto.randomUUID(),
        selection: p.selection,
        startBeat: p.startBeat,
        lengthBeats: p.lengthBeats,
      })),
    );

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
    setChordsInstrumentState(
      keysInstruments.find((i) => i.name === preset.chordsInstrument) ?? keysInstruments[0],
    );
    setBassInstrumentState(bassInstruments.find((i) => i.name === preset.bassInstrument) ?? bassInstruments[0]);
    setDrumsInstrumentState(
      drumsInstruments.find((i) => i.name === preset.drumsInstrument) ?? drumsInstruments[0],
    );
    setSongPresetError(null);
  };

  const handleSaveSongPreset = () => {
    const preset: SongPreset = {
      version: 1,
      name: songTitle,
      author: songAuthor || undefined,
      key: musicalKey,
      scale,
      tempo,
      metronome: !metronomeMuted,
      loopStart,
      loopEnd,
      drumStyle: drumStyle.name,
      bassStyle: bassStyle.name,
      keysStyle: keysStyle.name,
      chordsInstrument: chordsInstrument.name,
      bassInstrument: bassInstrument.name,
      drumsInstrument: drumsInstrument.name,
      customDrumPattern:
        customDrumStyle && drumStyle.name === customDrumStyle.name ? customDrumStyle.pattern : null,
      placements: placements.map(({ selection, startBeat, lengthBeats }) => ({
        selection,
        startBeat,
        lengthBeats,
      })),
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

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
      return;
    }
    if (placements.length === 0) return;
    await play({
      key: musicalKey,
      scale,
      placements,
      loopStartBeat: loopStart,
      loopEndBeat: loopEnd,
      tempo,
      drums: drumStyle.pattern,
      bass: bassStyle.rule,
      bassPattern: bassStyle.pattern ?? null,
      keys: keysStyle.rule,
    });
    setIsPlaying(true);
  }, [
    isPlaying,
    placements,
    musicalKey,
    scale,
    loopStart,
    loopEnd,
    tempo,
    drumStyle,
    bassStyle,
    keysStyle,
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
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
      />
      <main className="app">
        <div className="layout">
          <div className="layout-sidebar">
            <h2 className="panel-title">Chord Palette</h2>
            <ChordPalette musicalKey={musicalKey} scale={scale} onAudition={handleAudition} />

            <details className="more-section">
              <summary>More</summary>
              <div className="more-section-content">
                <MidiUpload onFile={handleMidiUpload} error={midiError} />
                <SongPresetFileControls
                  onSave={handleSaveSongPreset}
                  onImportFile={handleImportSongPresetFile}
                  error={songPresetError}
                />
              </div>
            </details>
          </div>
          <div className="layout-grid">
            <ChordGrid
              placements={placements}
              musicalKey={musicalKey}
              scale={scale}
              loopStart={loopStart}
              loopEnd={loopEnd}
              playheadBeat={playheadBeat}
              onDropChord={handleDropChord}
              onReplaceChord={handleReplaceChord}
              onResize={handleResize}
              onMove={handleMove}
              onRemove={handleRemove}
              onClear={handleClear}
              onLoopChange={handleLoopChange}
              onAuditionChord={handleAudition}
              onPastePlacements={handlePastePlacements}
              title={songTitle}
              onTitleChange={setSongTitle}
              author={songAuthor}
              onAuthorChange={setSongAuthor}
              tempo={tempo}
            />
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
              volume={drumsVolume}
              onVolumeChange={setDrumsVolumeState}
              muted={drumsMuted}
              onToggleMuted={() => setDrumsMutedState((v) => !v)}
              expanded={drumsExpanded}
              onToggleExpanded={() => setDrumsExpanded((v) => !v)}
              expandedContent={
                <>
                  <MiniFader id="volume-kick" label="Kick" value={kickVolume} onChange={setKickVolumeState} />
                  <MiniFader id="volume-snare" label="Snare" value={snareVolume} onChange={setSnareVolumeState} />
                  <MiniFader id="volume-hihat" label="Hihat" value={hihatVolume} onChange={setHihatVolumeState} />
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
              volume={bassVolume}
              onVolumeChange={setBassVolumeState}
              muted={bassMuted}
              onToggleMuted={() => setBassMutedState((v) => !v)}
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
              volume={chordsVolume}
              onVolumeChange={setChordsVolumeState}
              muted={chordsMuted}
              onToggleMuted={() => setChordsMutedState((v) => !v)}
            />
            <ChannelStrip
              label="Metronome"
              accent="metronome"
              volume={metronomeVolume}
              onVolumeChange={setMetronomeVolumeState}
              muted={metronomeMuted}
              onToggleMuted={() => setMetronomeMutedState((v) => !v)}
            />
            <div className="channel-strip channel-strip-master">
              <VerticalFader id="volume-master" value={masterVolume} onChange={setMasterVolumeState} />
              <span className="channel-strip-label">Master</span>
            </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
