import { useEffect, useMemo, useRef, useState } from 'react';
import { Accidental, Beam, Formatter, Fraction, Renderer, Stave, StaveNote, StaveTie, Voice } from 'vexflow';
import { chordNameParts, keySignatureAccidentals, resolveSelection, rootSemitone, shiftRootForKey } from '../data/progressions';
import type { Chord, ChordPlacement, NotationStyle, ScaleName } from '../data/progressions';
import type { MelodyNote } from '../data/melody';
import type { SectionMarker } from '../data/sections';

type Props = {
  placements: ChordPlacement[];
  melody: MelodyNote[];
  sections: SectionMarker[];
  musicalKey: string;
  scale: ScaleName;
  notationStyle: NotationStyle;
  beatsPerBar: number;
  playheadBeat: number;
  isPlaying: boolean;
};

// Same page-layout convention ChordGrid.tsx/BeatGridSheet.tsx both use, so bars
// group identically across all three views.
const BARS_PER_ROW = 4;
// Extra width the very first bar of the piece needs for clef/key-signature/time-
// signature, taken out of that row's total width (not added on top of it) — see
// the layout loop below, which is why this alone, unlike everything else here,
// isn't a fixed per-bar width: VexFlow renders at real pixel coordinates, not the
// percentage-width CSS ChordGrid.tsx/BeatGridSheet.tsx use, so nothing here is
// responsive for free the way theirs is — every bar's width is computed from the
// container's own measured clientWidth (see the ResizeObserver below) precisely
// so a row can never render wider than what's actually on screen.
const CLEF_GUTTER = 100;
const ROW_HEIGHT = 140;
const ROW_TOP_PADDING = 30; // headroom above each row's stave for chord symbols
const MARGIN = 10;
const MIN_CONTAINER_WIDTH = 400; // degenerate below this — clamp rather than draw something broken
const EPS = 1e-6;

const SHARP_COUNT_TO_KEY_NAME = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const FLAT_COUNT_TO_KEY_NAME = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

// VexFlow's addKeySignature wants a canonical major-key name (e.g. "Bb" for 2
// flats) rather than a sharp/flat count — derived from keySignatureAccidentals'
// own sign+count rather than a second, independent key-signature computation.
function vexKeySpec(key: string, scale: ScaleName): string {
  const { sign, letters } = keySignatureAccidentals(key, scale);
  return sign === 'sharp' ? SHARP_COUNT_TO_KEY_NAME[letters.length] : FLAT_COUNT_TO_KEY_NAME[letters.length];
}

// Greedy decomposition of an arbitrary beat length into VexFlow duration tokens —
// deliberately simple, not a full rhythm-notation algorithm. MELODY_SNAP_BEATS
// (0.5, see ChordGrid.tsx) means hand-drawn notes always decompose in <=2 tokens;
// imported MIDI notes with arbitrary float lengths are what exercises the
// cap/remainder path below.
const DURATION_TABLE: { beats: number; token: string }[] = [
  { beats: 4, token: 'w' },
  { beats: 3, token: 'hd' },
  { beats: 2, token: 'h' },
  { beats: 1.5, token: 'qd' },
  { beats: 1, token: 'q' },
  { beats: 0.75, token: '8d' },
  { beats: 0.5, token: '8' },
  { beats: 0.25, token: '16' },
];
const MAX_TOKENS_PER_SEGMENT = 8;

function beatsToDurations(beats: number): string[] {
  const tokens: string[] = [];
  let remaining = beats;
  while (remaining > EPS && tokens.length < MAX_TOKENS_PER_SEGMENT) {
    const fit = DURATION_TABLE.find((d) => d.beats <= remaining + EPS);
    if (!fit) break; // smaller than a 16th — drop the remainder
    tokens.push(fit.token);
    remaining -= fit.beats;
  }
  if (remaining > EPS) {
    console.warn(`LeadSheet: dropped a ${remaining.toFixed(3)}-beat remainder too short to notate`);
  }
  return tokens;
}

type SpelledPitch = { letter: string; accidental: '#' | 'b' | null; vexKey: string };

// Key-signature-aware pitch spelling for a melody note — NOT data/melody.ts's
// spellPitch, which always spells a black key "the natural below it, sharp"
// regardless of key (documented there as wrong in flat-heavy keys, exactly the
// gap this view exists to close). Reuses progressions.ts's own shiftRootForKey,
// which already picks sharp-in-a-sharp-key / flat-in-a-flat-key spelling for
// diatonic chord roots elsewhere in this app — applying the same convention to
// every pitch class (not just diatonic ones) gives consistent, key-correct
// spelling without a separate "is this diatonic" check.
function spellMelodyNote(midi: number, key: string, scale: ScaleName): SpelledPitch {
  const keyPc = rootSemitone(key);
  const pc = ((midi % 12) + 12) % 12;
  const offset = (((pc - keyPc) % 12) + 12) % 12;
  const spelled = shiftRootForKey(key, scale, offset); // e.g. "C", "C#", "Db"
  const letter = spelled[0].toLowerCase();
  const accidental = spelled.length > 1 ? (spelled[1] as '#' | 'b') : null;
  const octave = Math.floor(midi / 12) - 1; // MIDI 60 = C4, matches data/melody.ts's MIDDLE_C
  return { letter, accidental, vexKey: `${letter}${accidental ?? ''}/${octave}` };
}

type TickPosition = { beat: number; tickable: StaveNote };
type BarLayout = { x0: number; x1: number; y: number };
type ChordLabel = { placement: ChordPlacement; chord: Chord; x: number; y: number };
type SectionLabel = { section: SectionMarker; x: number; y: number };

/**
 * A real-engraved lead sheet — staff, clef, key signature, rhythm-accurate
 * noteheads/beaming/ties via VexFlow, chord symbols as a hybrid overlay (this
 * app's own Architects Daughter chord-symbol layer, positioned against VexFlow's
 * own formatted tick coordinates — same font/classes ChordGrid.tsx's chord
 * labels use, see CLAUDE.md's "VexFlow for printable/exported lead sheets").
 * Read-only and passive: no click-to-scrub, no loop-range display — just a
 * playhead that follows playback, same restrained scope Chord Grid mode has.
 *
 * Two render layers, kept deliberately separate: the VexFlow SVG (imperative,
 * only rebuilt when the song's actual content changes) and a plain-React overlay
 * (chord symbols, section badges, the playhead line) that re-renders every
 * animation frame during playback without touching VexFlow at all.
 */
export function LeadSheet({
  placements,
  melody,
  sections,
  musicalKey,
  scale,
  notationStyle,
  beatsPerBar,
  playheadBeat,
  isPlaying,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [barLayout, setBarLayout] = useState<BarLayout[]>([]);
  const [chordLabels, setChordLabels] = useState<ChordLabel[]>([]);
  const [sectionLabels, setSectionLabels] = useState<SectionLabel[]>([]);

  const chords = useMemo(
    () => placements.map((p) => ({ placement: p, chord: resolveSelection(musicalKey, scale, p.selection) })),
    [placements, musicalKey, scale],
  );

  // Re-measures whenever the panel itself resizes (window resize, mixer sidebar
  // toggling, etc.) — a plain mount-time measurement alone would go stale the
  // moment the layout around this view changed, since VexFlow bakes real pixel
  // coordinates in at render time rather than staying responsive the way
  // percentage-width CSS does.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(Math.round(width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = ''; // clear the previous render before rebuilding

    if (containerWidth === 0) return; // not yet measured

    const totalBeats = Math.max(
      0,
      ...placements.map((p) => p.startBeat + p.lengthBeats),
      ...melody.map((n) => n.startBeat + n.lengthBeats),
      ...sections.map((s) => s.startBeat + s.lengthBeats),
    );
    if (totalBeats === 0) {
      setBarLayout([]);
      setChordLabels([]);
      setSectionLabels([]);
      return;
    }

    const totalBars = Math.max(1, Math.ceil(totalBeats / beatsPerBar));
    const totalRows = Math.ceil(totalBars / BARS_PER_ROW);

    // Every row is exactly this wide, full stop — the render never asks for more
    // horizontal space than the container actually measured, so it can't overflow
    // the way a fixed-pixel layout did. The first bar of the whole piece borrows
    // CLEF_GUTTER out of its row's own budget (not on top of it) for its clef/
    // key/time-signature, and the row's other bars split what's left — see the
    // per-bar width choice below.
    const rowWidth = Math.max(MIN_CONTAINER_WIDTH, containerWidth) - MARGIN * 2;
    const normalBarWidth = rowWidth / BARS_PER_ROW;
    const firstBarWidth = normalBarWidth + CLEF_GUTTER;
    const otherFirstRowBarWidth = (rowWidth - firstBarWidth) / (BARS_PER_ROW - 1);

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(rowWidth + MARGIN * 2, MARGIN + totalRows * ROW_HEIGHT);
    const context = renderer.getContext();

    // --- Bar/stave layout. Clef + key signature + time signature only on the
    // very first stave of the whole piece — matches ChordGrid.tsx's own
    // first-row-only convention, kept consistent across views rather than
    // "improved" here. ---
    const staves: Stave[] = [];
    const layouts: BarLayout[] = [];
    let cursorXInRow = MARGIN;
    let currentRow = 0;
    for (let bar = 0; bar < totalBars; bar++) {
      const row = Math.floor(bar / BARS_PER_ROW);
      if (row !== currentRow) {
        cursorXInRow = MARGIN;
        currentRow = row;
      }
      const width = bar === 0 ? firstBarWidth : row === 0 ? otherFirstRowBarWidth : normalBarWidth;
      const y = MARGIN + ROW_TOP_PADDING + row * ROW_HEIGHT;
      const stave = new Stave(cursorXInRow, y, width);
      if (bar === 0) {
        stave.addClef('treble');
        stave.addKeySignature(vexKeySpec(musicalKey, scale));
        stave.addTimeSignature(`${beatsPerBar}/4`);
      }
      stave.setContext(context).draw();
      staves.push(stave);
      layouts.push({ x0: stave.getNoteStartX(), x1: stave.getNoteEndX(), y });
      cursorXInRow += width;
    }

    // --- Forced-boundary construction: one continuous walk across the whole
    // song, splitting only at bar lines (always forced — each bar needs its own
    // Voice) and, when nothing's currently sustaining, at chord/section starts
    // (so their labels can align to a real tickable's rendered x-position with
    // no interpolation). A melody note already sustaining across a chord/section
    // boundary is never split for it — the chord symbol falls back to the start
    // of whichever note/rest segment contains that beat instead. ---
    const sortedMelody = [...melody].sort((a, b) => a.startBeat - b.startBeat);
    const softBoundariesByBar: number[][] = layouts.map(() => []);
    for (const p of placements) {
      const bar = Math.floor(p.startBeat / beatsPerBar);
      if (bar >= 0 && bar < totalBars) softBoundariesByBar[bar].push(p.startBeat);
    }
    for (const s of sections) {
      const bar = Math.floor(s.startBeat / beatsPerBar);
      if (bar >= 0 && bar < totalBars) softBoundariesByBar[bar].push(s.startBeat);
    }
    softBoundariesByBar.forEach((list) => list.sort((a, b) => a - b));

    const barTickables: StaveNote[][] = [];
    const tickPositions: TickPosition[] = [];
    const tieGroups: StaveNote[][] = [];

    let cursor = 0;
    let noteIdx = 0;
    let activeNote: MelodyNote | null = null;
    let currentTieGroup: StaveNote[] = [];
    let activeAccidental: Record<string, '#' | 'b' | null> = {};

    // Standard engraving rule: an accidental holds for the rest of the measure —
    // reset at each bar boundary from the key signature itself.
    const resetAccidentalsForBar = () => {
      activeAccidental = {};
      const { sign, letters } = keySignatureAccidentals(musicalKey, scale);
      for (const letter of letters) activeAccidental[letter.toLowerCase()] = sign === 'sharp' ? '#' : 'b';
    };

    const makeNote = (midi: number, token: string, needsAccidentalCheck: boolean): StaveNote => {
      const { letter, accidental, vexKey } = spellMelodyNote(midi, musicalKey, scale);
      const note = new StaveNote({ keys: [vexKey], duration: token });
      // Only the first token of a new note is ever a spelling decision — a tied
      // continuation (across a duration-cap split or a bar line) never restates
      // its own accidental, same as standard notation practice.
      if (needsAccidentalCheck && activeAccidental[letter] !== accidental) {
        note.addModifier(new Accidental(accidental ?? 'n'));
        activeAccidental[letter] = accidental;
      }
      return note;
    };
    const makeRest = (token: string): StaveNote => new StaveNote({ keys: ['b/4'], duration: `${token}r` });

    for (let bar = 0; bar < totalBars; bar++) {
      const barStart = bar * beatsPerBar;
      const barEnd = barStart + beatsPerBar;
      resetAccidentalsForBar();
      const tickables: StaveNote[] = [];

      while (cursor < barEnd - EPS) {
        if (activeNote) {
          const note = activeNote;
          const noteEnd = Math.min(note.startBeat + note.lengthBeats, barEnd);
          const tokens = beatsToDurations(noteEnd - cursor);
          tokens.forEach((token) => {
            const isFirstTokenOverall = currentTieGroup.length === 0;
            const staveNote = makeNote(note.midi, token, isFirstTokenOverall);
            tickables.push(staveNote);
            tickPositions.push({ beat: cursor, tickable: staveNote });
            currentTieGroup.push(staveNote);
          });
          cursor = noteEnd;
          if (cursor >= note.startBeat + note.lengthBeats - EPS) {
            if (currentTieGroup.length > 1) tieGroups.push(currentTieGroup);
            currentTieGroup = [];
            activeNote = null;
          }
          continue;
        }
        if (noteIdx < sortedMelody.length && Math.abs(sortedMelody[noteIdx].startBeat - cursor) < EPS) {
          activeNote = sortedMelody[noteIdx];
          noteIdx++;
          continue;
        }
        const nextNoteStart = noteIdx < sortedMelody.length ? sortedMelody[noteIdx].startBeat : Infinity;
        const nextSoft = softBoundariesByBar[bar].find((b) => b > cursor + EPS) ?? Infinity;
        const restEnd = Math.min(barEnd, nextNoteStart, nextSoft);
        const tokens = beatsToDurations(restEnd - cursor);
        tokens.forEach((token) => {
          const rest = makeRest(token);
          tickables.push(rest);
          tickPositions.push({ beat: cursor, tickable: rest });
        });
        cursor = restEnd;
      }
      barTickables.push(tickables);
    }

    // --- Format/draw each bar's voice, then beam its real notes. ---
    barTickables.forEach((tickables, bar) => {
      const voice = new Voice({ numBeats: beatsPerBar, beatValue: 4 }).setStrict(false);
      voice.addTickables(tickables);
      new Formatter().format([voice], layouts[bar].x1 - layouts[bar].x0);
      voice.draw(context, staves[bar]);
      const notesOnly = tickables.filter((t) => !t.isRest());
      if (notesOnly.length > 0) {
        Beam.generateBeams(notesOnly, {
          groups: Array.from({ length: beatsPerBar }, () => new Fraction(1, 4)),
        }).forEach((beam) => beam.setContext(context).draw());
      }
    });

    tieGroups.forEach((group) => {
      for (let i = 0; i < group.length - 1; i++) {
        new StaveTie({ firstNote: group[i], lastNote: group[i + 1] }).setContext(context).draw();
      }
    });

    // --- Match each chord/section start to the nearest tickable at-or-before it. ---
    const findTickX = (beat: number, bar: number): number => {
      let best: TickPosition | null = null;
      for (const tp of tickPositions) {
        if (tp.beat <= beat + EPS && (!best || tp.beat > best.beat)) best = tp;
      }
      return best ? best.tickable.getAbsoluteX() : layouts[bar].x0;
    };

    setBarLayout(layouts);
    setChordLabels(
      chords.map(({ placement, chord }) => {
        const bar = Math.min(totalBars - 1, Math.max(0, Math.floor(placement.startBeat / beatsPerBar)));
        return { placement, chord, x: findTickX(placement.startBeat, bar), y: layouts[bar].y };
      }),
    );
    setSectionLabels(
      sections.map((section) => {
        const bar = Math.min(totalBars - 1, Math.max(0, Math.floor(section.startBeat / beatsPerBar)));
        return { section, x: findTickX(section.startBeat, bar), y: layouts[bar].y };
      }),
    );
    // chords is derived from placements/musicalKey/scale, already listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, melody, sections, musicalKey, scale, beatsPerBar, chords, containerWidth]);

  // Cheap per-frame overlay only — no VexFlow work here at all.
  const playheadPos = useMemo(() => {
    if (!isPlaying || barLayout.length === 0) return null;
    const bar = Math.min(barLayout.length - 1, Math.max(0, Math.floor(playheadBeat / beatsPerBar)));
    const { x0, x1, y } = barLayout[bar];
    const fracInBar = (((playheadBeat % beatsPerBar) + beatsPerBar) % beatsPerBar) / beatsPerBar;
    return { x: x0 + fracInBar * (x1 - x0), y };
  }, [isPlaying, playheadBeat, barLayout, beatsPerBar]);

  return (
    <div className="lead-sheet" ref={wrapperRef}>
      <div ref={containerRef} className="lead-sheet-svg" />
      <div className="lead-sheet-overlay">
        {chordLabels.map(({ placement, chord, x, y }) => {
          const { root, core, ext, bass } = chordNameParts(chord, notationStyle);
          return (
            <span
              key={placement.id}
              className="chord-label-name lead-sheet-chord-label"
              style={{ left: x, top: y - 22 }}
            >
              {root}
              {core}
              {ext && <sup className="chord-ext">{ext}</sup>}
              {bass}
            </span>
          );
        })}
        {sectionLabels.map(({ section, x, y }) => (
          <div key={section.id} className="beat-grid-sheet-section lead-sheet-section" style={{ left: x, top: y - 22 }}>
            {section.label}
          </div>
        ))}
        {playheadPos && (
          <div
            className="lead-sheet-playhead"
            style={{ left: playheadPos.x, top: playheadPos.y - ROW_TOP_PADDING, height: ROW_HEIGHT - 20 }}
          />
        )}
      </div>
    </div>
  );
}
