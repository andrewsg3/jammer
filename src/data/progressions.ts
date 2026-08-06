export type ChordQuality =
  | 'maj'
  | 'min'
  | 'dom7'
  | 'maj7'
  | 'min7'
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
  | 'dom13'
  | 'm11'
  | 'maj13';

export type Chord = {
  root: string;
  quality: ChordQuality;
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
  dom13: [0, 4, 7, 10, 14, 21],
  m11: [0, 3, 7, 10, 14, 17],
  maj13: [0, 4, 7, 11, 14, 21],
};

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dom7: '7',
  maj7: 'maj7',
  min7: 'm7',
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
  dom13: '13',
  m11: 'm11',
  maj13: 'maj13',
};

export const QUALITY_GROUPS: { label: string; qualities: ChordQuality[] }[] = [
  { label: 'Triads', qualities: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'] },
  { label: 'Sixths', qualities: ['6', 'm6'] },
  { label: 'Sevenths', qualities: ['dom7', 'maj7', 'min7', 'dim7', 'm7b5'] },
  { label: 'Extensions', qualities: ['add9', 'dom9', 'maj9', 'm9'] },
  {
    label: 'Altered / Exotic',
    qualities: ['dom7sharp9', 'dom7flat9', 'dom7sharp5', 'dom13', 'm11', 'maj13'],
  },
];

export const QUALITY_LABELS: Record<ChordQuality, string> = {
  maj: 'Major',
  min: 'Minor',
  dom7: 'Dominant 7',
  maj7: 'Major 7',
  min7: 'Minor 7',
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
  dom13: 'Dominant 13',
  m11: 'Minor 11',
  maj13: 'Major 13',
};

// Each mode is the major scale rotated to start on a different degree — e.g. dorian
// is "the white keys starting on D." Intervals below are that rotation worked out
// from the tonic, and DEGREE_QUALITIES/ROMAN_NUMERALS follow from stacking thirds
// within each mode's own scale (not compared against major/minor).
const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor (aeolian)
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

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

/** e.g. "Dm", "G7", "Bdim" */
export function chordName(chord: Chord): string {
  return `${chord.root}${QUALITY_SUFFIX[chord.quality]}`;
}

/** The diatonic chord built on a given scale degree of a key. */
export function diatonicChord(key: string, scale: ScaleName, degree: ScaleDegree): Chord {
  const root = rootSemitone(key);
  const shifted = (root + SCALE_INTERVALS[scale][degree]) % 12;
  return { root: SEMITONE_TO_NOTE[shifted], quality: DEGREE_QUALITIES[scale][degree] };
}

/** All 7 diatonic chords of a key/scale, in scale-degree order. */
export function diatonicChords(key: string, scale: ScaleName): Chord[] {
  return [0, 1, 2, 3, 4, 5, 6].map((degree) => diatonicChord(key, scale, degree as ScaleDegree));
}

/** The diatonic *seventh* chord built on a given scale degree of a key. */
export function diatonicSeventhChord(key: string, scale: ScaleName, degree: ScaleDegree): Chord {
  const root = rootSemitone(key);
  const shifted = (root + SCALE_INTERVALS[scale][degree]) % 12;
  return { root: SEMITONE_TO_NOTE[shifted], quality: DEGREE_SEVENTH_QUALITIES[scale][degree] };
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
  | { type: 'chromatic'; offset: number; quality: ChordQuality };

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
      return `chromatic:${selection.offset}:${selection.quality}`;
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
    case 'chromatic':
      return { type: 'chromatic', offset: Number(rest[0]), quality: rest[1] as ChordQuality };
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

function shiftRootFlat(key: string, offset: number): string {
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
  return (SECONDARY_DOMINANT_DEGREES[scale] ?? []).map((degree) => {
    const target = diatonicChord(key, scale, degree);
    return {
      selection: { type: 'secondaryDominant', degree },
      chord: { root: shiftRoot(target.root, 7), quality: 'dom7' },
      label: `V7/${romanNumeral(scale, degree)}`,
    };
  });
}

// Interval-name labels for the 12 chromatic roots, relative to the tonic — flat spelling,
// matching the convention already used for borrowed chords.
const CHROMATIC_DEGREE_LABELS = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

export function chromaticChord(key: string, offset: number, quality: ChordQuality): Chord {
  return { root: shiftRootFlat(key, offset), quality };
}

/** All 12 chromatic roots at a single given quality — the chord-builder's root row. */
export function chromaticOptions(key: string, quality: ChordQuality): ChordOption[] {
  return CHROMATIC_DEGREE_LABELS.map((label, offset) => ({
    selection: { type: 'chromatic', offset, quality },
    chord: chromaticChord(key, offset, quality),
    label,
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
      return { root: shiftRoot(target.root, 7), quality: 'dom7' };
    }
    case 'chromatic':
      return chromaticChord(key, selection.offset, selection.quality);
  }
}
