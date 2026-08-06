// 12 steps per beat — fine enough to exactly represent both straight 16th notes
// (every 3rd step) and 8th-note triplets/shuffle feel (every 4th step) on one grid.
export const STEPS_PER_BEAT = 12;
export const STEPS_PER_BAR = STEPS_PER_BEAT * 4;

// One lane per physical sound source (GrooveScribe's model) — accent/ghost/normal
// dynamics within a lane are just velocity, not a separate note here.
export type DrumVoice =
  | 'kick'
  | 'snare'
  | 'rim'
  | 'hihat' // closed
  | 'hihatOpen'
  | 'hihatFoot'
  | 'ride'
  | 'rideBell'
  | 'crash'
  | 'tomHigh'
  | 'tomMid'
  | 'tomLow';

export type DrumStep = {
  // position within the bar on the STEPS_PER_BAR grid: 0-47 for a 4/4 bar
  time: number;
  note: DrumVoice;
  velocity: number;
};

export type DrumPattern = {
  steps: DrumStep[];
  bars: number;
};

// Plays a track at half or double speed relative to the song's actual tempo — twice
// (or half) as many notes fit in the same real-time span. A playback-time choice
// (see each channel strip's Feel picker), not baked into pattern data, so it applies
// uniformly to whichever style/rule is selected. Shared by drums, bass, and keys,
// though each applies it differently — see scheduleDrums/scheduleBass/scheduleKeys.
export type TimeFeel = 'normal' | 'half' | 'double';

export function timeFeelFactor(feel: TimeFeel): number {
  return feel === 'double' ? 2 : feel === 'half' ? 0.5 : 1;
}

export type BassRule = {
  style: 'root-fifth' | 'walking' | 'syncopated' | 'octaves' | 'pedal' | 'walk-updown' | 'tumbao';
};

export type BassPatternStep = {
  // position within the pattern on the STEPS_PER_BAR grid, 0-47 per bar (matches DrumStep)
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
  // blues-shuffle(-swing) ignore `voicing` entirely — they compute a fixed root+5th
  // / root+6th figure of their own (see scheduleKeys), not a subset of the chord's
  // own tones, since the 6th is a deliberate blues idiom, not part of the harmony.
  rhythm: 'sustained' | 'comped' | 'la-pompe' | 'arpeggio-up' | 'arpeggio-updown' | 'blues-shuffle' | 'blues-shuffle-swing';
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
  { name: 'Tumbao', rule: { style: 'tumbao' } },
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
  { name: 'Blues Shuffle', rule: { voicing: 'power-chord', rhythm: 'blues-shuffle' } },
  { name: 'Blues Shuffle (Swing)', rule: { voicing: 'power-chord', rhythm: 'blues-shuffle-swing' } },
];

// Instrument/timbre variants — an axis independent of the rhythmic style above.
// Picking "Comped 7ths" vs "La Pompe" changes the pattern; picking "Guitar" vs
// "Electric Piano" changes the sound that pattern is played with.
export type Instrument = { name: string };

export const keysInstruments: Instrument[] = [{ name: 'Electric Piano' }, { name: 'Guitar' }];
export const bassInstruments: Instrument[] = [{ name: 'Electric' }, { name: 'Upright' }];
export const drumsInstruments: Instrument[] = [{ name: 'Acoustic' }, { name: 'Electronic' }];
