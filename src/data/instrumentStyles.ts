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

export type KeysRule = {
  voicing: 'triad' | 'power-chord' | 'seventh';
  rhythm: 'sustained' | 'comped' | 'la-pompe' | 'arpeggio-up' | 'arpeggio-updown';
};

export type DrumStyle = { name: string; pattern: DrumPattern | null };
export type BassStyle = { name: string; rule: BassRule | null };
export type KeysStyle = { name: string; rule: KeysRule | null };

// The rest of the drum library is loaded at runtime from the .mid files in
// ./drumPatterns/ — see drumLibrary.ts. "None" is the only style that can't be
// a MIDI file (there's no such thing as a silent drum pattern file).
export const baseDrumStyles: DrumStyle[] = [{ name: 'None', pattern: null }];

export const bassStyles: BassStyle[] = [
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
