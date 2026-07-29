import { useEffect, useState } from 'react';
import { ChordGrid, TOTAL_BEATS } from './components/ChordGrid';
import { ChordPalette } from './components/ChordPalette';
import { StylePicker } from './components/StylePicker';
import { TransportControls } from './components/TransportControls';
import { MidiUpload } from './components/MidiUpload';
import { ProgressionPresetPicker } from './components/ProgressionPresetPicker';
import type { Chord, ChordPlacement, ChordSelection, ScaleName } from './data/progressions';
import { drumStyles, bassStyles, keysStyles, type DrumStyle } from './data/instrumentStyles';
import { parseMidiDrumPattern } from './data/midiDrumImport';
import { progressionPresets, type ProgressionPreset } from './data/progressionPresets';
import {
  play,
  stop,
  auditionChord,
  setTempo as setTransportTempo,
  setMetronomeEnabled,
  getCurrentBeat,
} from './audio/engine';

const STARTER_PLACEMENTS: ChordPlacement[] = [
  { id: 'starter-0', selection: { type: 'diatonic', degree: 0 }, startBeat: 0, lengthBeats: 4 },
  { id: 'starter-1', selection: { type: 'secondaryDominant', degree: 5 }, startBeat: 4, lengthBeats: 4 },
  { id: 'starter-2', selection: { type: 'diatonic', degree: 5 }, startBeat: 8, lengthBeats: 4 },
  { id: 'starter-3', selection: { type: 'diatonic', degree: 1 }, startBeat: 12, lengthBeats: 4 },
];

function App() {
  const [musicalKey, setMusicalKey] = useState('C');
  const [scale, setScale] = useState<ScaleName>('major');
  const [placements, setPlacements] = useState<ChordPlacement[]>(STARTER_PLACEMENTS);
  const [tempo, setTempo] = useState(124);
  const [drumStyle, setDrumStyle] = useState(drumStyles.find((s) => s.name === 'Funk')!);
  const [bassStyle, setBassStyle] = useState(bassStyles.find((s) => s.name === 'Walking')!);
  const [keysStyle, setKeysStyle] = useState(keysStyles.find((s) => s.name === 'Sustained 7ths')!);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [customDrumStyle, setCustomDrumStyle] = useState<DrumStyle | null>(null);
  const [midiError, setMidiError] = useState<string | null>(null);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(16);
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);

  useEffect(() => {
    if (isPlaying) setTransportTempo(tempo);
  }, [tempo, isPlaying]);

  useEffect(() => {
    if (isPlaying) setMetronomeEnabled(metronomeOn);
  }, [metronomeOn, isPlaying]);

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

  const handleLoopChange = (start: number, end: number) => {
    setLoopStart(start);
    setLoopEnd(end);
  };

  const handleLoadPreset = (preset: ProgressionPreset) => {
    setPlacements(
      preset.selections.map((selection, i) => ({
        id: crypto.randomUUID(),
        selection,
        startBeat: i * 4,
        lengthBeats: 4,
      })),
    );
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

  const handleTogglePlay = async () => {
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
      keys: keysStyle.rule,
      metronome: metronomeOn,
    });
    setIsPlaying(true);
  };

  return (
    <main className="app">
      <div className="layout">
        <div className="layout-sidebar">
          <h1>trackback</h1>
          <ProgressionPresetPicker presets={progressionPresets} onSelect={handleLoadPreset} />
          <ChordPalette musicalKey={musicalKey} scale={scale} onAudition={handleAudition} />
          <div className="style-pickers">
            <StylePicker
              label="Drums"
              options={customDrumStyle ? [...drumStyles, customDrumStyle] : drumStyles}
              selected={drumStyle}
              onSelect={setDrumStyle}
            />
            <StylePicker label="Bass" options={bassStyles} selected={bassStyle} onSelect={setBassStyle} />
            <StylePicker label="Harmony" options={keysStyles} selected={keysStyle} onSelect={setKeysStyle} />
          </div>
          <MidiUpload onFile={handleMidiUpload} error={midiError} />
          <TransportControls
            musicalKey={musicalKey}
            onKeyChange={setMusicalKey}
            scale={scale}
            onScaleChange={setScale}
            tempo={tempo}
            onTempoChange={setTempo}
            metronomeOn={metronomeOn}
            onMetronomeChange={setMetronomeOn}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
          />
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
          />
        </div>
      </div>
    </main>
  );
}

export default App;
