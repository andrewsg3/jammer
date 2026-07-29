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
  style: 'root-fifth' | 'walking' | 'syncopated' | 'octaves' | 'pedal';
};

export type KeysRule = {
  voicing: 'triad' | 'power-chord' | 'seventh';
  rhythm: 'sustained' | 'comped';
};

export type DrumStyle = { name: string; pattern: DrumPattern | null };
export type BassStyle = { name: string; rule: BassRule | null };
export type KeysStyle = { name: string; rule: KeysRule | null };

export const drumStyles: DrumStyle[] = [
  { name: 'None', pattern: null },
  {
    name: 'Rock',
    pattern: {
      bars: 1,
      steps: [
        { time: 0, note: 'kick', velocity: 1 },
        { time: 8, note: 'kick', velocity: 0.9 },
        { time: 4, note: 'snare', velocity: 1 },
        { time: 12, note: 'snare', velocity: 1 },
        { time: 0, note: 'hihat', velocity: 0.7 },
        { time: 2, note: 'hihat', velocity: 0.5 },
        { time: 4, note: 'hihat', velocity: 0.7 },
        { time: 6, note: 'hihat', velocity: 0.5 },
        { time: 8, note: 'hihat', velocity: 0.7 },
        { time: 10, note: 'hihat', velocity: 0.5 },
        { time: 12, note: 'hihat', velocity: 0.7 },
        { time: 14, note: 'hihat', velocity: 0.5 },
      ],
    },
  },
  {
    name: 'Four on the Floor',
    pattern: {
      bars: 1,
      steps: [
        { time: 0, note: 'kick', velocity: 1 },
        { time: 4, note: 'kick', velocity: 0.9 },
        { time: 8, note: 'kick', velocity: 1 },
        { time: 12, note: 'kick', velocity: 0.9 },
        { time: 4, note: 'snare', velocity: 1 },
        { time: 12, note: 'snare', velocity: 1 },
        { time: 0, note: 'hihat', velocity: 0.6 },
        { time: 2, note: 'hihat', velocity: 0.5 },
        { time: 4, note: 'hihat', velocity: 0.6 },
        { time: 6, note: 'hihat', velocity: 0.5 },
        { time: 8, note: 'hihat', velocity: 0.6 },
        { time: 10, note: 'hihat', velocity: 0.5 },
        { time: 12, note: 'hihat', velocity: 0.6 },
        { time: 14, note: 'hihat', velocity: 0.5 },
      ],
    },
  },
  {
    name: 'Funk',
    pattern: {
      bars: 1,
      steps: [
        { time: 0, note: 'kick', velocity: 1 },
        { time: 6, note: 'kick', velocity: 0.8 },
        { time: 10, note: 'kick', velocity: 0.9 },
        { time: 4, note: 'snare', velocity: 1 },
        { time: 12, note: 'snare', velocity: 1 },
        { time: 14, note: 'snare', velocity: 0.4 },
        ...Array.from({ length: 16 }, (_, i) => ({
          time: i,
          note: 'hihat' as const,
          velocity: i % 2 === 0 ? 0.65 : 0.45,
        })),
      ],
    },
  },
  {
    name: 'Half-Time',
    pattern: {
      bars: 1,
      steps: [
        { time: 0, note: 'kick', velocity: 1 },
        { time: 14, note: 'kick', velocity: 0.6 },
        { time: 8, note: 'snare', velocity: 1 },
        { time: 0, note: 'hihat', velocity: 0.6 },
        { time: 4, note: 'hihat', velocity: 0.6 },
        { time: 8, note: 'hihat', velocity: 0.6 },
        { time: 12, note: 'hihat', velocity: 0.6 },
      ],
    },
  },
];

export const bassStyles: BassStyle[] = [
  { name: 'None', rule: null },
  { name: 'Root-Fifth', rule: { style: 'root-fifth' } },
  { name: 'Walking', rule: { style: 'walking' } },
  { name: 'Syncopated', rule: { style: 'syncopated' } },
  { name: 'Octaves', rule: { style: 'octaves' } },
  { name: 'Pedal', rule: { style: 'pedal' } },
];

export const keysStyles: KeysStyle[] = [
  { name: 'None', rule: null },
  { name: 'Power Chords', rule: { voicing: 'power-chord', rhythm: 'sustained' } },
  { name: 'Comped Triads', rule: { voicing: 'triad', rhythm: 'comped' } },
  { name: 'Sustained 7ths', rule: { voicing: 'seventh', rhythm: 'sustained' } },
  { name: 'Comped Power Chords', rule: { voicing: 'power-chord', rhythm: 'comped' } },
  { name: 'Sustained Triads', rule: { voicing: 'triad', rhythm: 'sustained' } },
  { name: 'Comped 7ths', rule: { voicing: 'seventh', rhythm: 'comped' } },
];
