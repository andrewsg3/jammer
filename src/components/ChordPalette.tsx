import { useState } from 'react';
import {
  chordNameParts,
  diatonicOptions,
  diatonicSeventhOptions,
  borrowedOptions,
  secondaryDominantOptions,
  chromaticOptions,
  serializeSelection,
  shiftRootFlat,
  QUALITY_GROUPS,
  QUALITY_LABELS,
  SCALE_LABELS,
} from '../data/progressions';
import type { Chord, ChordOption, ChordQuality, NotationStyle, ScaleName } from '../data/progressions';
import { SCALE_SUGGESTIONS } from '../data/scaleSuggestions';

// Same 12 chromatic roots as the main quality picker's row, for the "/bass" dropdown
// — offsets, not absolute note names, so the picked bass note transposes correctly
// if the song's key changes (see ChordSelection's chromatic.bassOffset).
const BASS_NOTE_OFFSETS = Array.from({ length: 12 }, (_, offset) => offset);

type Props = {
  musicalKey: string;
  scale: ScaleName;
  notationStyle: NotationStyle;
  onAudition: (chord: Chord) => void;
  onAuditionScale: (chord: Chord, scale: ScaleName) => void;
};

function PaletteRow({
  title,
  options,
  notationStyle,
  onAudition,
  headerExtra,
}: {
  title: string;
  options: ChordOption[];
  notationStyle: NotationStyle;
  onAudition: Props['onAudition'];
  headerExtra?: React.ReactNode;
}) {
  // Borrowed/secondary-dominant chords aren't curated for every mode (see
  // BORROWED_CHORDS in progressions.ts) — skip the section entirely rather than
  // showing an empty row with nothing to drag.
  if (options.length === 0) return null;

  return (
    <div className="palette-section">
      <div className="palette-section-header">
        <h2 className="palette-section-title">{title}</h2>
        {headerExtra}
      </div>
      <div className="chord-palette-row">
        {options.map((option, index) => {
          const { root, core, ext, bass } = chordNameParts(option.chord, notationStyle);
          return (
            <button
              key={index}
              type="button"
              className="chord-palette-button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', serializeSelection(option.selection));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => onAudition(option.chord)}
            >
              <span className="roman">{option.label}</span>
              <span className="chord-name">
                {root}
                {core}
                {ext && <sup className="chord-ext">{ext}</sup>}
                {bass}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChromaticSection({
  musicalKey,
  notationStyle,
  onAudition,
}: Pick<Props, 'musicalKey' | 'notationStyle' | 'onAudition'>) {
  const [quality, setQuality] = useState<ChordQuality>('dom7');
  // undefined = no slash bass — every row below is a plain chord, same as before
  // this existed. Applies the same picked bass note to all 12 roots at once
  // (drag whichever root you want with that bass already attached), rather than
  // needing a separate picker per root.
  const [bassOffset, setBassOffset] = useState<number | undefined>(undefined);

  return (
    <PaletteRow
      title="Chromatic"
      options={chromaticOptions(musicalKey, quality, bassOffset)}
      notationStyle={notationStyle}
      onAudition={onAudition}
      headerExtra={
        <>
          <select
            className="quality-select"
            value={quality}
            onChange={(e) => setQuality(e.target.value as ChordQuality)}
            aria-label="Chromatic chord quality"
          >
            {QUALITY_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.qualities.map((q) => (
                  <option key={q} value={q}>
                    {QUALITY_LABELS[q]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select
            className="quality-select"
            value={bassOffset ?? ''}
            onChange={(e) => setBassOffset(e.target.value === '' ? undefined : Number(e.target.value))}
            aria-label="Slash chord bass note"
          >
            <option value="">no /bass</option>
            {BASS_NOTE_OFFSETS.map((offset) => (
              <option key={offset} value={offset}>
                /{shiftRootFlat(musicalKey, offset)}
              </option>
            ))}
          </select>
        </>
      }
    />
  );
}

export function ChordPalette({ musicalKey, scale, notationStyle, onAudition, onAuditionScale }: Props) {
  // Whichever chord was last clicked/dragged — drives the scale-suggestions panel
  // below. Not the same thing as a chord already placed on the grid; this is
  // purely "the last one you were just looking at in the palette."
  const [selectedChord, setSelectedChord] = useState<Chord | null>(null);
  const handleAudition = (chord: Chord) => {
    setSelectedChord(chord);
    onAudition(chord);
  };
  const suggestions = selectedChord ? SCALE_SUGGESTIONS[selectedChord.quality] : [];

  return (
    <div className="chord-palette">
      {selectedChord && (
        <div className="scale-suggestions">
          <span className="scale-suggestions-chord">
            {(() => {
              const { root, core, ext, bass } = chordNameParts(selectedChord, notationStyle);
              return (
                <>
                  {root}
                  {core}
                  {ext && <sup className="chord-ext">{ext}</sup>}
                  {bass}
                </>
              );
            })()}
          </span>
          {suggestions.length > 0 ? (
            suggestions.map((suggestedScale) => (
              <button
                key={suggestedScale}
                type="button"
                className="scale-suggestion-button"
                onClick={() => onAuditionScale(selectedChord, suggestedScale)}
                title={`Audition ${SCALE_LABELS[suggestedScale]} over this chord`}
              >
                {SCALE_LABELS[suggestedScale]}
              </button>
            ))
          ) : (
            <span className="scale-suggestions-none">no clean fit in this app's scales</span>
          )}
        </div>
      )}
      <PaletteRow
        title="Diatonic"
        options={diatonicOptions(musicalKey, scale)}
        notationStyle={notationStyle}
        onAudition={handleAudition}
      />
      <PaletteRow
        title="Diatonic 7ths"
        options={diatonicSeventhOptions(musicalKey, scale)}
        notationStyle={notationStyle}
        onAudition={handleAudition}
      />
      <PaletteRow
        title="Borrowed"
        options={borrowedOptions(musicalKey, scale)}
        notationStyle={notationStyle}
        onAudition={handleAudition}
      />
      <PaletteRow
        title="Secondary Dominants"
        options={secondaryDominantOptions(musicalKey, scale)}
        notationStyle={notationStyle}
        onAudition={handleAudition}
      />
      <ChromaticSection musicalKey={musicalKey} notationStyle={notationStyle} onAudition={handleAudition} />
    </div>
  );
}
