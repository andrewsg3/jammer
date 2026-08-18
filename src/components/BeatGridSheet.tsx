import { useMemo, useRef } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
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
  // Optional — lets a click on a chord's name/repeat mark open a fingering peek
  // (App.tsx's chordPopover) without giving up this view's read-only character;
  // MobilePlayer.tsx doesn't pass it, so its own use of this component is
  // unaffected. See CLAUDE.md's "Chord fingering popover" section. The second
  // argument (the clicked run's own startBeat) is new -- added for Practice's
  // song-scoped trainer (see selectedBeat below), which needs to know exactly
  // which bar was clicked, not just its chord. Existing callers that only
  // declared a one-argument callback (App.tsx's handleChordPeek) keep working
  // unchanged: a function with fewer declared parameters is assignable here,
  // and simply never reads the extra argument.
  onChordClick?: (chord: Chord, startBeat: number) => void;
  // Optional — highlights whichever run starts at this beat, independent of
  // isPlaying/playheadBeat. Practice's song-scoped trainer uses this to show
  // which chord is currently selected (via a click, or the song's own first
  // chord by default) when nothing is actively playing -- see
  // ScaleArpeggioTrainer.tsx. No other caller passes this yet.
  selectedBeat?: number | null;
  // Loop range (App.tsx's own loopStart/loopEnd -- the same state Compose's
  // LoopRow/playback already use), plus a way to set it from here. Optional --
  // MobilePlayer.tsx doesn't pass either, so it gets no loop UI at all (this
  // is a desktop-only convenience, matching "no editing on mobile"). Compose
  // doesn't need this either (it already has full loop editing via
  // LoopRow.tsx/RulerRow.tsx's own Shift-drag) -- this exists specifically
  // for Play Along and Practice, which had no way to set a loop at all
  // before this. See CLAUDE.md's "Loop a section, from Play Along/Practice"
  // section for the full design.
  loopStart?: number;
  loopEnd?: number;
  onLoopRangeChange?: (loopStart: number, loopEnd: number) => void;
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
  onChordClick,
  selectedBeat = null,
  loopStart,
  loopEnd,
  onLoopRangeChange,
}: Props) {
  const beatsPerRow = beatsPerBar * BARS_PER_ROW;
  // The bar a Shift+drag started on -- a plain ref, not React state, since it
  // only ever matters inside the document-level mousemove/mouseup listeners
  // below (a re-render on every drag frame isn't needed for this value
  // itself, only for the loopStart/loopEnd it produces via onLoopRangeChange,
  // which the caller owns).
  const dragAnchorBarRef = useRef<number | null>(null);
  // Not rounded up to a full row — a song that ends mid-row (e.g. 12 Bar Blues'
  // 10 bars, not a multiple of the 4-bars-per-row width) should just stop there,
  // not trail off into empty bars with nothing in them. Pulled out of beatCells
  // below so the loop indicator can also use it, to tell "a genuine sub-range
  // loop is set" apart from "loopStart/loopEnd just happen to be the trivial
  // whole-song default App.tsx always carries" (see the loop indicator's own
  // comment further down).
  const totalBeats = useMemo(
    () => placements.reduce((max, p) => Math.max(max, p.startBeat + p.lengthBeats), 0),
    [placements],
  );
  // A flat list of beat cells — CSS grid auto-flow wraps every BEATS_PER_ROW (four
  // bars) into a new visual row, so the whole chart is one grid rather than a stack
  // of independently-bordered row boxes (a per-row version could show a hairline
  // seam between rows where two adjacent boxes' borders didn't quite meet).
  const beatCells = useMemo(() => {
    // The chord actually sounding in the beat immediately before the one
    // being processed — compared against each new bar boundary to decide
    // "name" vs "%". Deliberately *not* "whatever chord last started a bar
    // boundary": a meter like Take Five's 5/4, where a bar can hold two
    // different chords (e.g. 3 beats of Eb-7 then 2 of Bb-7), can reach the
    // *next* bar boundary with a chord that happens to share a name with
    // that earlier boundary's chord even though a different chord played in
    // between — tracking the immediately-preceding beat instead (updated on
    // every beat, not just bar boundaries) means "%" only fires when nothing
    // has actually changed since a beat ago, not when a name coincidentally
    // recurs later. A gap makes this null, so a chord that resumes after a
    // rest always reads as "name" again, never a wrongly-implied "%" of
    // whatever was playing before the silence.
    let previousBeatChordName: string | null = null;
    // Whether the previous beat iterated was itself a gap — true only for the
    // very first beat of a run of silence, the "N.C." equivalent of a chord's
    // own isChordStart.
    let wasInGap = false;
    return Array.from({ length: totalBeats }, (_, beat): BeatCell => {
      const placement = placements.find((p) => beat >= p.startBeat && beat < p.startBeat + p.lengthBeats) ?? null;
      const isChordStart = placement?.startBeat === beat;
      const isGapStart = !placement && !wasInGap;
      wasInGap = !placement;
      const chordNameHere = placement
        ? chordName(resolveSelection(musicalKey, scale, placement.selection), notationStyle)
        : null;
      let mark: BeatCell['mark'] = placement ? (isChordStart ? 'name' : null) : isGapStart ? 'nc' : null;
      if (beat % beatsPerBar === 0) {
        if (!placement) {
          // Every bar a gap still covers gets its own "N.C." — same reasoning as
          // a held chord getting a fresh "%" each bar rather than only marking
          // where it truly began (see beatCells' own doc comment above).
          mark = 'nc';
        } else if (isChordStart) {
          // A fresh attack lands exactly on this bar boundary — the only case
          // that actually needs comparing against what came right before it,
          // to catch two adjacent placements that happen to share a chord.
          mark = chordNameHere === previousBeatChordName ? 'repeat' : 'name';
        } else {
          // This boundary falls inside a placement that already started
          // earlier — whether at the previous bar's own boundary or mid-bar —
          // so it's always a continuation, already labeled at its true start
          // beat. Comparing against previousBeatChordName here would wrongly
          // re-show the name if that start beat wasn't itself a bar boundary.
          mark = 'repeat';
        }
      }
      previousBeatChordName = chordNameHere;
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

  // A genuine, user-set sub-range, as opposed to loopStart/loopEnd just
  // happening to carry App.tsx's own trivial "loop the whole song" default
  // (0..totalBeats, what every song starts with before anyone drags
  // anything) -- only the former gets a highlight/indicator. Showing a
  // highlight across the *entire* chart for the default case would look like
  // a real loop is active when nothing has actually been set yet.
  const hasCustomLoop =
    onLoopRangeChange != null &&
    loopStart != null &&
    loopEnd != null &&
    loopEnd > loopStart &&
    !(loopStart <= 0 && loopEnd >= totalBeats);

  /** Shift+mousedown on a bar starts a loop-range drag -- a single Shift+click
   * with no movement already loops just that one bar (immediately useful for
   * "practice one chord change" when the change fits in a bar); dragging
   * further extends the range live as the pointer crosses other bars. Mirrors
   * EditGrid's own established "Shift-drag on the ruler" loop-range
   * convention (see CLAUDE.md's "Loop a section, from Play Along/Practice"
   * section) rather than inventing a new gesture -- and deliberately a
   * modifier-gated drag, not a plain click, so it can't collide with this
   * same cell's own plain-click chord-select/fingering-peek behavior
   * (handleCellClick below). Tracked via document-level listeners (not this
   * div's own onMouseMove) because the drag routinely leaves the cell it
   * started on -- same reason EditGrid's own cross-system pointer math
   * (App.tsx) resolves position via document.elementFromPoint rather than a
   * single element's bounds.
   *
   * Real bug, fixed: the anchor used to always be the just-clicked bar, full
   * stop -- fine for one continuous drag, but two *separate* Shift+clicks
   * (click a start bar, release, click an end bar -- a completely reasonable
   * way to try this gesture, not just a single unbroken drag) each reset the
   * anchor to that click's own bar, so the loop collapsed back down to a
   * single bar every time and only the *last* click ever stayed highlighted.
   * Now: if a genuine loop is already active and the new click lands outside
   * it, the anchor becomes that loop's own far edge instead of the clicked
   * bar, so the click *extends* the existing range (in whichever direction)
   * rather than replacing it -- both a second separate click and continuing
   * to drag from here behave the same way. Clicking back inside the current
   * range starts fresh from that bar, same as clicking with no loop active
   * at all -- there's no single obviously-right meaning for "shrink from
   * here" to make a stronger claim on. */
  const handleLoopDragStart = (bar: number) => (e: ReactMouseEvent) => {
    // Shift-gated -- see this function's own doc comment above for why a
    // plain mousedown here must fall through untouched to the normal
    // click-to-select-chord handling on the same cell.
    if (!onLoopRangeChange || !e.shiftKey) return;
    e.preventDefault();
    let anchor = bar;
    if (hasCustomLoop) {
      const startBar = Math.floor(loopStart! / beatsPerBar);
      const endBar = Math.ceil(loopEnd! / beatsPerBar) - 1;
      if (bar < startBar) anchor = endBar;
      else if (bar > endBar) anchor = startBar;
    }
    dragAnchorBarRef.current = anchor;
    onLoopRangeChange(Math.min(anchor, bar) * beatsPerBar, (Math.max(anchor, bar) + 1) * beatsPerBar);
    const handleMove = (ev: MouseEvent) => {
      const currentAnchor = dragAnchorBarRef.current;
      if (currentAnchor === null) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-bar]');
      if (!el) return;
      const bar2 = Number(el.dataset.bar);
      const lo = Math.min(currentAnchor, bar2);
      const hi = Math.max(currentAnchor, bar2);
      onLoopRangeChange(lo * beatsPerBar, (hi + 1) * beatsPerBar);
    };
    const handleUp = () => {
      dragAnchorBarRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  return (
    <>
      {/* Status/discoverability for the Shift+drag loop gesture below --
          per direct user request ("really easily" loop a section, e.g. just
          one chord change). A normal-flow row above the grid, not an
          absolutely-positioned overlay on top of it -- the grid's own top-
          right cells can hold real chord text, and this app's various "paper"
          page wrappers (.beat-grid-sheet-page/.practice-song-grid-page) don't
          reliably have spare padding above the grid to float into. Shown only
          where the gesture is actually wired up (onLoopRangeChange passed at
          all -- Compose doesn't pass it, already having LoopRow's own fuller
          loop editing; MobilePlayer doesn't either).
          No "Bars X-Y" text once a loop is active -- per direct user follow-up,
          once the per-cell top-line highlight (below) actually shows every
          looped bar correctly, spelling the same range out in text is
          redundant. Kept as a title tooltip (hover) and an aria-label for
          screen readers, rounded defensively (Math.floor/Math.ceil, not
          assuming bar-alignment, since loopStart/loopEnd can also have been
          set from Compose's own finer-grained LoopRow) -- just not shown as
          permanent on-screen text anymore. */}
      {onLoopRangeChange &&
        (hasCustomLoop ? (
          <div
            className="beat-grid-sheet-loop-indicator"
            title={`Looping bars ${Math.floor(loopStart! / beatsPerBar) + 1}–${Math.ceil(loopEnd! / beatsPerBar)}`}
          >
            <span aria-hidden="true">🔁</span>
            <span className="sr-only">
              Looping bars {Math.floor(loopStart! / beatsPerBar) + 1}–{Math.ceil(loopEnd! / beatsPerBar)}
            </span>
            <button
              type="button"
              className="beat-grid-sheet-loop-clear"
              onClick={() => onLoopRangeChange(0, totalBeats)}
              aria-label="Clear loop"
              title="Clear loop"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="beat-grid-sheet-loop-hint">Shift+drag a bar to loop it</div>
        ))}
      <div className="beat-grid-sheet" style={{ '--beat-grid-cols': beatsPerRow } as CSSProperties}>
      {beatRuns.map((run) => {
        const isActive =
          !!run.placement &&
          ((isPlaying && playheadBeat >= run.startBeat && playheadBeat < run.startBeat + run.length) ||
            selectedBeat === run.startBeat);
        // Runs never cross a bar line (see BeatRun's own doc comment above),
        // so this is always the one real bar this run belongs to.
        const bar = Math.floor(run.startBeat / beatsPerBar);
        const isInLoop = hasCustomLoop && run.startBeat >= loopStart! && run.startBeat < loopEnd!;
        // The click target is the whole cell (bar), not just the small chord-
        // name/"%" text inside it -- per direct user request. A run's div
        // already spans its full held-duration width (gridColumn: span
        // run.length, see beatRuns above), so putting the handler here rather
        // than on the inner <span> makes the entire bar clickable, blank
        // trailing space included, not just the glyph itself.
        const handleCellClick =
          onChordClick && run.placement
            ? () => onChordClick(resolveSelection(musicalKey, scale, run.placement!.selection), run.startBeat)
            : undefined;
        return (
          <div
            key={run.startBeat}
            data-bar={bar}
            style={{ gridColumn: `span ${run.length}` }}
            className={
              'beat-grid-sheet-cell' +
              (run.startBeat % beatsPerRow === 0 ? ' beat-grid-sheet-cell--row-start' : '') +
              ((run.startBeat + run.length) % beatsPerBar === 0 ? ' beat-grid-sheet-cell--bar-end' : '') +
              (isActive ? ' beat-grid-sheet-cell--active' : '') +
              (isInLoop ? ' beat-grid-sheet-cell--loop' : '') +
              (handleCellClick ? ' beat-grid-sheet-cell--clickable' : '') +
              (onLoopRangeChange ? ' beat-grid-sheet-cell--loopable' : '')
            }
            // preventDefault() in handleLoopDragStart's own mousedown handler
            // only suppresses the browser's default mousedown behavior (text
            // selection, drag-start) -- it does *not* stop the click event
            // that still fires afterward on the same element, so a Shift+
            // click here would otherwise also fire handleCellClick and pop
            // open the chord fingering peek right alongside setting the loop.
            // Explicitly skipped on Shift here rather than relying on that.
            onClick={handleCellClick && ((e) => { if (!e.shiftKey) handleCellClick(); })}
            onMouseDown={onLoopRangeChange ? handleLoopDragStart(bar) : undefined}
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
    </>
  );
}
