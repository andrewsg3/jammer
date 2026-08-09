import { useState } from 'react';
import {
  chordName,
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
import { EXOTIC_SCALE_GROUPS } from '../data/exoticScales';

// Same 12 chromatic roots as the main quality picker's row, for the "/bass" dropdown
// — offsets, not absolute note names, so the picked bass note transposes correctly
// if the song's key changes (see ChordSelection's chromatic.bassOffset).
const BASS_NOTE_OFFSETS = Array.from({ length: 12 }, (_, offset) => offset);

// Absolute root names, independent of the song's own key — "audition any scale
// over any chord" means any chord, not just ones diatonic to whatever key the
// song's currently in.
const ALL_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

type Props = {
  musicalKey: string;
  scale: ScaleName;
  notationStyle: NotationStyle;
  onAudition: (chord: Chord) => void;
  onAuditionScale: (chord: Chord, scale: ScaleName) => void;
  onAuditionExoticScale: (chord: Chord, scaleRoot: string, intervals: number[]) => void;
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

const ALL_EXOTIC_SCALES = EXOTIC_SCALE_GROUPS.flatMap((g) => g.scales);

/** "Audition any scale, including exotic ones, over any chord" — a free-form
 * companion to the scale-suggestions panel above, which only offers this app's
 * own curated per-quality picks. Root/quality here default to whatever chord was
 * selected in the palette, but aren't tied to it — both are freely changeable,
 * so this covers a chord that was never clicked in the palette at all. Two
 * sections (Chord, Scale) rather than one long form — picking a chord and
 * picking a scale are separate decisions, and the scale list alone (19 options
 * across 5 groups) is enough to want its own clearly labeled block. */
function ExoticScaleModal({
  initialChord,
  notationStyle,
  onAuditionExoticScale,
  onClose,
}: {
  initialChord: Chord;
  notationStyle: NotationStyle;
  onAuditionExoticScale: Props['onAuditionExoticScale'];
  onClose: () => void;
}) {
  const [root, setRoot] = useState(initialChord.root);
  const [quality, setQuality] = useState<ChordQuality>(initialChord.quality);
  // Defaults to the chord's own root (the common case — "what scale fits this
  // chord") but is independently changeable, for the uncommon-but-real case of
  // wanting a *different*-rooted scale over a chord, e.g. "E minor over Cmaj7."
  const [scaleRoot, setScaleRoot] = useState(initialChord.root);
  const [scaleName, setScaleName] = useState(ALL_EXOTIC_SCALES[0].name);
  const chord: Chord = { root, quality };
  const scale = ALL_EXOTIC_SCALES.find((s) => s.name === scaleName) ?? ALL_EXOTIC_SCALES[0];

  return (
    <div className="exotic-scale-backdrop" role="dialog" aria-modal="true" aria-label="Audition any scale" onClick={onClose}>
      <div className="exotic-scale-modal" onClick={(e) => e.stopPropagation()}>
        <div className="exotic-scale-header">
          <h2>Audition any scale</h2>
          <button type="button" className="exotic-scale-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="exotic-scale-section">
          <h3 className="exotic-scale-section-title">Chord</h3>
          <div className="exotic-scale-chord-picker">
            <select value={root} onChange={(e) => setRoot(e.target.value)} aria-label="Chord root">
              {ALL_ROOTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              className="quality-select"
              value={quality}
              onChange={(e) => setQuality(e.target.value as ChordQuality)}
              aria-label="Chord quality"
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
            <span className="exotic-scale-chord-name">{chordName(chord, notationStyle)}</span>
          </div>
        </div>

        <div className="exotic-scale-section">
          <h3 className="exotic-scale-section-title">Scale</h3>
          <div className="exotic-scale-scale-picker">
            <select value={scaleRoot} onChange={(e) => setScaleRoot(e.target.value)} aria-label="Scale root">
              {ALL_ROOTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              className="exotic-scale-select"
              value={scaleName}
              onChange={(e) => setScaleName(e.target.value)}
              aria-label="Scale"
            >
              {EXOTIC_SCALE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.scales.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="exotic-scale-audition-button"
            onClick={() => onAuditionExoticScale(chord, scaleRoot, scale.intervals)}
          >
            ▶ Audition {scaleRoot} {scale.name} over {chordName(chord, notationStyle)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChordPalette({
  musicalKey,
  scale,
  notationStyle,
  onAudition,
  onAuditionScale,
  onAuditionExoticScale,
}: Props) {
  // Whichever chord was last clicked/dragged — drives the scale-suggestions panel
  // below. Not the same thing as a chord already placed on the grid; this is
  // purely "the last one you were just looking at in the palette."
  const [selectedChord, setSelectedChord] = useState<Chord | null>(null);
  const [exoticModalOpen, setExoticModalOpen] = useState(false);
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
      <button
        type="button"
        className="exotic-scale-open-button"
        onClick={() => setExoticModalOpen(true)}
        title="Audition any scale, including exotic ones, over any chord"
      >
        🎵 Audition any scale…
      </button>
      {exoticModalOpen && (
        <ExoticScaleModal
          initialChord={selectedChord ?? { root: 'C', quality: 'maj7' }}
          notationStyle={notationStyle}
          onAuditionExoticScale={onAuditionExoticScale}
          onClose={() => setExoticModalOpen(false)}
        />
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
