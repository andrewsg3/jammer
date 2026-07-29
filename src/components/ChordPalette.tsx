import {
  chordName,
  diatonicOptions,
  borrowedOptions,
  secondaryDominantOptions,
  serializeSelection,
} from '../data/progressions';
import type { Chord, ChordOption, ScaleName } from '../data/progressions';

type Props = {
  musicalKey: string;
  scale: ScaleName;
  onAudition: (chord: Chord) => void;
};

function PaletteRow({
  title,
  options,
  onAudition,
}: {
  title: string;
  options: ChordOption[];
  onAudition: Props['onAudition'];
}) {
  return (
    <div className="palette-section">
      <h2 className="palette-section-title">{title}</h2>
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
    </div>
  );
}
