export type DrumStep = {
  // sixteenth-note position within the bar: 0-15 for a 4/4 bar
  time: number;
  note: 'kick' | 'snare' | 'hihat';
  velocity: number;
};

export type DrumPattern = {
  steps: DrumStep[];
  bars: number;
};

export type BassRule = {
  style: 'root-fifth' | 'walking' | 'syncopated' | 'octaves' | 'pedal' | 'walk-updown';
};

export type BassPatternStep = {
  // sixteenth-note position within the pattern, 0-15 per bar (matches DrumStep)
  time: number;
  // semitones from the chord's root, authored against a reference root of C —
  // negative or >11 is fine (dips below the root, climbs past an octave, etc.)
  intervalFromRoot: number;
  velocity: number;
};

export type BassPattern = {
  steps: BassPatternStep[];
  bars: number;
};

export type KeysRule = {
  voicing: 'triad' | 'power-chord' | 'seventh';
  rhythm: 'sustained' | 'comped' | 'la-pompe' | 'arpeggio-up' | 'arpeggio-updown';
};

// hidden: true means resolvable by name (for a song preset to reference) but not
// listed in the style picker — see the underscore-prefix convention in drumLibrary.ts.
export type DrumStyle = { name: string; pattern: DrumPattern | null; hidden?: boolean };
// A bass style is either algorithmic (rule, generated per-chord at render time) or a
// fixed imported pattern (transposed to each chord's root at render time) — never both.
export type BassStyle = {
  name: string;
  rule: BassRule | null;
  pattern?: BassPattern | null;
  hidden?: boolean;
};
export type KeysStyle = { name: string; rule: KeysRule | null };

// The rest of the drum library is loaded at runtime from the .mid files in
// ./drumPatterns/ — see drumLibrary.ts. "None" is the only style that can't be
// a MIDI file (there's no such thing as a silent drum pattern file).
export const baseDrumStyles: DrumStyle[] = [{ name: 'None', pattern: null }];

// Likewise, imported bass patterns are loaded at runtime from ./bassPatterns/ —
// see bassLibrary.ts. These are the algorithmic (rule-based) options.
export const baseBassStyles: BassStyle[] = [
  { name: 'None', rule: null },
  { name: 'Root-Fifth', rule: { style: 'root-fifth' } },
  { name: 'Walking', rule: { style: 'walking' } },
  { name: 'Syncopated', rule: { style: 'syncopated' } },
  { name: 'Octaves', rule: { style: 'octaves' } },
  { name: 'Pedal', rule: { style: 'pedal' } },
  { name: 'Walk Up & Down', rule: { style: 'walk-updown' } },
];

export const keysStyles: KeysStyle[] = [
  { name: 'None', rule: null },
  { name: 'Power Chords', rule: { voicing: 'power-chord', rhythm: 'sustained' } },
  { name: 'Comped Triads', rule: { voicing: 'triad', rhythm: 'comped' } },
  { name: 'Sustained 7ths', rule: { voicing: 'seventh', rhythm: 'sustained' } },
  { name: 'Comped Power Chords', rule: { voicing: 'power-chord', rhythm: 'comped' } },
  { name: 'Sustained Triads', rule: { voicing: 'triad', rhythm: 'sustained' } },
  { name: 'Comped 7ths', rule: { voicing: 'seventh', rhythm: 'comped' } },
  { name: 'La Pompe', rule: { voicing: 'seventh', rhythm: 'la-pompe' } },
  { name: 'Arpeggiated (Triads)', rule: { voicing: 'triad', rhythm: 'arpeggio-up' } },
  { name: 'Arpeggiated (7ths)', rule: { voicing: 'seventh', rhythm: 'arpeggio-up' } },
  { name: 'Broken Chord (Up-Down)', rule: { voicing: 'seventh', rhythm: 'arpeggio-updown' } },
];

// Instrument/timbre variants — an axis independent of the rhythmic style above.
// Picking "Comped 7ths" vs "La Pompe" changes the pattern; picking "Guitar" vs
// "Electric Piano" changes the sound that pattern is played with.
export type Instrument = { name: string };

export const keysInstruments: Instrument[] = [{ name: 'Electric Piano' }, { name: 'Guitar' }];
export const bassInstruments: Instrument[] = [{ name: 'Electric' }, { name: 'Upright' }];
export const drumsInstruments: Instrument[] = [{ name: 'Acoustic' }, { name: 'Electronic' }];
