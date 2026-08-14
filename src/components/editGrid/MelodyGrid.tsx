import type { MouseEvent as ReactMouseEvent } from 'react';
import type { MelodyNote } from '../../data/melody';
import type { ScaleName } from '../../data/progressions';
import { DEGREE_COLORS, midiToScaleDegreePosition } from '../../data/progressions';
import { COL_UNIT_BEATS, MELODY_ROW_COUNT, colLine, melodyTrackForDegree } from './gridMath';

type Props = {
  systemStart: number;
  beatsPerSystem: number;
  melody: MelodyNote[];
  musicalKey: string;
  scale: ScaleName;
  visibleOctave: number;
  selectedMelodyIndex: number | null;
  activeCell: number | null;
  onActivateCell: (localBeat: number) => void;
  onNoteMouseDown: (index: number) => (e: ReactMouseEvent) => void;
};

/** The 7-row diatonic melody grid for one system — one row per scale degree
 * within visibleOctave, columns at half-beat resolution. A plain click never
 * places a note directly (stray clicks used to do that, which the click-to-
 * activate model below exists specifically to stop) — it only moves the
 * cursor to the nearest half-beat; EditGrid.tsx's keydown handler is the only
 * place a note actually gets added (1-7 keys) once that cursor is live. */
export function MelodyGrid({
  systemStart,
  beatsPerSystem,
  melody,
  musicalKey,
  scale,
  visibleOctave,
  selectedMelodyIndex,
  activeCell,
  onActivateCell,
  onNoteMouseDown,
}: Props) {
  const systemEnd = systemStart + beatsPerSystem;
  const rows = Array.from({ length: MELODY_ROW_COUNT }, (_, i) => MELODY_ROW_COUNT - 1 - i); // top row = degree 6

  return (
    <>
      {rows.map((degree) => (
        <div
          key={`melody-row-${degree}`}
          className="melody-row"
          data-degree={degree}
          style={{ gridRow: melodyTrackForDegree(degree), gridColumn: '1 / -1' }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const raw = ((e.clientX - rect.left) / rect.width) * beatsPerSystem;
            const snapped = Math.round(raw / COL_UNIT_BEATS) * COL_UNIT_BEATS;
            const localBeat = Math.max(0, Math.min(beatsPerSystem - COL_UNIT_BEATS, snapped));
            onActivateCell(localBeat);
          }}
        />
      ))}
      {activeCell !== null && activeCell >= systemStart && activeCell < systemEnd && (
        <div
          className="melody-cursor"
          style={{
            gridRow: `${melodyTrackForDegree(MELODY_ROW_COUNT - 1)} / ${melodyTrackForDegree(0) + 1}`,
            gridColumn: colLine(activeCell - systemStart),
          }}
        />
      )}
      {melody.map((note, index) => {
        if (note.startBeat < systemStart || note.startBeat >= systemEnd) return null;
        const position = midiToScaleDegreePosition(note.midi, musicalKey, scale);
        if (position.octave !== visibleOctave) return null;
        const localStart = note.startBeat - systemStart;
        const localEnd = Math.min(beatsPerSystem, localStart + note.lengthBeats);
        const chromatic = position.semitoneOffset !== 0;
        return (
          <div
            key={index}
            className={`melody-note-block${selectedMelodyIndex === index ? ' melody-note-block-selected' : ''}`}
            style={{
              gridRow: melodyTrackForDegree(position.degree),
              gridColumn: `${colLine(localStart)} / ${colLine(localEnd)}`,
              backgroundColor: DEGREE_COLORS[position.degree],
            }}
            onMouseDown={onNoteMouseDown(index)}
          >
            {chromatic && (
              <span className="melody-note-chromatic-badge" aria-hidden="true">
                +
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
