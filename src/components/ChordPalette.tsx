import { useState } from 'react';
import {
  chordNameParts,
  diatonicOptions,
  diatonicSeventhOptions,
  borrowedOptions,
  secondaryDominantOptions,
  chromaticOptions,
  serializeSelection,
  QUALITY_GROUPS,
  QUALITY_LABELS,
} from '../data/progressions';
import type { Chord, ChordOption, ChordQuality, NotationStyle, ScaleName } from '../data/progressions';

type Props = {
  musicalKey: string;
  scale: ScaleName;
  notationStyle: NotationStyle;
  onAudition: (chord: Chord) => void;
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
          const { root, core, ext } = chordNameParts(option.chord, notationStyle);
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
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChromaticSection({ musicalKey, notationStyle, onAudition }: Props) {
  const [quality, setQuality] = useState<ChordQuality>('dom7');

  return (
    <PaletteRow
      title="Chromatic"
      options={chromaticOptions(musicalKey, quality)}
      notationStyle={notationStyle}
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

export function ChordPalette({ musicalKey, scale, notationStyle, onAudition }: Props) {
  return (
    <div className="chord-palette">
      <PaletteRow
        title="Diatonic"
        options={diatonicOptions(musicalKey, scale)}
        notationStyle={notationStyle}
        onAudition={onAudition}
      />
      <PaletteRow
        title="Diatonic 7ths"
        options={diatonicSeventhOptions(musicalKey, scale)}
        notationStyle={notationStyle}
        onAudition={onAudition}
      />
      <PaletteRow
        title="Borrowed"
        options={borrowedOptions(musicalKey, scale)}
        notationStyle={notationStyle}
        onAudition={onAudition}
      />
      <PaletteRow
        title="Secondary Dominants"
        options={secondaryDominantOptions(musicalKey, scale)}
        notationStyle={notationStyle}
        onAudition={onAudition}
      />
      <ChromaticSection musicalKey={musicalKey} scale={scale} notationStyle={notationStyle} onAudition={onAudition} />
    </div>
  );
}
