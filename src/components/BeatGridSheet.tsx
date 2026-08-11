import { useMemo } from 'react';
import { chordName, chordNameParts, resolveSelection } from '../data/progressions';
import type { Chord, ChordPlacement, NotationStyle, ScaleName } from '../data/progressions';
import type { SectionMarker } from '../data/sections';

// Four bars per line — the minimal "chord + blanks for its held duration" chart
// shape the mobile companion view originated (see CLAUDE.md's melody notation
// section for why this codebase doesn't attempt real rhythm notation instead).
// BARS_PER_ROW is a fixed page-layout choice, independent of the song's own
// meter (see ChordGrid.tsx's own BARS_PER_ROW for the same reasoning) — only
// how many beats a bar/row represents varies, via the beatsPerBar prop below.
const BARS_PER_ROW = 4;
// Must match .beat-grid-sheet's own grid-auto-rows/row-gap in index.css — used to
// compute a section badge's pixel position (see the sections render block
// below), since it's a plain absolutely-positioned overlay, not a real grid
// item (a real grid item would compete with the auto-placed chord cells for
// column slots the same way an earlier playhead attempt here did, distorting
// their layout).
const ROW_HEIGHT_PX = 40;
const ROW_GAP_PX = 6;

type BeatCell = {
  beat: number;
  placement: ChordPlacement | null;
  // What this cell shows: 'name' for a chord's actual label (whether it starts
  // exactly here — anywhere within a bar — or this bar simply hasn't matched the
  // previous one yet), 'repeat' for the "%" same-as-last-bar mark, 'nc' for a gap
  // between placements (real-book "N.C." — No Chord — same idea as 'name', just
  // for silence instead of a chord: shown at the gap's own start and again at
  // every bar boundary the gap still covers, mirroring how a held chord gets a
  // fresh mark each bar rather than only where it truly began), or null (blank,
  // either mid-bar hold/silence continuing, or nothing at all). A chord (or gap)
  // held across a bar line is *not* the same as the mark being blank there — e.g.
  // one chord spanning bars 1-2 should read "name" then "%", not "name" then
  // nothing, so it stays visibly "the same chord, still sounding" rather than
  // looking unmarked.
  mark: 'name' | 'repeat' | 'nc' | null;
};

// A run of consecutive beat cells rendered as one grid item (via CSS grid-column
// spanning) rather than one item per beat — lets a "%"/"N.C."/chord name center
// itself against its actual visual width (a whole bar, half a bar, whatever it
// really spans) instead of always centering within a single 1-beat-wide cell. A
// run never crosses a bar line: every bar boundary always carries its own mark
// (see beatCells above), which is exactly what ends the previous run.
type BeatRun = {
  startBeat: number;
  length: number;
  placement: ChordPlacement | null;
  mark: 'name' | 'repeat' | 'nc' | null;
};

/** Same real-book convention as ChordGrid's chord labels: the -/°/+/^ triad-quality
 * marker sets full size next to the root, 7ths/9ths/alterations set smaller and
 * raised (.chord-ext, shared with desktop's notation view). */
export function ChordLabel({ chord, notation }: { chord: Chord; notation: NotationStyle }) {
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

type Props = {
  placements: ChordPlacement[];
  musicalKey: string;
  scale: ScaleName;
  notationStyle: NotationStyle;
  // For highlighting the bar currently sounding during playback. A beat range,
  // not just "which placement is active" — a chord spanning more than one bar
  // produces one run per bar (every bar boundary carries its own mark, ending
  // the previous run — see beatRuns below), and only the run the playhead is
  // actually inside should light up, not every run belonging to that placement.
  playheadBeat: number;
  isPlaying: boolean;
  // Optional — MobilePlayer.tsx's "now playing" grid view has no natural place
  // to show a section otherwise (unlike its countdown view, which already shows
  // one via mobile-player__now-playing-section), so this defaults to none rather
  // than forcing every caller to pass an empty array.
  sections?: SectionMarker[];
  // Simple meter only, always over a "4" denominator -- see CLAUDE.md's "Beats
  // per bar" section. Defaults to 4 so existing callers (MobilePlayer.tsx, if
  // not yet updated) keep behaving exactly as before.
  beatsPerBar?: number;
};

/**
 * A minimal beat-grid lead sheet: a chord's symbol sits in its first beat's cell,
 * the rest of its held duration is blank cells, and every bar boundary carries a
 * mark (its own name, or "%" for a repeat) — same convention as a hand-written
 * chart. Originally MobilePlayer.tsx's own chart; extracted so the desktop app's
 * "visualize like mobile" toggle (ChordGrid.tsx) can render the exact same thing
 * rather than a lookalike copy. Read-only by design in both places — no
 * drag/resize/select, matching the mobile companion view's own playback-only
 * stance (see CLAUDE.md's non-goals).
 */
export function BeatGridSheet({
  placements,
  musicalKey,
  scale,
  notationStyle,
  playheadBeat,
  isPlaying,
  sections = [],
  beatsPerBar = 4,
}: Props) {
  const beatsPerRow = beatsPerBar * BARS_PER_ROW;
  // A flat list of beat cells — CSS grid auto-flow wraps every BEATS_PER_ROW (four
  // bars) into a new visual row, so the whole chart is one grid rather than a stack
  // of independently-bordered row boxes (a per-row version could show a hairline
  // seam between rows where two adjacent boxes' borders didn't quite meet).
  const beatCells = useMemo(() => {
    // Not rounded up to a full row — a song that ends mid-row (e.g. 12 Bar Blues'
    // 10 bars, not a multiple of the 4-bars-per-row width) should just stop there,
    // not trail off into empty bars with nothing in them.
    const totalBeats = placements.reduce((max, p) => Math.max(max, p.startBeat + p.lengthBeats), 0);
    // The chord that was sounding at the previous bar's own boundary — compared
    // against each new bar boundary to decide "name" vs "%". A gap resets this to
    // null (see the !placement branch below), so a chord that resumes after a
    // rest always reads as "name" again, never a wrongly-implied "%" of whatever
    // was playing before the silence.
    let previousBarChordName: string | null = null;
    // Whether the previous beat iterated was itself a gap — true only for the
    // very first beat of a run of silence, the "N.C." equivalent of a chord's
    // own isChordStart.
    let wasInGap = false;
    return Array.from({ length: totalBeats }, (_, beat): BeatCell => {
      const placement = placements.find((p) => beat >= p.startBeat && beat < p.startBeat + p.lengthBeats) ?? null;
      const isChordStart = placement?.startBeat === beat;
      const isGapStart = !placement && !wasInGap;
      wasInGap = !placement;
      let mark: BeatCell['mark'] = placement ? (isChordStart ? 'name' : null) : isGapStart ? 'nc' : null;
      if (beat % beatsPerBar === 0) {
        if (!placement) {
          // Every bar a gap still covers gets its own "N.C." — same reasoning as
          // a held chord getting a fresh "%" each bar rather than only marking
          // where it truly began (see beatCells' own doc comment above).
          mark = 'nc';
          previousBarChordName = null;
        } else {
          const chordNameHere = chordName(resolveSelection(musicalKey, scale, placement.selection), notationStyle);
          if (isChordStart) {
            // A fresh attack lands exactly on this bar boundary — the only case
            // that actually needs comparing against the previous bar, to catch
            // two adjacent placements that happen to share a chord.
            mark = chordNameHere === previousBarChordName ? 'repeat' : 'name';
          } else {
            // This boundary falls inside a placement that already started
            // earlier — whether at the previous bar's own boundary or mid-bar —
            // so it's always a continuation, already labeled at its true start
            // beat. Comparing against previousBarChordName here would wrongly
            // re-show the name if that start beat wasn't itself a bar boundary.
            mark = 'repeat';
          }
          previousBarChordName = chordNameHere;
        }
      }
      return { beat, placement, mark };
    });
  }, [placements, musicalKey, scale, notationStyle, beatsPerBar]);

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

  return (
    <div className="beat-grid-sheet">
      {beatRuns.map((run) => {
        const isActive =
          isPlaying && run.placement && playheadBeat >= run.startBeat && playheadBeat < run.startBeat + run.length;
        return (
          <div
            key={run.startBeat}
            style={{ gridColumn: `span ${run.length}` }}
            className={
              'beat-grid-sheet-cell' +
              (run.startBeat % beatsPerRow === 0 ? ' beat-grid-sheet-cell--row-start' : '') +
              ((run.startBeat + run.length) % beatsPerBar === 0 ? ' beat-grid-sheet-cell--bar-end' : '') +
              (isActive ? ' beat-grid-sheet-cell--active' : '')
            }
          >
            {run.mark === 'repeat' && run.placement && (
              <span
                className="beat-grid-sheet-repeat"
                aria-label={`Same as previous bar: ${chordName(resolveSelection(musicalKey, scale, run.placement.selection), notationStyle)}`}
              >
                %
              </span>
            )}
            {run.mark === 'name' && run.placement && (
              <span className="beat-grid-sheet-chord">
                <ChordLabel
                  chord={resolveSelection(musicalKey, scale, run.placement.selection)}
                  notation={notationStyle}
                />
              </span>
            )}
            {run.mark === 'nc' && <span className="beat-grid-sheet-chord beat-grid-sheet-nc">N.C.</span>}
          </div>
        );
      })}
      {sections.map((section) => {
        const row = Math.floor(section.startBeat / beatsPerRow);
        const col = section.startBeat % beatsPerRow;
        return (
          <div
            key={section.id}
            className="beat-grid-sheet-section"
            style={{
              top: row * (ROW_HEIGHT_PX + ROW_GAP_PX),
              left: `${(col / beatsPerRow) * 100}%`,
            }}
          >
            {section.label}
          </div>
        );
      })}
    </div>
  );
}
