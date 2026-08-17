import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  GUITAR_STRING_COUNT,
  MAX_FRET,
  MIN_FRET,
  downloadLick,
  isLick,
  lickNoteMidi,
  parseLickFile,
} from '../data/licks';
import type { LickNote } from '../data/licks';
import { auditionLick, auditionNote } from '../audio/engine';
import { LickTabView } from './LickTabView';
import { COL_UNIT_BEATS } from './editGrid/gridMath';

type Props = {
  tempo: number;
  onClose: () => void;
};

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']; // string 1 (high) .. 6 (low), top to bottom
const BEATS_PER_BAR = 4; // v1: 4/4 licks only, matching how almost all practice material (ii-V-I, turnarounds) is actually written
const CELL_PX = 28; // pixel width of one COL_UNIT_BEATS (half-beat) cell
const PX_PER_BEAT = CELL_PX / COL_UNIT_BEATS;
const DURATION_KEYS: Record<string, number> = { h: 0.25, j: 0.5, k: 1, l: 2, ';': 4 };
const DURATION_LABELS: { value: number; label: string; key: string }[] = [
  { value: 0.25, label: '𝅘𝅥𝅯', key: 'h' },
  { value: 0.5, label: '𝅘𝅥𝅮', key: 'j' },
  { value: 1, label: '𝅘𝅥', key: 'k' },
  { value: 2, label: '𝅗𝅥', key: 'l' },
  { value: 4, label: '𝅝', key: ';' },
];
// A second digit typed within this window composes into a two-digit fret
// (press "1" then "9" quickly -> fret 19) instead of starting a fresh
// single-digit entry -- same type-ahead convention Guitar Pro/TuxGuitar use
// for entering frets 10 and above, not a bespoke scheme (see CLAUDE.md's
// "Practice philosophy" section for the research behind this choice).
const TYPEAHEAD_MS = 600;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type Cursor = { beat: number; string: number };

/** Click-to-place lick editor: one row per guitar string, click to move the
 * cursor there (or land on an existing note), then type a fret number
 * directly -- same interaction language as EditGrid.tsx's melody step entry
 * (arrows navigate, hjkl; sets duration, Backspace/Escape behave the same
 * way), with digit-key fret entry following the real-world Guitar Pro/
 * TuxGuitar convention rather than an invented one. See CLAUDE.md's
 * "Practice philosophy for jazz guitar improvisation" for why this exists:
 * the guitar-fretboard/TAB gap every practice feature there depends on. */
export function LickEditor({ tempo, onClose }: Props) {
  const [label, setLabel] = useState('New Lick');
  const [barsCount, setBarsCount] = useState(2);
  const [notes, setNotes] = useState<LickNote[]>([]);
  const [duration, setDuration] = useState(0.5);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks an in-progress multi-digit fret entry (see TYPEAHEAD_MS above) --
  // a ref, not state, since it's read/written only from the keydown handler
  // and should never itself trigger a re-render.
  const typeAheadRef = useRef<{ buffer: string; beat: number; string: number; time: number } | null>(null);

  const totalBeats = barsCount * BEATS_PER_BAR;

  useEffect(() => {
    // Bars shrinking out from under an existing note (or the cursor) would
    // otherwise leave both silently off the visible grid.
    setNotes((prev) => prev.filter((n) => n.startBeat + n.lengthBeats <= totalBeats));
    setCursor((c) => (c && c.beat < totalBeats ? c : null));
  }, [totalBeats]);

  const placeOrUpdateNote = (beat: number, string: number, fret: number, lengthBeats: number) => {
    const clampedFret = clamp(fret, MIN_FRET, MAX_FRET);
    setNotes((prev) => {
      const existingIdx = prev.findIndex((n) => n.startBeat === beat && n.string === string);
      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], fret: clampedFret };
        return next;
      }
      // Same "placing clears whatever it overlaps" convention EditGrid's own
      // melody step entry uses -- only ever on this string, other strings are
      // independent voices.
      const filtered = prev.filter(
        (n) => n.string !== string || !(beat < n.startBeat + n.lengthBeats && n.startBeat < beat + lengthBeats),
      );
      return [...filtered, { startBeat: beat, string, fret: clampedFret, lengthBeats }];
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === 'Escape') {
        setCursor(null);
        return;
      }
      if (cursor === null) return;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setCursor((c) => (c ? { ...c, string: clamp(c.string + delta, 1, GUITAR_STRING_COUNT) } : c));
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? duration : -duration;
        setCursor((c) => (c ? { ...c, beat: clamp(c.beat + delta, 0, totalBeats - COL_UNIT_BEATS) } : c));
        return;
      }

      const durationKeyValue = DURATION_KEYS[e.key.toLowerCase()];
      if (durationKeyValue !== undefined) {
        e.preventDefault();
        setDuration(durationKeyValue);
        // Also resizes a note sitting exactly at the cursor, same dual-purpose
        // hjkl; convention EditGrid's melody editor already uses.
        setNotes((prev) =>
          prev.map((n) =>
            n.startBeat === cursor.beat && n.string === cursor.string ? { ...n, lengthBeats: durationKeyValue } : n,
          ),
        );
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        const existing = notes.find((n) => n.startBeat === cursor.beat && n.string === cursor.string);
        if (existing) {
          setNotes((prev) => prev.filter((n) => n !== existing));
        } else {
          setCursor((c) => (c ? { ...c, beat: clamp(c.beat - duration, 0, totalBeats - COL_UNIT_BEATS) } : c));
        }
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const now = Date.now();
        const ta = typeAheadRef.current;
        const composing =
          ta && ta.beat === cursor.beat && ta.string === cursor.string && now - ta.time < TYPEAHEAD_MS && ta.buffer.length < 2;
        const buffer = composing ? ta!.buffer + e.key : e.key;
        typeAheadRef.current = { buffer, beat: cursor.beat, string: cursor.string, time: now };
        const fret = clamp(parseInt(buffer, 10), MIN_FRET, MAX_FRET);
        const existing = notes.find((n) => n.startBeat === cursor.beat && n.string === cursor.string);
        placeOrUpdateNote(cursor.beat, cursor.string, fret, existing?.lengthBeats ?? duration);
        auditionNote(lickNoteMidi({ string: cursor.string, fret }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cursor, notes, duration, totalBeats]);

  const handleRowMouseDown = (string: number) => (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawBeat = ((e.clientX - rect.left) / rect.width) * totalBeats;
    const clickedBeat = clamp(Math.round(rawBeat / COL_UNIT_BEATS) * COL_UNIT_BEATS, 0, totalBeats - COL_UNIT_BEATS);
    // Clicking anywhere inside an existing note's own span selects its real
    // start, not wherever the pointer happened to land on it.
    const hit = notes.find((n) => n.string === string && clickedBeat >= n.startBeat && clickedBeat < n.startBeat + n.lengthBeats);
    setCursor({ beat: hit ? hit.startBeat : clickedBeat, string });
  };

  const handlePlay = () => {
    auditionLick([...notes].sort((a, b) => a.startBeat - b.startBeat), tempo);
  };

  const handleDownload = () => {
    downloadLick({ id: crypto.randomUUID(), label, beatsPerBar: BEATS_PER_BAR, notes });
  };

  const handleCopy = async () => {
    const json = JSON.stringify({ id: crypto.randomUUID(), label, beatsPerBar: BEATS_PER_BAR, notes }, null, 2);
    await navigator.clipboard.writeText(json);
  };

  const handleImportFile = async (file: File) => {
    try {
      const lick = await parseLickFile(file);
      setLabel(lick.label);
      setBarsCount(Math.max(1, Math.ceil(Math.max(1, ...lick.notes.map((n) => n.startBeat + n.lengthBeats)) / BEATS_PER_BAR)));
      setNotes(lick.notes);
      setImportError(null);
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      if (!isLick(data)) throw new Error("That clipboard content isn't a recognized lick.");
      setLabel(data.label);
      setBarsCount(Math.max(1, Math.ceil(Math.max(1, ...data.notes.map((n) => n.startBeat + n.lengthBeats)) / BEATS_PER_BAR)));
      setNotes(data.notes);
      setImportError(null);
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  return (
    <div className="lick-editor-backdrop" onMouseDown={onClose}>
      <div className="lick-editor-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="lick-editor-header">
          <input
            className="lick-editor-label-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="Lick name"
          />
          <button type="button" className="lick-editor-close" onClick={onClose} aria-label="Close lick editor">
            ×
          </button>
        </div>

        <LickTabView notes={notes} beatsPerBar={BEATS_PER_BAR} totalBars={barsCount} cursorBeat={cursor?.beat ?? null} />

        <div className="lick-editor-toolbar">
          <div className="lick-editor-bars-stepper" role="group" aria-label="Bars">
            <button type="button" onClick={() => setBarsCount((n) => Math.max(1, n - 1))} aria-label="Fewer bars">
              −
            </button>
            <span>{barsCount} bar{barsCount === 1 ? '' : 's'}</span>
            <button type="button" onClick={() => setBarsCount((n) => Math.min(8, n + 1))} aria-label="More bars">
              +
            </button>
          </div>
          <div className="lick-editor-duration-picker" role="group" aria-label="Note duration">
            {DURATION_LABELS.map(({ value, label: durLabel, key }) => (
              <button
                key={key}
                type="button"
                className={duration === value ? 'lick-editor-duration-active' : ''}
                title={`${key} — set current note duration`}
                onClick={() => setDuration(value)}
              >
                {durLabel}
              </button>
            ))}
          </div>
          <button type="button" onClick={handlePlay}>
            ▶ Play Lick
          </button>
        </div>

        <div className="lick-editor-grid" style={{ width: totalBeats * PX_PER_BEAT }}>
          {Array.from({ length: barsCount + 1 }, (_, i) => (
            <div key={i} className="lick-bar-line" style={{ left: i * BEATS_PER_BAR * PX_PER_BEAT }} />
          ))}
          {STRING_LABELS.map((stringLabel, idx) => {
            const stringNum = idx + 1;
            return (
              <div key={stringNum} className="lick-row">
                <span className="lick-row-label">{stringLabel}</span>
                <div className="lick-row-track" onMouseDown={handleRowMouseDown(stringNum)}>
                  {cursor?.string === stringNum && (
                    <div
                      className="lick-cursor"
                      style={{ left: cursor.beat * PX_PER_BEAT, width: duration * PX_PER_BEAT }}
                    />
                  )}
                  {notes
                    .filter((n) => n.string === stringNum)
                    .map((n) => (
                      <div
                        key={`${n.startBeat}-${n.string}`}
                        className="lick-note-block"
                        style={{ left: n.startBeat * PX_PER_BEAT, width: n.lengthBeats * PX_PER_BEAT }}
                      >
                        {n.fret}
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="lick-editor-hint">
          Click a string to move the cursor there. Type a fret number (0–{MAX_FRET}, two digits typed quickly
          compose together) to place or edit a note. ↑/↓ change strings, ←/→ move in time, <kbd>h</kbd>
          <kbd>j</kbd>
          <kbd>k</kbd>
          <kbd>l</kbd>
          <kbd>;</kbd> set duration, Backspace deletes, Escape deselects.
        </p>

        <div className="lick-editor-file-controls">
          <button type="button" onClick={handleDownload}>
            ⬇ Download JSON
          </button>
          <button type="button" onClick={handleCopy}>
            📋 Copy JSON
          </button>
          <button type="button" onClick={handlePaste}>
            📥 Paste JSON
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            📂 Load from file…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />
          {importError && <p className="error">{importError}</p>}
        </div>
      </div>
    </div>
  );
}
