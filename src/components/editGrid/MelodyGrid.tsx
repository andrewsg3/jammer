import type { MouseEvent as ReactMouseEvent } from 'react';
import type { MelodyNote, RestMarker } from '../../data/melody';
import type { ScaleName } from '../../data/progressions';
import { DEGREE_COLORS, midiToScaleDegreePosition } from '../../data/progressions';
import { COL_UNIT_BEATS, MELODY_ROW_COUNT, colLine, melodyTrackForDegree } from './gridMath';

type Props = {
  systemStart: number;
  beatsPerSystem: number;
  melody: MelodyNote[];
  restMarkers: RestMarker[];
  musicalKey: string;
  scale: ScaleName;
  visibleOctave: number;
  // How many octave blocks (each MELODY_ROW_COUNT rows) this system's melody
  // grid actually needs, and the absolute octave the topmost block renders --
  // see EditGrid's systemOctaveRange. Usually span=1/topOctave=visibleOctave
  // (the common case, no notes outside the viewed octave in this system).
  topOctave: number;
  octaveSpan: number;
  // What the next 1-7/0 keypress will actually place (EditGrid's hjkl;) --
  // the cursor's width reflects this instead of always being one fixed
  // column, so e.g. selecting a half note (l) shows a cursor 4x as wide as
  // an eighth note (j)'s.
  noteDuration: number;
  selectedMelodyIndex: number | null;
  activeCell: number | null;
  onActivateCell: (localBeat: number) => void;
  onNoteMouseDown: (index: number) => (e: ReactMouseEvent) => void;
};

/** The diatonic melody grid for one system — one row per scale degree per
 * octave block actually needed (normally just visibleOctave's own 7), columns
 * at half-beat resolution. A plain click never places a note directly (stray
 * clicks used to do that, which the click-to-activate model below exists
 * specifically to stop) — it only moves the cursor to the nearest half-beat;
 * EditGrid.tsx's keydown handler is the only place a note actually gets added
 * (1-7 keys) once that cursor is live. */
export function MelodyGrid({
  systemStart,
  beatsPerSystem,
  melody,
  restMarkers,
  musicalKey,
  scale,
  visibleOctave,
  topOctave,
  octaveSpan,
  noteDuration,
  selectedMelodyIndex,
  activeCell,
  onActivateCell,
  onNoteMouseDown,
}: Props) {
  const systemEnd = systemStart + beatsPerSystem;
  // top row overall = degree 6 of the topmost octave block (offset 0).
  const blocks = Array.from({ length: octaveSpan }, (_, i) => i);
  const degrees = Array.from({ length: MELODY_ROW_COUNT }, (_, i) => MELODY_ROW_COUNT - 1 - i);

  return (
    <>
      {blocks.map((offset) =>
        degrees.map((degree) => {
          // Only the melody block's true top/bottom edges (however many
          // octave blocks it's currently showing -- usually just 1, never
          // every octave-block seam) get a divider -- the whole block reads
          // as its own fully-bordered box, same convention every row-group
          // uses (see .ruler-row-bg's own comment in index.css).
          const edgeClass =
            offset === 0 && degree === MELODY_ROW_COUNT - 1
              ? ' melody-row-group-top'
              : offset === octaveSpan - 1 && degree === 0
                ? ' melody-row-group-bottom'
                : '';
          return (
            <div
              key={`melody-row-${offset}-${degree}`}
              className={`melody-row${edgeClass}`}
              data-degree={degree}
              data-octave={topOctave - offset}
              style={{ gridRow: melodyTrackForDegree(degree, offset), gridColumn: '1 / -1' }}
              onMouseDown={(e) => {
                if (e.target !== e.currentTarget) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const raw = ((e.clientX - rect.left) / rect.width) * beatsPerSystem;
                const snapped = Math.round(raw / COL_UNIT_BEATS) * COL_UNIT_BEATS;
                const localBeat = Math.max(0, Math.min(beatsPerSystem - COL_UNIT_BEATS, snapped));
                onActivateCell(localBeat);
              }}
            />
          );
        }),
      )}
      {activeCell !== null &&
        activeCell >= systemStart &&
        activeCell < systemEnd &&
        (() => {
          const localStart = activeCell - systemStart;
          // The grid's own column unit is a half-beat (an eighth note) -- a
          // sub-column duration (only the 1/16 case, h) can't get a real
          // column span of its own, so it renders as a half-width sliver
          // inside its one column instead of misleadingly filling it the
          // same as an eighth note would.
          const subColumn = noteDuration < COL_UNIT_BEATS;
          return (
            <div
              className="melody-cursor"
              style={{
                gridRow: `${melodyTrackForDegree(MELODY_ROW_COUNT - 1, 0)} / ${melodyTrackForDegree(0, octaveSpan - 1) + 1}`,
                gridColumn: subColumn
                  ? colLine(localStart)
                  : `${colLine(localStart)} / ${colLine(localStart + noteDuration)}`,
                width: subColumn ? '50%' : undefined,
              }}
            />
          );
        })()}
      {melody.map((note, index) => {
        if (note.startBeat < systemStart || note.startBeat >= systemEnd) return null;
        const position = midiToScaleDegreePosition(note.midi, musicalKey, scale);
        const offset = topOctave - position.octave;
        if (offset < 0 || offset >= octaveSpan) return null;
        const localStart = note.startBeat - systemStart;
        const localEnd = Math.min(beatsPerSystem, localStart + note.lengthBeats);
        const chromatic = position.semitoneOffset !== 0;
        // A sharp always sits a semitone above its own degree's row -- i.e.
        // between that row and the next scale degree up (spellPitch's "natural
        // below, sharp" convention, see data/melody.ts) -- so it's shown
        // straddling that boundary (melody-note-block-chromatic's translateY)
        // striped in both degrees' colors, rather than sitting flush in one
        // row tinted a single color with a "+" badge (the old treatment).
        const background = chromatic
          ? `repeating-linear-gradient(45deg, ${DEGREE_COLORS[position.degree]} 0px, ${DEGREE_COLORS[position.degree]} 4px, ${DEGREE_COLORS[(position.degree + 1) % 7]} 4px, ${DEGREE_COLORS[(position.degree + 1) % 7]} 8px)`
          : DEGREE_COLORS[position.degree];
        return (
          <div
            key={index}
            className={`melody-note-block${selectedMelodyIndex === index ? ' melody-note-block-selected' : ''}${chromatic ? ' melody-note-block-chromatic' : ''}`}
            style={{
              gridRow: melodyTrackForDegree(position.degree, offset),
              gridColumn: `${colLine(localStart)} / ${colLine(localEnd)}`,
              background,
            }}
            onMouseDown={onNoteMouseDown(index)}
          />
        );
      })}
      {restMarkers.map((rest, index) => {
        if (rest.startBeat < systemStart || rest.startBeat >= systemEnd) return null;
        const localStart = rest.startBeat - systemStart;
        const localEnd = Math.min(beatsPerSystem, localStart + rest.lengthBeats);
        return (
          <div
            key={`rest-${index}`}
            className="melody-rest-block"
            aria-hidden="true"
            style={{
              // Always anchored to the tonic row of visibleOctave (the center
              // octave), regardless of how far the grid's currently expanded
              // to show other notes -- a rest has no pitch of its own.
              gridRow: melodyTrackForDegree(0, topOctave - visibleOctave),
              gridColumn: `${colLine(localStart)} / ${colLine(localEnd)}`,
            }}
          />
        );
      })}
    </>
  );
}
