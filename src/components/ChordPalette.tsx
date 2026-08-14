import { useEffect, useState } from 'react';
import {
  chordName,
  chordNameParts,
  diatonicOptions,
  diatonicSeventhOptions,
  borrowedOptions,
  secondaryDominantOptions,
  chromaticOptions,
  allChordsOptions,
  serializeSelection,
  shiftRootFlat,
  QUALITY_GROUPS,
  QUALITY_LABELS,
} from '../data/progressions';
import type { Chord, ChordOption, ChordSelection, ChordQuality, NotationStyle, ScaleName } from '../data/progressions';
import { DEGREE_COLORS } from '../data/progressions';
import { EXOTIC_SCALE_GROUPS, scaleDegreeLabels, scaleDegreeNoteNames } from '../data/exoticScales';

// Same 12 chromatic roots as the Chromatic mini-picker's row, for its "/bass" dropdown
// — offsets, not absolute note names, so the picked bass note transposes correctly
// if the song's key changes (see ChordSelection's chromatic.bassOffset).
const BASS_NOTE_OFFSETS = Array.from({ length: 12 }, (_, offset) => offset);

// Absolute root names, independent of the song's own key — "audition any scale
// over any chord" means any chord, not just ones diatonic to whatever key the
// song's currently in.
const ALL_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// j/k/l/; -> new-chord duration, in beats -- Hookpad's own bindings. Home-row,
// right under the fingers, no modifier needed. Order here is display order too.
const DURATION_OPTIONS: { key: string; beats: number }[] = [
  { key: 'j', beats: 1 },
  { key: 'k', beats: 2 },
  { key: 'l', beats: 4 },
  { key: ';', beats: 8 },
];
const DURATION_BEATS_BY_KEY: Record<string, number> = Object.fromEntries(
  DURATION_OPTIONS.map(({ key, beats }) => [key, beats]),
);

// Hookpad-style scale-degree coloring (DEGREE_COLORS, data/progressions.ts):
// 1-7 -> red-orange-yellow-green-blue-indigo-violet, a plain rainbow rather
// than this app's own single accent color, so a chord's degree reads at a
// glance independent of key. Only diatonic/diatonicSeventh selections carry a
// real scale degree -- borrowed, secondary dominant, and chromatic chords
// aren't "the Nth degree of the key" in the same sense, so they stay
// uncolored rather than forcing a fit. Melody notes reuse the same table
// (MelodyGrid.tsx) so a degree reads the same color everywhere in the app.
function degreeColorFor(selection: ChordSelection): string | undefined {
  if (selection.type === 'diatonic' || selection.type === 'diatonicSeventh') {
    return DEGREE_COLORS[selection.degree];
  }
  return undefined;
}

type Props = {
  musicalKey: string;
  scale: ScaleName;
  notationStyle: NotationStyle;
  onAudition: (chord: Chord) => void;
  onAuditionExoticScale: (chord: Chord, scaleRoot: string, intervals: number[]) => void;
  // Arms this chord as the "pending" chord for EditGrid's click-to-place flow --
  // clicking a palette chord no longer appends it anywhere itself; App.tsx stores
  // it as pendingChord, and EditGrid.tsx's ChordRow places it wherever an empty
  // cell is next clicked (repeatable -- stays armed after placing, matching
  // Hookpad's own "stamp" behavior). Drag-and-drop from the palette is untouched.
  onSelectionChange: (selection: ChordSelection, lengthBeats: number) => void;
};

/** One chord button, shared by the top row and the Chord Finder picker's lists --
 * clicking it both auditions the chord (existing behavior) and appends it to the
 * grid at whatever duration is currently selected; dragging it still places it at
 * a specific position, exactly as before. */
function ChordButton({
  option,
  notationStyle,
  onSelect,
}: {
  option: ChordOption;
  notationStyle: NotationStyle;
  onSelect: (option: ChordOption) => void;
}) {
  const { root, core, ext, bass } = chordNameParts(option.chord, notationStyle);
  const degreeColor = degreeColorFor(option.selection);
  return (
    <button
      type="button"
      className={`chord-palette-button${degreeColor ? ' chord-palette-button-degree' : ''}`}
      style={degreeColor ? { borderTopColor: degreeColor } : undefined}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', serializeSelection(option.selection));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onSelect(option)}
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
}

function ChordButtonRow({
  options,
  notationStyle,
  onSelect,
}: {
  options: ChordOption[];
  notationStyle: NotationStyle;
  onSelect: (option: ChordOption) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="chord-palette-row">
      {options.map((option, index) => (
        <ChordButton key={index} option={option} notationStyle={notationStyle} onSelect={onSelect} />
      ))}
    </div>
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
  const degreeLabels = scaleDegreeLabels(scale.intervals);
  const degreeNoteNames = scaleDegreeNoteNames(scaleRoot, scale.intervals);

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
          <div className="exotic-scale-degrees">
            <div className="exotic-scale-degrees-row" aria-label={`Scale degrees: ${degreeLabels.join(', ')}`}>
              {degreeLabels.join('-')}
            </div>
            <div className="exotic-scale-degrees-row" aria-label={`Notes: ${degreeNoteNames.join(', ')}`}>
              {degreeNoteNames.join('-')}
            </div>
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

function optionMatchesQuery(option: ChordOption, query: string, notationStyle: NotationStyle): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = chordName(option.chord, notationStyle).toLowerCase();
  const label = option.label.toLowerCase();
  const qualityLabel = QUALITY_LABELS[option.chord.quality]?.toLowerCase() ?? '';
  return name.includes(q) || label.includes(q) || qualityLabel.includes(q);
}

/** Everything that used to be four permanent sidebar rows (Diatonic 7ths,
 * Borrowed, Secondary Dominants, Chromatic) plus a genuinely new "every chord"
 * browse/search, all folded into one on-demand picker instead of always-visible
 * screen space. The three curated lists keep their existing generator functions
 * and roman-numeral/interval labels verbatim — only their location changed. The
 * Chromatic mini-picker (quality + optional /bass, all 12 roots) is preserved
 * as-is too, above the search — search alone doesn't cover "build me a slash
 * chord," so this stays the dedicated way to do that. */
function ChordFinderModal({
  musicalKey,
  scale,
  notationStyle,
  onSelect,
  onClose,
}: {
  musicalKey: string;
  scale: ScaleName;
  notationStyle: NotationStyle;
  onSelect: (option: ChordOption) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [chromaticQuality, setChromaticQuality] = useState<ChordQuality>('dom7');
  const [bassOffset, setBassOffset] = useState<number | undefined>(undefined);

  const groups: { label: string; options: ChordOption[] }[] = [
    { label: 'Diatonic 7ths', options: diatonicSeventhOptions(musicalKey, scale) },
    { label: 'Borrowed', options: borrowedOptions(musicalKey, scale) },
    { label: 'Secondary Dominants', options: secondaryDominantOptions(musicalKey, scale) },
    ...allChordsOptions(musicalKey, scale),
  ]
    .map((group) => ({
      label: group.label,
      options: group.options.filter((o) => optionMatchesQuery(o, query, notationStyle)),
    }))
    .filter((group) => group.options.length > 0);

  return (
    <div className="chord-finder-backdrop" role="dialog" aria-modal="true" aria-label="Chord Finder" onClick={onClose}>
      <div className="chord-finder-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chord-finder-header">
          <h2>🔍 Chord Finder</h2>
          <button type="button" className="chord-finder-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="chord-finder-chromatic">
          <span className="chord-finder-chromatic-label">Chromatic</span>
          <select
            className="quality-select"
            value={chromaticQuality}
            onChange={(e) => setChromaticQuality(e.target.value as ChordQuality)}
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
          <ChordButtonRow
            options={chromaticOptions(musicalKey, scale, chromaticQuality, bassOffset)}
            notationStyle={notationStyle}
            onSelect={onSelect}
          />
        </div>

        <input
          type="text"
          className="chord-finder-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chords — e.g. “bVII”, “Bb”, “diminished”…"
          aria-label="Search chords"
          autoFocus
        />

        <div className="chord-finder-groups">
          {groups.length === 0 ? (
            <p className="chord-finder-empty">No chords match "{query}".</p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="chord-finder-group">
                <h3 className="chord-finder-group-title">{group.label}</h3>
                <ChordButtonRow options={group.options} notationStyle={notationStyle} onSelect={onSelect} />
              </div>
            ))
          )}
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
  onAuditionExoticScale,
  onSelectionChange,
}: Props) {
  // Whichever chord was last clicked/dragged — seeds the Audition-any-scale
  // modal's initial chord. Not the same thing as a chord already placed on the
  // grid; this is purely "the last one you were just looking at in the palette."
  const [selectedChord, setSelectedChord] = useState<Chord | null>(null);
  const [exoticModalOpen, setExoticModalOpen] = useState(false);
  const [chordFinderOpen, setChordFinderOpen] = useState(false);
  // What length a click-to-add chord gets — j/k/l/; below, defaulting to a full
  // bar (4 beats), the same length new chords implicitly got before this existed.
  const [selectedDuration, setSelectedDuration] = useState(4);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      // j/k/l/; are also EditGrid.tsx's own melody-duration keys (h/j/k/l/;),
      // live only once a melody cell is activated (see its own doc comment on
      // the flag below) -- yield to that rather than also changing chord
      // duration on the same keypress.
      if (document.body.dataset.melodyCursorActive === 'true') return;
      const beats = DURATION_BEATS_BY_KEY[e.key.toLowerCase()];
      if (beats === undefined) return;
      e.preventDefault();
      setSelectedDuration(beats);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Shared by the top row and the Chord Finder picker: audition it (existing
  // behavior) and arm it as the pending chord at the currently-selected duration
  // -- EditGrid places it wherever an empty cell is clicked next.
  const handleSelect = (option: ChordOption) => {
    setSelectedChord(option.chord);
    onAudition(option.chord);
    onSelectionChange(option.selection, selectedDuration);
  };

  const handleChordFinderSelect = (option: ChordOption) => {
    handleSelect(option);
    setChordFinderOpen(false);
  };

  return (
    <div className="chord-palette">
      <div className="chord-palette-toolbar">
        <ChordButtonRow options={diatonicOptions(musicalKey, scale)} notationStyle={notationStyle} onSelect={handleSelect} />
        <button type="button" className="chord-finder-open-button" onClick={() => setChordFinderOpen(true)}>
          🔍 Chord Finder
        </button>
        <div className="chord-duration-picker" role="radiogroup" aria-label="New chord duration">
          {DURATION_OPTIONS.map(({ key, beats }) => (
            <button
              key={key}
              type="button"
              className={`chord-duration-button${selectedDuration === beats ? ' chord-duration-button-active' : ''}`}
              onClick={() => setSelectedDuration(beats)}
              title={`${beats} beat${beats === 1 ? '' : 's'} (${key})`}
              aria-pressed={selectedDuration === beats}
            >
              {beats}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="exotic-scale-open-button"
          onClick={() => setExoticModalOpen(true)}
          title="Audition any scale, including exotic ones, over any chord"
        >
          🎵 Audition any scale…
        </button>
      </div>

      {chordFinderOpen && (
        <ChordFinderModal
          musicalKey={musicalKey}
          scale={scale}
          notationStyle={notationStyle}
          onSelect={handleChordFinderSelect}
          onClose={() => setChordFinderOpen(false)}
        />
      )}

      {exoticModalOpen && (
        <ExoticScaleModal
          initialChord={selectedChord ?? { root: 'C', quality: 'maj7' }}
          notationStyle={notationStyle}
          onAuditionExoticScale={onAuditionExoticScale}
          onClose={() => setExoticModalOpen(false)}
        />
      )}
    </div>
  );
}
