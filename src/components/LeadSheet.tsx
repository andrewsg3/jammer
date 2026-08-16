import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accidental,
  Beam,
  ChordSymbol,
  ChordSymbolVerticalJustify,
  Formatter,
  Fraction,
  Renderer,
  Stave,
  StaveNote,
  StaveSection,
  StaveModifierPosition,
  StaveTie,
  Voice,
} from 'vexflow';
import { chordNameParts, keySignatureAccidentals, resolveSelection, rootSemitone, shiftRootForKey } from '../data/progressions';
import type { Chord, ChordPlacement, NotationStyle, ScaleName } from '../data/progressions';
import type { MelodyNote } from '../data/melody';
import type { SectionMarker } from '../data/sections';
import { beatsToDurations } from '../data/vexflowDurations';

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

// beatsToDurations (greedy beats->VexFlow-duration-token decomposition) now
// lives in data/vexflowDurations.ts, shared with LickTabView.tsx -- see that
// module's own doc comment for the MELODY_SNAP_BEATS/cap-remainder rationale.

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

/**
 * A real-engraved lead sheet — staff, clef, key signature, rhythm-accurate
 * noteheads/beaming/ties via VexFlow. Chord symbols and section markers alike
 * are native VexFlow elements now, not a second React overlay layer: chord
 * symbols are a real `ChordSymbol` modifier (Architects Daughter carried over
 * via `.setFont()`, same root/ext-superscript/bass split `chordNameParts`
 * always produced) attached to the nearest tickable at-or-before each chord's
 * own beat, matched within that chord's own bar's tickables only -- a chord
 * symbol, like a rehearsal mark, always belongs to a specific bar, so there's
 * no need for the old cross-bar search findTickX used to do purely to compute
 * an x-coordinate for a free-floating div. Section markers use VexFlow's own
 * native StaveSection modifier, same reasoning. Read-only and passive: no
 * click-to-scrub, no loop-range display — just a playhead that follows
 * playback, same restrained scope Chord Grid mode has.
 *
 * Two render layers, kept deliberately separate: the VexFlow SVG (imperative,
 * only rebuilt when the song's actual content changes, now including chord
 * symbols and section badges both) and a plain-React overlay (just the
 * playhead line) that re-renders every animation frame during playback
 * without touching VexFlow at all.
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
  // VexFlow measures ChordSymbol/StaveSection text width itself (to lay out
  // superscript/bass blocks side by side, and to size a StaveSection's own
  // box) using whatever font is *actually* available in the browser at that
  // exact moment -- if Architects Daughter (a @font-face web font, not one of
  // VexFlow's own bundled music fonts) hasn't finished loading yet, it
  // measures with a fallback font instead. Unlike the browser's own text
  // rendering, that measurement gets baked into fixed SVG coordinates right
  // then -- it never redoes itself later just because the font finishes
  // loading and the *glyphs* visually swap in (font-display: swap). Net
  // effect, caught live: chord symbol blocks (root/extension/bass) rendered
  // overlapping instead of flowing left to right, on a page load fast enough
  // to beat the font. document.fonts.ready is the browser's own signal for
  // "every @font-face referenced on this page has actually loaded."
  const [fontsReady, setFontsReady] = useState(false);

  const chords = useMemo(
    () => placements.map((p) => ({ placement: p, chord: resolveSelection(musicalKey, scale, p.selection) })),
    [placements, musicalKey, scale],
  );

  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Printing needs its own re-measurement, not just the ResizeObserver above:
  // this view's SVG width is a real fixed pixel value baked in by VexFlow at
  // render time (see CLEF_GUTTER's own comment -- nothing here is responsive
  // CSS the way ChordGrid.tsx/BeatGridSheet.tsx's percentage-width grids are),
  // so it stays exactly whatever it was measured at on-screen (typically a
  // wide desktop viewport, mixer sidebar included) straight through into the
  // print pass unless something explicitly re-measures it against the print
  // page's own, usually much narrower, width -- otherwise the sheet overflows
  // off the right edge of the printed page. ResizeObserver is not a reliable
  // signal for this specific transition (browsers don't consistently fire it
  // for the layout reflow a print stylesheet triggers), so this reads the
  // wrapper's own boundingClientRect directly on the browser's beforeprint/
  // afterprint events instead, which fire only once the print/screen
  // stylesheet has actually taken effect.
  useEffect(() => {
    const remeasure = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const width = el.getBoundingClientRect().width;
      if (width) setContainerWidth(Math.round(width));
    };
    window.addEventListener('beforeprint', remeasure);
    window.addEventListener('afterprint', remeasure);
    return () => {
      window.removeEventListener('beforeprint', remeasure);
      window.removeEventListener('afterprint', remeasure);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = ''; // clear the previous render before rebuilding

    if (containerWidth === 0) return; // not yet measured
    if (!fontsReady) return; // wait for Architects Daughter -- see fontsReady's own comment above

    const totalBeats = Math.max(
      0,
      ...placements.map((p) => p.startBeat + p.lengthBeats),
      ...melody.map((n) => n.startBeat + n.lengthBeats),
      ...sections.map((s) => s.startBeat + s.lengthBeats),
    );
    if (totalBeats === 0) {
      setBarLayout([]);
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

    // A rehearsal mark's real notation meaning is "this bar," not a beat
    // position within it — real charts never place one mid-measure — so
    // grouping by bar (rather than the exact-tick matching chord symbols
    // still use, just now scoped to a single bar's own tickables -- see
    // chordsByBar below) is the correct model here, not just a simplification
    // of it.
    const sectionsByBar = new Map<number, SectionMarker[]>();
    for (const s of sections) {
      const bar = Math.min(totalBars - 1, Math.max(0, Math.floor(s.startBeat / beatsPerBar)));
      const list = sectionsByBar.get(bar) ?? [];
      list.push(s);
      sectionsByBar.set(bar, list);
    }

    // Which bar each chord's own ChordSymbol modifier needs to join -- a
    // native modifier has to be attached to a tickable that actually belongs
    // to that bar's own Voice, so this grouping (like sectionsByBar above)
    // has to exist before that bar gets formatted/drawn, not after.
    const chordsByBar = new Map<number, { placement: ChordPlacement; chord: Chord }[]>();
    for (const c of chords) {
      const bar = Math.min(totalBars - 1, Math.max(0, Math.floor(c.placement.startBeat / beatsPerBar)));
      const list = chordsByBar.get(bar) ?? [];
      list.push(c);
      chordsByBar.set(bar, list);
    }

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
      // VexFlow's own StaveModifier, drawn as part of this stave's own draw()
      // pass below (a real StaveSection, not this app's own overlay div the
      // way chord symbols work) -- position ABOVE rather than the default
      // BEGIN slot so it sits flush at the bar's own left edge instead of
      // stacking after bar 0's clef/key/time signature.
      for (const section of sectionsByBar.get(bar) ?? []) {
        stave.addModifier(
          new StaveSection(section.label)
            .setPosition(StaveModifierPosition.ABOVE)
            .setFont({ family: 'Architects Daughter', size: 13, weight: '700' }),
        );
      }
      stave.setContext(context).draw();
      staves.push(stave);
      layouts.push({ x0: stave.getNoteStartX(), x1: stave.getNoteEndX(), y });
      cursorXInRow += width;
    }

    // --- Forced-boundary construction: one continuous walk across the whole
    // song, splitting only at bar lines (always forced — each bar needs its own
    // Voice) and, when nothing's currently sustaining, at chord starts (so
    // their labels can align to a real tickable's rendered x-position with no
    // interpolation). Section starts no longer force a split here -- they're
    // native StaveSection modifiers attached to a whole bar now (see above),
    // not tick-position-matched the way chord symbols still are. A melody
    // note already sustaining across a chord boundary is never split for it —
    // the chord symbol falls back to the start of whichever note/rest segment
    // contains that beat instead. ---
    const sortedMelody = [...melody].sort((a, b) => a.startBeat - b.startBeat);
    const softBoundariesByBar: number[][] = layouts.map(() => []);
    for (const p of placements) {
      const bar = Math.floor(p.startBeat / beatsPerBar);
      if (bar >= 0 && bar < totalBars) softBoundariesByBar[bar].push(p.startBeat);
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
    // reset at each bar boundary from the key signature itself. Every one of the
    // 7 letters needs an explicit entry here, not just the key signature's own
    // altered ones -- makeNote's `activeAccidental[letter] !== accidental` check
    // below would otherwise compare `undefined !== null` for any letter the key
    // signature doesn't touch (true in JS), spuriously drawing a natural on that
    // letter's first appearance in every bar even though it was already natural
    // and needed no marking at all. Caught on a real E minor melody (1 sharp,
    // F only) — every other letter's first note per bar was getting a redundant
    // natural sign.
    const resetAccidentalsForBar = () => {
      const { sign, letters } = keySignatureAccidentals(musicalKey, scale);
      const alteredSign = sign === 'sharp' ? '#' : 'b';
      const altered = new Set(letters.map((letter) => letter.toLowerCase()));
      activeAccidental = {};
      for (const letter of ['c', 'd', 'e', 'f', 'g', 'a', 'b']) {
        activeAccidental[letter] = altered.has(letter) ? alteredSign : null;
      }
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

    // --- Format/draw each bar's voice, attaching that bar's own chord
    // symbols first (a real ChordSymbol modifier needs to be on its target
    // tickable before Formatter.format() runs, so VexFlow accounts for its
    // width the same way it would any other modifier), then beam its real
    // notes. ---
    barTickables.forEach((tickables, bar) => {
      const barStart = bar * beatsPerBar;
      const barEnd = barStart + beatsPerBar;
      const barTickPositions = tickPositions.filter((tp) => tp.beat >= barStart - EPS && tp.beat < barEnd - EPS);
      for (const { placement, chord } of chordsByBar.get(bar) ?? []) {
        let best: TickPosition | null = null;
        for (const tp of barTickPositions) {
          if (tp.beat <= placement.startBeat + EPS && (!best || tp.beat > best.beat)) best = tp;
        }
        const target = best?.tickable ?? tickables[0];
        if (!target) continue; // an empty bar has nothing to attach to (shouldn't happen -- rests always fill a bar)
        const { root, core, ext, bass } = chordNameParts(chord, notationStyle);
        const symbol = new ChordSymbol()
          .setFont({ family: 'Architects Daughter', size: 17, weight: '400' })
          .setVertical(ChordSymbolVerticalJustify.TOP);
        symbol.addText(root + core);
        if (ext) symbol.addTextSuperscript(ext);
        if (bass) symbol.addText(bass);
        // Must attach before formatting, not after -- ChordSymbol.format()
        // calls checkAttachedNote() internally, which throws ("Can't draw
        // ChordSymbol without an index") if the modifier isn't already on a
        // note. Once attached, this static `format` call is still required:
        // it's what actually positions the extension/bass blocks to the
        // right of the root (not automatic as part of Formatter.format()/
        // voice.draw() the way it is for e.g. Accidental) -- skipping it
        // left every block rendered on top of the others at x=0. One fresh
        // state per symbol is fine here (never more than one ChordSymbol on
        // the same note in this app, so nothing needs to coordinate across
        // symbols).
        target.addModifier(symbol);
        ChordSymbol.format([symbol], { leftShift: 0, rightShift: 0, textLine: 0, topTextLine: 0 });
      }

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

    setBarLayout(layouts);
    // chords is derived from placements/musicalKey/scale, already listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, melody, sections, musicalKey, scale, beatsPerBar, chords, containerWidth, fontsReady]);

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
