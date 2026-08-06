import { useState } from 'react';
import {
  chordName,
  diatonicOptions,
  borrowedOptions,
  secondaryDominantOptions,
  chromaticOptions,
  serializeSelection,
  QUALITY_GROUPS,
  QUALITY_LABELS,
} from '../data/progressions';
import type { Chord, ChordOption, ChordQuality, ScaleName } from '../data/progressions';

type Props = {
  musicalKey: string;
  scale: ScaleName;
  onAudition: (chord: Chord) => void;
};

function PaletteRow({
  title,
  options,
  onAudition,
  headerExtra,
}: {
  title: string;
  options: ChordOption[];
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
        {options.map((option, index) => (
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
            <span className="chord-name">{chordName(option.chord)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChromaticSection({ musicalKey, onAudition }: Props) {
  const [quality, setQuality] = useState<ChordQuality>('dom7');

  return (
    <PaletteRow
      title="Chromatic"
      options={chromaticOptions(musicalKey, quality)}
      onAudition={onAudition}
      headerExtra={
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
      }
    />
  );
}

export function ChordPalette({ musicalKey, scale, onAudition }: Props) {
  return (
    <div className="chord-palette">
      <PaletteRow title="Diatonic" options={diatonicOptions(musicalKey, scale)} onAudition={onAudition} />
      <PaletteRow title="Borrowed" options={borrowedOptions(musicalKey, scale)} onAudition={onAudition} />
      <PaletteRow
        title="Secondary Dominants"
        options={secondaryDominantOptions(musicalKey, scale)}
        onAudition={onAudition}
      />
      <ChromaticSection musicalKey={musicalKey} scale={scale} onAudition={onAudition} />
    </div>
  );
}
