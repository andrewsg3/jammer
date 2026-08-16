import { useEffect, useRef } from 'react';
import { Formatter, GhostNote, Renderer, TabNote, TabStave, TabTie, Voice } from 'vexflow';
import type { LickNote } from '../data/licks';
import { beatsToDurations } from '../data/vexflowDurations';

type Props = {
  notes: LickNote[];
  beatsPerBar: number;
  totalBars: number;
  // Local beat position of the drag/step-entry cursor, if any -- drawn as a
  // thin vertical line the same way EditGrid's own playhead/cursor reads,
  // so the tab view and the click grid underneath it visibly agree on where
  // "here" is. null hides it.
  cursorBeat: number | null;
};

const BAR_WIDTH = 140;
const MARGIN = 10;
// A 6-line tab stave's own fret-number glyphs for the lowest string(s) sit
// noticeably below its last line -- 100 clipped them right off the bottom
// edge of the SVG canvas (confirmed via a rendered <text> at y=114 inside a
// height=110 <svg>, invisible but present in the DOM). 140 leaves real margin.
const STAVE_HEIGHT = 140;
const EPS = 1e-6;

/** Renders a lick as real guitar TAB via VexFlow's TabStave/TabNote --
 * fret/string, not pitch, so no key-signature-aware spelling is needed the
 * way LeadSheet.tsx's staff notation does. Reuses vexflowDurations.ts's own
 * beats->duration decomposition (identical math to LeadSheet.tsx's, just
 * feeding TabNote instead of StaveNote) and the same forced-bar-boundary
 * cursor-walk shape, trimmed down: no chord symbols, no sections, no
 * multi-row wrapping -- a lick is short (1-4 bars) and lives in a modal, not
 * a full page, so a single scrollable row is simpler and sufficient. */
export function LickTabView({ notes, beatsPerBar, totalBars, cursorBeat }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const bars = Math.max(1, totalBars);
    const width = bars * BAR_WIDTH + MARGIN * 2;
    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, STAVE_HEIGHT + MARGIN);
    const context = renderer.getContext();

    const staves: TabStave[] = [];
    for (let bar = 0; bar < bars; bar++) {
      const stave = new TabStave(MARGIN + bar * BAR_WIDTH, MARGIN / 2, BAR_WIDTH);
      if (bar === 0) stave.addTabGlyph();
      stave.setContext(context).draw();
      staves.push(stave);
    }

    const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
    const barTickables: (TabNote | GhostNote)[][] = [];
    const tieGroups: TabNote[][] = [];

    let cursor = 0;
    let noteIdx = 0;
    let active: LickNote | null = null;
    let currentTieGroup: TabNote[] = [];

    for (let bar = 0; bar < bars; bar++) {
      const barStart = bar * beatsPerBar;
      const barEnd = barStart + beatsPerBar;
      const tickables: (TabNote | GhostNote)[] = [];

      while (cursor < barEnd - EPS) {
        if (active) {
          const note = active;
          const noteEnd = Math.min(note.startBeat + note.lengthBeats, barEnd);
          const tokens = beatsToDurations(noteEnd - cursor);
          tokens.forEach((token) => {
            const tabNote = new TabNote({ positions: [{ str: note.string, fret: note.fret }], duration: token });
            tickables.push(tabNote);
            currentTieGroup.push(tabNote);
          });
          cursor = noteEnd;
          if (cursor >= note.startBeat + note.lengthBeats - EPS) {
            if (currentTieGroup.length > 1) tieGroups.push(currentTieGroup);
            currentTieGroup = [];
            active = null;
          }
          continue;
        }
        if (noteIdx < sorted.length && Math.abs(sorted[noteIdx].startBeat - cursor) < EPS) {
          active = sorted[noteIdx];
          noteIdx++;
          continue;
        }
        const nextNoteStart = noteIdx < sorted.length ? sorted[noteIdx].startBeat : Infinity;
        const restEnd = Math.min(barEnd, nextNoteStart);
        const tokens = beatsToDurations(restEnd - cursor);
        // GhostNote, not a TabNote with a dummy position -- unlike StaveNote,
        // TabNote has no concept of a rest at all (it always draws its own
        // fret-number glyphs regardless of a trailing 'r' on the duration
        // string); GhostNote is VexFlow's real zero-width "occupies time,
        // draws nothing" tickable, which is what a gap in a tab voice needs.
        tokens.forEach((token) => {
          tickables.push(new GhostNote(token));
        });
        cursor = restEnd;
      }
      barTickables.push(tickables);
    }

    barTickables.forEach((tickables, bar) => {
      const voice = new Voice({ numBeats: beatsPerBar, beatValue: 4 }).setStrict(false);
      voice.addTickables(tickables);
      new Formatter().format([voice], BAR_WIDTH - 20);
      voice.draw(context, staves[bar]);
    });

    tieGroups.forEach((group) => {
      for (let i = 0; i < group.length - 1; i++) {
        new TabTie({ firstNote: group[i], lastNote: group[i + 1] }).setContext(context).draw();
      }
    });
  }, [notes, beatsPerBar, totalBars]);

  const cursorX = cursorBeat === null ? null : MARGIN + (cursorBeat / beatsPerBar) * BAR_WIDTH;

  return (
    <div className="lick-tab-view">
      <div ref={containerRef} className="lick-tab-view-svg" />
      {cursorX !== null && <div className="lick-tab-view-cursor" style={{ left: cursorX }} />}
    </div>
  );
}
