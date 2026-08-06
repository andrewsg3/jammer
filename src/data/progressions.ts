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
  | 'm9';

export type Chord = {
  root: string;
  quality: ChordQuality;
};

export type Progression = Chord[];

export type ScaleName = 'major' | 'minor'; // 'minor' = natural minor
export type ScaleDegree = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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
};

export const QUALITY_GROUPS: { label: string; qualities: ChordQuality[] }[] = [
  { label: 'Triads', qualities: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4'] },
  { label: 'Sixths', qualities: ['6', 'm6'] },
  { label: 'Sevenths', qualities: ['dom7', 'maj7', 'min7', 'dim7', 'm7b5'] },
  { label: 'Extensions', qualities: ['add9', 'dom9', 'maj9', 'm9'] },
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
};

const SCALE_INTERVALS: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor
};

const DEGREE_QUALITIES: Record<ScaleName, ChordQuality[]> = {
  major: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
  minor: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
};

const ROMAN_NUMERALS: Record<ScaleName, string[]> = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
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

/** e.g. "I", "vii°" */
export function romanNumeral(scale: ScaleName, degree: ScaleDegree): string {
  return ROMAN_NUMERALS[scale][degree];
}

export type ChordSelection =
  | { type: 'diatonic'; degree: ScaleDegree }
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
const BORROWED_CHORDS: Record<ScaleName, BorrowedChordDef[]> = {
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
// chord from the diatonic v (Em), not a duplicate.
const SECONDARY_DOMINANT_DEGREES: Record<ScaleName, ScaleDegree[]> = {
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

export function borrowedOptions(key: string, scale: ScaleName): ChordOption[] {
  return BORROWED_CHORDS[scale].map((def, index) => ({
    selection: { type: 'borrowed', index },
    chord: { root: shiftRootFlat(key, def.offset), quality: def.quality },
    label: def.label,
  }));
}

export function secondaryDominantOptions(key: string, scale: ScaleName): ChordOption[] {
  return SECONDARY_DOMINANT_DEGREES[scale].map((degree) => {
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
    case 'borrowed': {
      const def = BORROWED_CHORDS[scale][selection.index];
      return { root: shiftRootFlat(key, def.offset), quality: def.quality };
    }
    case 'secondaryDominant': {
      const target = diatonicChord(key, scale, selection.degree);
      return { root: shiftRoot(target.root, 7), quality: 'dom7' };
    }
    case 'chromatic':
      return chromaticChord(key, selection.offset, selection.quality);
  }
}
