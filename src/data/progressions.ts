export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dom7'
  | 'maj7'
  | 'min7'
  | 'minMaj7'
  | 'dim'
  | 'dim7'
  | 'm7b5'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | '6'
  | 'm6'
  | 'add9'
  | 'dom9'
  | 'maj9'
  | 'm9'
  | 'dom7sharp9'
  | 'dom7flat9'
  | 'dom7sharp5'
  | 'dom7flat5'
  | 'dom13'
  | 'm11'
  | 'maj13'
  | 'dom7sharp11'
  | 'dom7flat9flat5'
  | 'maj7sharp11';

export type Chord = {
  root: string;
  quality: ChordQuality;
  // Optional slash-chord bass note (absolute note name, no octave) — e.g. "D7/F#"
  // is { root: 'D', quality: 'dom7', bass: 'F#' }. Chord *tones* (3rd/5th/etc.)
  // still derive from root/quality as usual (see chordTones/QUALITY_INTERVALS) —
  // only the note a bass line (or a comping left hand) treats as "the root" for
  // playback changes; see bassRootNote below.
  bass?: string;
};

export type Progression = Chord[];

// 'minor' = natural minor (aeolian) — kept as its historical name rather than
// renaming to 'aeolian', so existing song preset JSON files stay valid.
export type ScaleName = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian';
export type ScaleDegree = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const SCALE_NAMES: ScaleName[] = [
  'major',
  'minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
];

export const SCALE_LABELS: Record<ScaleName, string> = {
  major: 'Major',
  minor: 'Minor',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  locrian: 'Locrian',
};

// Hookpad-style scale-degree rainbow: 1-7 -> red-orange-yellow-green-blue-
// indigo-violet, independent of the app's own single accent color, so a
// scale degree reads the same color everywhere it's shown -- diatonic chord
// buttons (ChordPalette.tsx), diatonic melody notes (MelodyGrid.tsx), and
// placed chord blocks (ChordRow.tsx) alike. Bright, fully-saturated primary/
// secondary tones (iOS's own system-color values, chosen for exactly this:
// vivid but still legible with dark text on top) rather than the earlier
// softer/muted shades.
export const DEGREE_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5856d6', '#af52de'];

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

const SEMITONE_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Flat spelling — used for borrowed chords (bIII/bVI/bVII), which are conventionally
// named with flats even though the pitch is identical to the sharp spelling.
const SEMITONE_TO_NOTE_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Intervals beyond 11 semitones (9ths etc.) are deliberately left un-mod'd — chordTones()
// resolves them to the correct higher octave rather than collapsing them into the triad.
const QUALITY_INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  minMaj7: [0, 3, 7, 11], // minor triad + major 7th — e.g. Dm(maj7)
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
  dom9: [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  dom7sharp9: [0, 4, 7, 10, 15], // "Hendrix chord" — e.g. E7#9
  dom7flat9: [0, 4, 7, 10, 13],
  dom7sharp5: [0, 4, 8, 10],
  dom7flat5: [0, 4, 6, 10], // altered dominant, natural 5th replaced by b5 — e.g. G7b5
  dom13: [0, 4, 7, 10, 14, 21],
  m11: [0, 3, 7, 10, 14, 17],
  maj13: [0, 4, 7, 11, 14, 21],
  dom7sharp11: [0, 4, 7, 10, 18], // e.g. F7#11 — the "Girl from Ipanema" bridge chord (Lydian dominant)
  dom7flat9flat5: [0, 4, 6, 10, 13], // altered dominant — common resolving into a minor ii-V-i
  maj7sharp11: [0, 4, 7, 11, 18], // Lydian major 7th — e.g. Cmaj7#11
};

export type NotationStyle = 'symbol' | 'written';

// A quality's symbol suffix split the way real-book engravings actually set it:
// "core" is the triad-quality marker (-, °, +, △ for major, or blank for a plain
// major/dominant root) at full size right next to the root; "ext" is everything
// after it (7ths/9ths/alterations) set smaller and raised, like a real superscript
// figured-bass-style extension. "△" is U+25B3 (White Up-Pointing Triangle), not
// the Greek letter "Δ" (U+0394) — checked both against Architects Daughter (the
// chord-symbol font) by rendering them at size and comparing stroke weight to
// known-good glyphs from this same table: "Δ" comes out visibly bolder than its
// neighbors (a dead giveaway — this font has no bold weight at all — so it's
// silently falling back to a different font mid-label), while "△" matches the
// surrounding stroke weight and is actually this font's own glyph. Not "ø" either
// — same fallback problem, no thin/bold tell available to find an alternate
// codepoint for it, so "-7b5" mirrors how hand-copied books write half-diminished
// when they don't have the ø glyph available either — same "-" this table
// already uses for minor, not a separate convention.
export type ChordSuffixParts = { core: string; ext: string };
const QUALITY_SUFFIX_SYMBOL_PARTS: Record<ChordQuality, ChordSuffixParts> = {
  maj: { core: '', ext: '' },
  min: { core: '-', ext: '' },
  dom7: { core: '', ext: '7' },
  // "△" isn't a triad-quality marker like -/°/+ (it doesn't make the chord any
  // less major, the way "-" does) — it's really just a fancier "7", so it
  // belongs in the superscript ext with the digit, not full-size in core.
  maj7: { core: '', ext: '△7' },
  min7: { core: '-', ext: '7' },
  // Real-book convention: the minor dash plus the same △7 used for a plain
  // major 7th — "-△7", not a separate glyph of its own.
  minMaj7: { core: '-', ext: '△7' },
  dim: { core: '°', ext: '' },
  dim7: { core: '°', ext: '7' },
  m7b5: { core: '-', ext: '7b5' },
  aug: { core: '+', ext: '' },
  sus2: { core: '', ext: 'sus2' },
  sus4: { core: '', ext: 'sus4' },
  '6': { core: '', ext: '6' },
  m6: { core: '-', ext: '6' },
  add9: { core: '', ext: 'add9' },
  dom9: { core: '', ext: '9' },
  maj9: { core: '', ext: '△9' },
  m9: { core: '-', ext: '9' },
  dom7sharp9: { core: '', ext: '7#9' },
  dom7flat9: { core: '', ext: '7b9' },
  dom7sharp5: { core: '', ext: '7#5' },
  dom7flat5: { core: '', ext: '7b5' },
  dom13: { core: '', ext: '13' },
  m11: { core: '-', ext: '11' },
  maj13: { core: '', ext: '△13' },
  dom7sharp11: { core: '', ext: '7#11' },
  dom7flat9flat5: { core: '', ext: '7b9b5' },
  maj7sharp11: { core: '', ext: '△7#11' },
};

// Plain-English suffixes — spelled out (m, maj7, dim, m7b5) rather than
// engraving shorthand, for anyone who'd rather read chords than decode symbols.
const QUALITY_SUFFIX_WRITTEN: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dom7: '7',
  maj7: 'maj7',
  min7: 'm7',
  minMaj7: 'm(maj7)',
  dim: 'dim',
  dim7: 'dim7',
  m7b5: 'm7b5',
  aug: 'aug',
  sus2: 'sus2',
  sus4: 'sus4',
  '6': '6',
  m6: 'm6',
  add9: 'add9',
  dom9: '9',
  maj9: 'maj9',
  m9: 'm9',
  dom7sharp9: '7#9',
  dom7flat9: '7b9',
  dom7sharp5: '7#5',
  dom7flat5: '7b5',
  dom13: '13',
  m11: 'm11',
  maj13: 'maj13',
  dom7sharp11: '7#11',
  dom7flat9flat5: '7b9b5',
  maj7sharp11: 'maj7#11',
};

export const QUALITY_GROUPS: { label: string; qualities: ChordQuality[] }[] = [
  { label: 'Triads', qualities: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'] },
  { label: 'Sixths', qualities: ['6', 'm6'] },
  { label: 'Sevenths', qualities: ['dom7', 'maj7', 'min7', 'minMaj7', 'dim7', 'm7b5'] },
  { label: 'Extensions', qualities: ['add9', 'dom9', 'maj9', 'm9'] },
  {
    label: 'Altered / Exotic',
    qualities: [
      'dom7sharp9',
      'dom7flat9',
      'dom7sharp5',
      'dom7flat5',
      'dom13',
      'm11',
      'maj13',
      'dom7sharp11',
      'dom7flat9flat5',
      'maj7sharp11',
    ],
  },
];

export const QUALITY_LABELS: Record<ChordQuality, string> = {
  maj: 'Major',
  min: 'Minor',
  dom7: 'Dominant 7',
  maj7: 'Major 7',
  min7: 'Minor 7',
  minMaj7: 'Minor-Major 7',
  dim: 'Diminished',
  dim7: 'Diminished 7',
  m7b5: 'Half-Diminished (m7♭5)',
  aug: 'Augmented',
  sus2: 'Sus2',
  sus4: 'Sus4',
  '6': 'Major 6',
  m6: 'Minor 6',
  add9: 'Add 9',
  dom9: 'Dominant 9',
  maj9: 'Major 9',
  m9: 'Minor 9',
  dom7sharp9: 'Dominant 7♯9 (Hendrix)',
  dom7flat9: 'Dominant 7♭9',
  dom7sharp5: 'Dominant 7♯5',
  dom7flat5: 'Dominant 7♭5',
  dom13: 'Dominant 13',
  m11: 'Minor 11',
  maj13: 'Major 13',
  dom7sharp11: 'Dominant 7♯11 (Lydian Dominant)',
  dom7flat9flat5: 'Dominant 7♭9♭5 (Altered)',
  maj7sharp11: 'Major 7♯11 (Lydian)',
};

// Every ChordQuality's own key, for validating a song-preset's chromatic-selection
// quality string at load time — see isChordSelection in songPresets.ts. Derived
// from QUALITY_LABELS (rather than hand-duplicated) so it can't silently drift out
// of sync with the actual ChordQuality union as new qualities get added.
export const CHORD_QUALITIES = Object.keys(QUALITY_LABELS) as ChordQuality[];

// Each mode is the major scale rotated to start on a different degree — e.g. dorian
// is "the white keys starting on D." Intervals below are that rotation worked out
// from the tonic, and DEGREE_QUALITIES/ROMAN_NUMERALS follow from stacking thirds
// within each mode's own scale (not compared against major/minor).
export const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor (aeolian)
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

// How many semitones above a mode's own tonic its "parent major" (the major scale
// it's a rotation of — see the SCALE_INTERVALS comment above) starts. Lets any
// mode borrow the standard major-key-signature table below rather than needing
// its own: e.g. D dorian's parent major is C (2 semitones below D).
const MODE_OFFSET_FROM_PARENT_MAJOR: Record<ScaleName, number> = {
  major: 0,
  dorian: 2,
  phrygian: 4,
  lydian: 5,
  mixolydian: 7,
  minor: 9,
  locrian: 11,
};

// Standard treble-clef key signature for each major-scale tonic, indexed by
// semitone (0=C, 1=C#/Db, ...). The tritone (6) is a genuine enharmonic tie —
// F# and Gb both take 6 accidentals — F# is picked arbitrarily.
const MAJOR_KEY_SIGNATURE: { sign: 'sharp' | 'flat'; count: number }[] = [
  { sign: 'sharp', count: 0 }, // C
  { sign: 'flat', count: 5 }, // Db
  { sign: 'sharp', count: 2 }, // D
  { sign: 'flat', count: 3 }, // Eb
  { sign: 'sharp', count: 4 }, // E
  { sign: 'flat', count: 1 }, // F
  { sign: 'sharp', count: 6 }, // F#
  { sign: 'sharp', count: 1 }, // G
  { sign: 'flat', count: 4 }, // Ab
  { sign: 'sharp', count: 3 }, // A
  { sign: 'flat', count: 2 }, // Bb
  { sign: 'sharp', count: 5 }, // B
];

// Standard engraving order — each accidental is added in this sequence as a key
// picks up more sharps/flats.
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** The key signature (sharps or flats, in standard order) for a key + mode. */
export function keySignatureAccidentals(
  key: string,
  scale: ScaleName,
): { sign: 'sharp' | 'flat'; letters: string[] } {
  const rootSemitone = NOTE_TO_SEMITONE[key] ?? 0;
  const parentMajorSemitone = (((rootSemitone - MODE_OFFSET_FROM_PARENT_MAJOR[scale]) % 12) + 12) % 12;
  let { sign, count } = MAJOR_KEY_SIGNATURE[parentMajorSemitone];
  // MAJOR_KEY_SIGNATURE's tritone entry (F#/Gb, semitone 6) picks sharp
  // unconditionally -- a real tie, since both spellings take 6 accidentals.
  // But rootSemitone already erased which spelling the *original* key was
  // given in (NOTE_TO_SEMITONE maps "Eb" and "D#" to the same 3) -- without
  // breaking the tie some other way, a flat-spelled minor key whose parent
  // major happens to land on the tritone (e.g. Eb minor -> Gb major) would
  // silently flip to sharps mid-calculation. Break it using the original
  // key string's own spelling instead: a key literally written with a "b"
  // stays flat through to its parent major too, matching how a real chart
  // in that key is actually written.
  if (parentMajorSemitone === 6 && key.includes('b')) sign = 'flat';
  const order = sign === 'sharp' ? SHARP_ORDER : FLAT_ORDER;
  return { sign, letters: order.slice(0, count) };
}

const DEGREE_QUALITIES: Record<ScaleName, ChordQuality[]> = {
  major: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
  minor: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
  dorian: ['min', 'min', 'maj', 'maj', 'min', 'dim', 'maj'],
  phrygian: ['min', 'maj', 'maj', 'min', 'dim', 'maj', 'min'],
  lydian: ['maj', 'maj', 'min', 'dim', 'maj', 'min', 'min'],
  mixolydian: ['maj', 'min', 'dim', 'maj', 'min', 'min', 'maj'],
  locrian: ['dim', 'maj', 'min', 'min', 'maj', 'maj', 'min'],
};

const ROMAN_NUMERALS: Record<ScaleName, string[]> = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
  dorian: ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII'],
  phrygian: ['i', 'II', 'III', 'iv', 'v°', 'VI', 'vii'],
  lydian: ['I', 'II', 'iii', 'iv°', 'V', 'vi', 'vii'],
  mixolydian: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII'],
  locrian: ['i°', 'II', 'iii', 'iv', 'V', 'VI', 'vii'],
};

// Same idea as DEGREE_QUALITIES, but stacking four scale-thirds (root/3rd/5th/7th)
// instead of three. Every mode here is a rotation of the plain major scale, so only
// maj7/dom7/min7/m7b5 ever come up — dim7 and augmented-7th chords only arise from
// harmonic/melodic minor, which isn't one of these seven modes.
const DEGREE_SEVENTH_QUALITIES: Record<ScaleName, ChordQuality[]> = {
  major: ['maj7', 'min7', 'min7', 'maj7', 'dom7', 'min7', 'm7b5'],
  minor: ['min7', 'm7b5', 'maj7', 'min7', 'min7', 'maj7', 'dom7'],
  dorian: ['min7', 'min7', 'maj7', 'dom7', 'min7', 'm7b5', 'maj7'],
  phrygian: ['min7', 'maj7', 'dom7', 'min7', 'm7b5', 'maj7', 'min7'],
  lydian: ['maj7', 'dom7', 'min7', 'm7b5', 'maj7', 'min7', 'min7'],
  mixolydian: ['dom7', 'min7', 'm7b5', 'maj7', 'min7', 'min7', 'maj7'],
  locrian: ['m7b5', 'maj7', 'min7', 'min7', 'maj7', 'maj7', 'min7'],
};

export function rootSemitone(root: string): number {
  const semitone = NOTE_TO_SEMITONE[root];
  if (semitone === undefined) throw new Error(`Unknown note: "${root}"`);
  return semitone;
}

/** Returns the chord's tones (root, third, fifth, ...) as note names at the given octave. */
export function chordTones(chord: Chord, baseOctave: number): string[] {
  const root = rootSemitone(chord.root);
  return QUALITY_INTERVALS[chord.quality].map((interval) => {
    const absolute = root + interval;
    const octaveOffset = Math.floor(absolute / 12);
    const pitchClass = ((absolute % 12) + 12) % 12;
    return `${SEMITONE_TO_NOTE[pitchClass]}${baseOctave + octaveOffset}`;
  });
}

/** The scale's own 7 notes (root up to, not including, the octave) as note names at
 * the given octave, rooted at the given note — e.g. scaleTones('G', 'mixolydian', 4)
 * for "G Mixolydian," the chord-scale suggested for a G7. Deliberately independent
 * of the song's own key/scale — a chord-scale pairing is always rooted on the
 * chord's own root, not wherever the song happens to be. */
export function scaleTones(root: string, scale: ScaleName, baseOctave: number): string[] {
  return notesFromIntervals(root, SCALE_INTERVALS[scale], baseOctave);
}

/** Note names (at the given octave) for an arbitrary set of semitone intervals
 * from a root — the shared machinery behind scaleTones above, generalized so
 * scales outside this app's own ScaleName vocabulary (whole-tone, diminished,
 * altered, ... — see data/exoticScales.ts) can be voiced the same way without
 * needing to exist as a real ScaleName themselves (that type is tied to key
 * signatures/diatonic chord-building elsewhere; these aren't). */
export function notesFromIntervals(root: string, intervals: number[], baseOctave: number): string[] {
  const rootSt = rootSemitone(root);
  return intervals.map((interval) => {
    const absolute = rootSt + interval;
    const octaveOffset = Math.floor(absolute / 12);
    const pitchClass = ((absolute % 12) + 12) % 12;
    return `${SEMITONE_TO_NOTE[pitchClass]}${baseOctave + octaveOffset}`;
  });
}

/** e.g. "D-", "G7", "B°" (symbol style) or "Dm", "G7", "Bdim" (written style). A
 * slash chord appends "/<bass>" at full size, same in both notation styles — real
 * books never shrink or superscript the bass note. */
export function chordName(chord: Chord, notation: NotationStyle = 'symbol'): string {
  const bass = chord.bass ? `/${chord.bass}` : '';
  if (notation === 'written') return `${chord.root}${QUALITY_SUFFIX_WRITTEN[chord.quality]}${bass}`;
  const { core, ext } = QUALITY_SUFFIX_SYMBOL_PARTS[chord.quality];
  return `${chord.root}${core}${ext}${bass}`;
}

/**
 * Same as chordName, but split for real-book-style rendering: "core" (the -/°/+/^
 * triad-quality marker) at full size right after the root, "ext" (7ths/9ths/
 * alterations) meant to be set smaller and raised, "bass" (the optional slash
 * note, already including its own leading "/") at full size after everything
 * else. 'written' notation has no core/ext split — plain-English suffixes ("m7",
 * "dim7") read as one run, not a superscript — but still gets the slash bass.
 */
export function chordNameParts(
  chord: Chord,
  notation: NotationStyle = 'symbol',
): ChordSuffixParts & { root: string; bass: string } {
  const bass = chord.bass ? `/${chord.bass}` : '';
  if (notation === 'written') return { root: chord.root, core: QUALITY_SUFFIX_WRITTEN[chord.quality], ext: '', bass };
  return { root: chord.root, ...QUALITY_SUFFIX_SYMBOL_PARTS[chord.quality], bass };
}

/** The note (no octave) a bass line / comping left hand should treat as this
 * chord's root — the slash bass note for a slash chord, else the chord's own
 * root. Third/fifth/etc. always derive from the real root/quality regardless. */
export function bassRootNote(chord: Chord): string {
  return chord.bass ?? chord.root;
}

/** The diatonic chord built on a given scale degree of a key. */
// Sharp in a sharp key, flat in a flat key -- same reasoning/fix as chromaticChord
// below: a diatonic chord's root should read consistently with the staff's own
// key signature (e.g. Bb/Eb in G minor's two flats, not A#/D#), not default to
// sharp regardless of key. shiftRoot/shiftRootFlat both compute the identical
// semitone shift, just spelling the result from a different table.
export function shiftRootForKey(key: string, scale: ScaleName, offset: number): string {
  return keySignatureAccidentals(key, scale).sign === 'sharp' ? shiftRoot(key, offset) : shiftRootFlat(key, offset);
}

export function diatonicChord(key: string, scale: ScaleName, degree: ScaleDegree): Chord {
  const root = shiftRootForKey(key, scale, SCALE_INTERVALS[scale][degree]);
  return { root, quality: DEGREE_QUALITIES[scale][degree] };
}

/** All 7 diatonic chords of a key/scale, in scale-degree order. */
export function diatonicChords(key: string, scale: ScaleName): Chord[] {
  return [0, 1, 2, 3, 4, 5, 6].map((degree) => diatonicChord(key, scale, degree as ScaleDegree));
}

/** The diatonic *seventh* chord built on a given scale degree of a key. */
export function diatonicSeventhChord(key: string, scale: ScaleName, degree: ScaleDegree): Chord {
  const root = shiftRootForKey(key, scale, SCALE_INTERVALS[scale][degree]);
  return { root, quality: DEGREE_SEVENTH_QUALITIES[scale][degree] };
}

/** e.g. "I", "vii°" */
export function romanNumeral(scale: ScaleName, degree: ScaleDegree): string {
  return ROMAN_NUMERALS[scale][degree];
}

export type ChordSelection =
  | { type: 'diatonic'; degree: ScaleDegree }
  | { type: 'diatonicSeventh'; degree: ScaleDegree }
  | { type: 'borrowed'; index: number }
  | { type: 'secondaryDominant'; degree: ScaleDegree }
  // Any of the 12 chromatic roots (0-11 semitones above the tonic) at any quality —
  // the escape hatch from the curated diatonic/borrowed lists.
  | {
      type: 'chromatic';
      offset: number;
      quality: ChordQuality;
      // Optional slash-chord bass, expressed the same way as offset — semitones
      // above the tonic — so it transposes correctly if the song's key changes,
      // rather than being hardcoded to an absolute note name.
      bassOffset?: number;
    };

export type ChordPlacement = {
  id: string;
  selection: ChordSelection;
  startBeat: number; // 0-based, in quarter-note beats
  lengthBeats: number; // any integer >= 1 (1 beat = 1/4 bar); 4 = 1 bar (default)
};

/** Encodes a ChordSelection as a string, for carrying it through drag-and-drop's dataTransfer. */
export function serializeSelection(selection: ChordSelection): string {
  switch (selection.type) {
    case 'diatonic':
      return `diatonic:${selection.degree}`;
    case 'diatonicSeventh':
      return `diatonicSeventh:${selection.degree}`;
    case 'borrowed':
      return `borrowed:${selection.index}`;
    case 'secondaryDominant':
      return `secondaryDominant:${selection.degree}`;
    case 'chromatic':
      return `chromatic:${selection.offset}:${selection.quality}:${
        selection.bassOffset !== undefined ? selection.bassOffset : ''
      }`;
  }
}

export function deserializeSelection(value: string): ChordSelection {
  const [type, ...rest] = value.split(':');
  switch (type) {
    case 'diatonic':
      return { type: 'diatonic', degree: Number(rest[0]) as ScaleDegree };
    case 'diatonicSeventh':
      return { type: 'diatonicSeventh', degree: Number(rest[0]) as ScaleDegree };
    case 'borrowed':
      return { type: 'borrowed', index: Number(rest[0]) };
    case 'secondaryDominant':
      return { type: 'secondaryDominant', degree: Number(rest[0]) as ScaleDegree };
    case 'chromatic': {
      const bassOffset = rest[2] !== undefined && rest[2] !== '' ? Number(rest[2]) : undefined;
      return {
        type: 'chromatic',
        offset: Number(rest[0]),
        quality: rest[1] as ChordQuality,
        ...(bassOffset !== undefined ? { bassOffset } : {}),
      };
    }
    default:
      throw new Error(`Unknown chord selection: "${value}"`);
  }
}

export type ChordOption = { selection: ChordSelection; chord: Chord; label: string };

type BorrowedChordDef = { offset: number; quality: ChordQuality; label: string };

// Modal interchange from the parallel mode — a curated set, not every possible borrow.
// Only defined for major/minor for now; the other modes get diatonic + chromatic only
// (there's no similarly obvious "right" curated list for e.g. phrygian or locrian —
// see borrowedOptions/resolveSelection below for how the gap is handled).
const BORROWED_CHORDS: Partial<Record<ScaleName, BorrowedChordDef[]>> = {
  major: [
    { offset: 5, quality: 'min', label: 'iv' },
    { offset: 3, quality: 'maj', label: 'bIII' },
    { offset: 8, quality: 'maj', label: 'bVI' },
    { offset: 10, quality: 'maj', label: 'bVII' },
  ],
  minor: [
    { offset: 0, quality: 'maj', label: 'I' },
    { offset: 5, quality: 'maj', label: 'IV' },
    { offset: 1, quality: 'maj', label: 'bII' },
    { offset: 8, quality: 'dom7', label: 'VI7' },
  ],
};

// Secondary dominants target these diatonic degrees — skips vii° (an uncommon target).
// Major also skips I: V/I would just duplicate the diatonic V chord there. Minor keeps
// i, since V/i (E7 in A minor) is the harmonic-minor dominant — a different, essential
// chord from the diatonic v (Em), not a duplicate. Only defined for major/minor for
// now — see the BORROWED_CHORDS comment above; same reasoning applies here.
const SECONDARY_DOMINANT_DEGREES: Partial<Record<ScaleName, ScaleDegree[]>> = {
  major: [1, 2, 3, 4, 5],
  minor: [0, 1, 2, 3, 4, 5],
};

function shiftRoot(key: string, offset: number): string {
  const shifted = (rootSemitone(key) + offset) % 12;
  return SEMITONE_TO_NOTE[shifted];
}

export function shiftRootFlat(key: string, offset: number): string {
  const shifted = (rootSemitone(key) + offset) % 12;
  return SEMITONE_TO_NOTE_FLAT[shifted];
}

export function diatonicOptions(key: string, scale: ScaleName): ChordOption[] {
  return [0, 1, 2, 3, 4, 5, 6].map((degree) => {
    const d = degree as ScaleDegree;
    return {
      selection: { type: 'diatonic', degree: d },
      chord: diatonicChord(key, scale, d),
      label: romanNumeral(scale, d),
    };
  });
}

export function diatonicSeventhOptions(key: string, scale: ScaleName): ChordOption[] {
  return [0, 1, 2, 3, 4, 5, 6].map((degree) => {
    const d = degree as ScaleDegree;
    return {
      selection: { type: 'diatonicSeventh', degree: d },
      chord: diatonicSeventhChord(key, scale, d),
      // Same roman numeral as the triad row — the quality is already spelled out in
      // the full chord name (chordName) that renders alongside it in the palette.
      label: romanNumeral(scale, d),
    };
  });
}

export function borrowedOptions(key: string, scale: ScaleName): ChordOption[] {
  return (BORROWED_CHORDS[scale] ?? []).map((def, index) => ({
    selection: { type: 'borrowed', index },
    chord: { root: shiftRootFlat(key, def.offset), quality: def.quality },
    label: def.label,
  }));
}

export function secondaryDominantOptions(key: string, scale: ScaleName): ChordOption[] {
  // Sign follows the *song's* key signature, not the target chord's own root --
  // same reasoning as diatonicChord/chromaticChord elsewhere in this file.
  const sign = keySignatureAccidentals(key, scale).sign;
  return (SECONDARY_DOMINANT_DEGREES[scale] ?? []).map((degree) => {
    const target = diatonicChord(key, scale, degree);
    const root = sign === 'sharp' ? shiftRoot(target.root, 7) : shiftRootFlat(target.root, 7);
    return {
      selection: { type: 'secondaryDominant', degree },
      chord: { root, quality: 'dom7' },
      label: `V7/${romanNumeral(scale, degree)}`,
    };
  });
}

// Interval-name labels for the 12 chromatic roots, relative to the tonic — flat spelling,
// matching the convention already used for borrowed chords.
const CHROMATIC_DEGREE_LABELS = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

/** Sharp in a sharp key, flat in a flat key — matches keySignatureAccidentals'
 * own sign for this key/scale, so a chromatic chord's root reads consistently
 * with the staff's own key signature (e.g. F#, not Gb, in E minor's one sharp)
 * rather than always defaulting to flat regardless of key. Unlike chromatic
 * roots, borrowed chords (bIII/bVI/bVII etc.) stay flat-spelled unconditionally
 * in borrowedOptions — that's a real, deliberate theory convention (they're
 * named by their flat relationship to the tonic), not the same "just pick
 * whichever's more readable" question this is answering for chromaticChord. */
export function chromaticChord(
  key: string,
  scale: ScaleName,
  offset: number,
  quality: ChordQuality,
  bassOffset?: number,
): Chord {
  const shift = keySignatureAccidentals(key, scale).sign === 'sharp' ? shiftRoot : shiftRootFlat;
  const chord: Chord = { root: shift(key, offset), quality };
  if (bassOffset !== undefined) chord.bass = shift(key, bassOffset);
  return chord;
}

/** All 12 chromatic roots at a single given quality — the chord-builder's root row.
 * `bassOffset`, when given, is applied to every option (the same slash bass note
 * dragged onto whichever root you pick). */
export function chromaticOptions(
  key: string,
  scale: ScaleName,
  quality: ChordQuality,
  bassOffset?: number,
): ChordOption[] {
  return CHROMATIC_DEGREE_LABELS.map((label, offset) => ({
    selection: { type: 'chromatic', offset, quality, ...(bassOffset !== undefined ? { bassOffset } : {}) },
    chord: chromaticChord(key, scale, offset, quality, bassOffset),
    label,
  }));
}

export type ChordOptionGroup = { label: string; options: ChordOption[] };

/** Every root × every quality — the full chord vocabulary, for a searchable
 * "browse all chords" picker (ChordPalette.tsx's Magic Chord modal) rather than
 * one curated list. Just chromaticOptions called once per quality and grouped
 * the same way QUALITY_GROUPS already groups qualities for the old Chromatic
 * section's own quality picker, so the picker reads as the same familiar
 * Triads/Sixths/Sevenths/Extensions/Altered clusters instead of one flat
 * 12-roots-times-28-qualities list. */
export function allChordsOptions(key: string, scale: ScaleName): ChordOptionGroup[] {
  return QUALITY_GROUPS.map((group) => ({
    label: group.label,
    options: group.qualities.flatMap((quality) => chromaticOptions(key, scale, quality)),
  }));
}

export function resolveSelection(key: string, scale: ScaleName, selection: ChordSelection): Chord {
  switch (selection.type) {
    case 'diatonic':
      return diatonicChord(key, scale, selection.degree);
    case 'diatonicSeventh':
      return diatonicSeventhChord(key, scale, selection.degree);
    case 'borrowed': {
      // Falls back to the tonic triad if this scale has no borrowed-chord list (or a
      // song preset saved under a different scale references an out-of-range index) —
      // same "don't crash, degrade gracefully" pattern as an unmatched style name.
      const def = BORROWED_CHORDS[scale]?.[selection.index];
      return def ? { root: shiftRootFlat(key, def.offset), quality: def.quality } : diatonicChord(key, scale, 0);
    }
    case 'secondaryDominant': {
      const target = diatonicChord(key, scale, selection.degree);
      const sign = keySignatureAccidentals(key, scale).sign;
      const root = sign === 'sharp' ? shiftRoot(target.root, 7) : shiftRootFlat(target.root, 7);
      return { root, quality: 'dom7' };
    }
    case 'chromatic':
      return chromaticChord(key, scale, selection.offset, selection.quality, selection.bassOffset);
  }
}

/** MIDI pitch for a given scale degree, octave, and optional chromatic nudge (in
 * semitones — see EditGrid's Alt+click "+1" convention). octave follows the same
 * convention as data/melody.ts's MIDDLE_C = 60 (C4). */
export function scaleDegreeToMidi(
  key: string,
  scale: ScaleName,
  degree: ScaleDegree,
  octave: number,
  semitoneOffset: number = 0,
): number {
  const absolute = rootSemitone(key) + SCALE_INTERVALS[scale][degree] + semitoneOffset;
  const octaveOffset = Math.floor(absolute / 12);
  const pitchClass = ((absolute % 12) + 12) % 12;
  return (octave + octaveOffset + 1) * 12 + pitchClass;
}

export type ScaleDegreePosition = { degree: ScaleDegree; octave: number; semitoneOffset: number };

type NearestDegree = { degree: ScaleDegree; interval: number; semitoneOffset: number };

/** Shared core behind midiToScaleDegreePosition and chordRootScaleDegree below
 * — given a semitone offset from the key's own root (0-11) and the scale's
 * own interval table, finds the closest diatonic degree plus how far off it
 * is (0 if the offset lands exactly on a degree). Every mode here is a
 * rotation of the plain major scale's whole/half-step pattern (see data/
 * melody.ts's midiFromStaffSteps for the same fact used elsewhere), so an
 * off-scale offset is always exactly equidistant between two adjacent
 * degrees, never closer to one than the other -- ties resolve to the lower
 * degree (found first in iteration order below), always giving a +1
 * semitoneOffset, never negative. */
function nearestScaleDegree(offset: number, scale: ScaleName): NearestDegree {
  const intervals = SCALE_INTERVALS[scale];
  const candidates = [
    ...intervals.map((interval, d) => ({ degree: d as ScaleDegree, interval })),
    { degree: 0 as ScaleDegree, interval: 12 },
  ];
  let best = candidates[0];
  let bestAbs = Math.abs(offset - best.interval);
  for (const c of candidates.slice(1)) {
    const abs = Math.abs(offset - c.interval);
    if (abs < bestAbs) {
      best = c;
      bestAbs = abs;
    }
  }
  return { ...best, semitoneOffset: offset - best.interval };
}

/** Inverse of scaleDegreeToMidi — finds the nearest scale degree (+ octave + a
 * semitone nudge for anything off-scale) for an existing MIDI pitch, so a
 * MelodyNote (hand-placed or MIDI-imported, possibly genuinely chromatic) renders
 * at a sensible row/octave/nudge in the grid rather than only ever supporting
 * newly-placed notes. */
export function midiToScaleDegreePosition(midi: number, key: string, scale: ScaleName): ScaleDegreePosition {
  const root = rootSemitone(key);
  const pitchOctave = Math.floor(midi / 12) - 1;
  const offset = (((midi - root) % 12) + 12) % 12;
  const best = nearestScaleDegree(offset, scale);
  const octaveOffset = Math.floor((root + best.interval) / 12);
  return { degree: best.degree, octave: pitchOctave - octaveOffset, semitoneOffset: best.semitoneOffset };
}

export type ChordRootDegree = { degree: ScaleDegree; semitoneOffset: number };

/** Same idea as midiToScaleDegreePosition, but for a chord's root note name
 * rather than a MIDI pitch — chord roots have no octave, so there's nothing
 * to resolve there, just the nearest diatonic degree and whether the root
 * sits exactly on it (semitoneOffset 0) or a semitone above (see
 * nearestScaleDegree's own doc comment for why this app's scale vocabulary
 * never produces anything but 0 or +1). Used to color a placed chord block by
 * scale degree the same way ChordPalette.tsx's diatonic buttons and
 * MelodyGrid.tsx's notes already are — including non-diatonic selections
 * (borrowed, secondary dominant, chromatic), which ChordSelection's own
 * `degree` field doesn't cover (a secondary dominant's `degree` names its
 * *target*, not its own root; chromatic/borrowed have no degree field at
 * all) — this reads the actual resolved root instead, so every placed chord
 * gets a color regardless of which selection type produced it. */
export function chordRootScaleDegree(root: string, key: string, scale: ScaleName): ChordRootDegree {
  const offset = ((rootSemitone(root) - rootSemitone(key)) % 12 + 12) % 12;
  const best = nearestScaleDegree(offset, scale);
  return { degree: best.degree, semitoneOffset: best.semitoneOffset };
}
