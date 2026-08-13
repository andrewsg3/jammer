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

// The number of beats in *this pattern's own* bar — undefined means 4, the same
// default STEPS_PER_BAR always assumed before this field existed. `bars` stays a
// pure count either way; this is just the conversion factor back to real beats/
// steps, resolved once at import/load time (see midiDrumImport.ts's own comment
// on where it comes from: the file's own embedded time-signature meta event,
// then a caller-supplied hint, then 4) rather than re-derived from context every
// time a pattern is read. See CLAUDE.md's "Beats per bar" section.
export type DrumPattern = {
  steps: DrumStep[];
  bars: number;
  beatsPerBar?: number;
};

/** How many STEPS_PER_BEAT-steps make up one bar of `pattern`'s *own* meter —
 * use this instead of the old flat STEPS_PER_BAR constant anywhere `.bars` gets
 * converted back to steps/beats, so a pattern authored in a non-4/4 meter loops
 * at its own true length instead of always being padded/truncated to a 4-beat bar. */
export function patternStepsPerBar(pattern: { beatsPerBar?: number }): number {
  return (pattern.beatsPerBar ?? 4) * STEPS_PER_BEAT;
}

// Plays a track at half or double speed relative to the song's actual tempo — twice
// (or half) as many notes fit in the same real-time span. A playback-time choice
// (see each channel strip's Feel picker), not baked into pattern data, so it applies
// uniformly to whichever style/rule is selected. Shared by drums, bass, and keys,
// though each applies it differently — see scheduleDrums/scheduleBass/scheduleKeys.
export type TimeFeel = 'normal' | 'half' | 'double';
export const TIME_FEELS: TimeFeel[] = ['normal', 'half', 'double'];

export function timeFeelFactor(feel: TimeFeel): number {
  return feel === 'double' ? 2 : feel === 'half' ? 0.5 : 1;
}

export type BassRule = {
  style:
    | 'root-fifth'
    | 'walking'
    | 'syncopated'
    | 'octaves'
    | 'pedal'
    | 'walk-updown'
    | 'tumbao'
    | 'root-fifth-pump'
    | 'smart-walk'
    | 'tunisia-vamp';
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
  // Same field, same reasoning as DrumPattern.beatsPerBar above — use
  // patternStepsPerBar(pattern) wherever `.bars` gets converted back to steps/beats.
  beatsPerBar?: number;
};

export type KeysRule = {
  voicing: 'triad' | 'power-chord' | 'seventh';
  // blues-shuffle(-swing) and rising-sun ignore `voicing` entirely — they compute
  // their own fixed figure (see scheduleKeys): root+5th/root+6th for the blues
  // idiom, root/3rd/5th/octave for rising-sun's broken chord, neither a subset of
  // whatever voicing happens to be selected.
  rhythm:
    | 'sustained'
    | 'comped'
    | 'la-pompe'
    | 'charleston'
    | 'arpeggio-up'
    | 'arpeggio-updown'
    | 'rising-sun'
    | 'virtual-insanity'
    | 'bossa-nova'
    | 'bossa-nova-2'
    | 'blues-shuffle'
    | 'blues-shuffle-swing';
};

// hidden: true means resolvable by name (for a song preset to reference) but not
// listed in the style picker — see the underscore-prefix convention in drumLibrary.ts.
// beatsPerBar: the meter this specific groove was actually authored/recorded in --
// undefined means meter-agnostic (currently only "None", which has no content to
// drift). Every bundled .mid pattern gets tagged 4 unless it lives in one of
// drumLibrary.ts's per-meter subfolders (e.g. drumPatterns/3-4/) -- a drum loop's
// own recorded length doesn't automatically retime itself the way an algorithmic
// bass/keys rule can, so a groove genuinely authored for a different meter needs
// its own file, not just a beatsPerBar prop threaded through at playback time. See
// CLAUDE.md's "Beats per bar" section.
export type DrumStyle = { name: string; pattern: DrumPattern | null; hidden?: boolean; beatsPerBar?: number };
// A bass style is either algorithmic (rule, generated per-chord at render time) or a
// fixed imported pattern (transposed to each chord's root at render time) — never both.
// beatsPerBar here means the same thing it does on DrumStyle above, but for a different
// reason: a bass *rule* isn't a recorded groove that could simply drift out of sync, it's
// generated live — so in principle any rule could read the song's beatsPerBar the way
// Smart Walking's own root-on-beat-1/approach-on-last-beat math already does (see
// audio/bass.ts). Tumbao, Root-Fifth Pump, and Tunisia Vamp specifically can't, though:
// each is a real idiomatic figure with fixed sixteenth-note-level internal timing (the
// clave pickup, the montuno cell, the vamp's arc), not an abstract shape that scales to
// any bar length — the same reason Charleston (data/instrumentStyles.ts's keysStyles) is
// tied to 4/4. Stretching their fixed offsets to fit a different beat count was tried in
// spirit for "My Favorite Things"'s keys rhythm (see CLAUDE.md's "Beats per bar" —
// abandoned, didn't sound right) — tagging them 4 and hiding them outside 4/4, same as a
// drum groove, avoids repeating that mistake rather than reparameterizing by formula.
export type BassStyle = {
  name: string;
  rule: BassRule | null;
  pattern?: BassPattern | null;
  hidden?: boolean;
  beatsPerBar?: number;
};
// beatsPerBar here is the same tag/reason as BassStyle's above: `sustained`, `comped`,
// and `arpeggio-up`/`arpeggio-updown` have no internal bar-boundary logic at all (no
// `% 4`, no `barStart += 4` stride — they just iterate the placement's own length), so
// they're genuinely meter-generic and stay untagged. La Pompe, Charleston, Rising Sun,
// Bossa Nova (both), Blues Shuffle (both), and Virtual Insanity all hardcode a 4-beat (or
// 2-bar-of-4, for bossa nova) cycle in scheduleKeys — real idiomatic figures, not a shape
// that scales to any bar length, the same reasoning that keeps Tumbao/Root-Fifth Pump/
// Tunisia Vamp tagged 4 on BassStyle above. See CLAUDE.md's "Beats per bar" section.
export type KeysStyle = { name: string; rule: KeysRule | null; beatsPerBar?: number };

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
  { name: 'Tumbao', rule: { style: 'tumbao' }, beatsPerBar: 4 },
  { name: 'Root-Fifth Pump', rule: { style: 'root-fifth-pump' }, beatsPerBar: 4 },
  { name: 'Smart Walking', rule: { style: 'smart-walk' } },
  { name: 'Tunisia Vamp', rule: { style: 'tunisia-vamp' }, beatsPerBar: 4 },
];

export const keysStyles: KeysStyle[] = [
  { name: 'None', rule: null },
  { name: 'Power Chords', rule: { voicing: 'power-chord', rhythm: 'sustained' } },
  { name: 'Comped Triads', rule: { voicing: 'triad', rhythm: 'comped' } },
  { name: 'Sustained 7ths', rule: { voicing: 'seventh', rhythm: 'sustained' } },
  { name: 'Comped Power Chords', rule: { voicing: 'power-chord', rhythm: 'comped' } },
  { name: 'Sustained Triads', rule: { voicing: 'triad', rhythm: 'sustained' } },
  { name: 'Comped 7ths', rule: { voicing: 'seventh', rhythm: 'comped' } },
  { name: 'La Pompe', rule: { voicing: 'seventh', rhythm: 'la-pompe' }, beatsPerBar: 4 },
  { name: 'Charleston', rule: { voicing: 'seventh', rhythm: 'charleston' }, beatsPerBar: 4 },
  { name: 'Arpeggiated (Triads)', rule: { voicing: 'triad', rhythm: 'arpeggio-up' } },
  { name: 'Arpeggiated (7ths)', rule: { voicing: 'seventh', rhythm: 'arpeggio-up' } },
  { name: 'Broken Chord (Up-Down)', rule: { voicing: 'seventh', rhythm: 'arpeggio-updown' } },
  { name: 'Rising Sun Arpeggio', rule: { voicing: 'triad', rhythm: 'rising-sun' }, beatsPerBar: 4 },
  { name: 'Bossa Nova', rule: { voicing: 'seventh', rhythm: 'bossa-nova' }, beatsPerBar: 4 },
  { name: 'Bossa Nova 2', rule: { voicing: 'seventh', rhythm: 'bossa-nova-2' }, beatsPerBar: 4 },
  { name: 'Blues Shuffle', rule: { voicing: 'power-chord', rhythm: 'blues-shuffle' }, beatsPerBar: 4 },
  { name: 'Blues Shuffle (Swing)', rule: { voicing: 'power-chord', rhythm: 'blues-shuffle-swing' }, beatsPerBar: 4 },
  { name: 'Virtual Insanity', rule: { voicing: 'seventh', rhythm: 'virtual-insanity' }, beatsPerBar: 4 },
];

// Instrument/timbre variants — an axis independent of the rhythmic style above.
// Picking "Comped 7ths" vs "La Pompe" changes the pattern; picking "Guitar" vs
// "Electric Piano" changes the sound that pattern is played with.
export type Instrument = { name: string };

// Acoustic Piano first — it's the default (see App.tsx, which falls back to
// keysInstruments[0] whenever no song preset/saved choice says otherwise).
export const keysInstruments: Instrument[] = [
  { name: 'Acoustic Piano' },
  { name: 'Acoustic Guitar' },
  { name: 'Electric Piano' },
  { name: 'Electric Cello' },
  { name: 'Kalimba' },
  { name: 'Steel Pan' },
];
export const bassInstruments: Instrument[] = [
  { name: 'Upright' },
  { name: 'Upright (Synth)' },
  { name: 'Electric' },
  { name: 'Electric (Synth)' },
];
export const drumsInstruments: Instrument[] = [{ name: 'Acoustic' }, { name: 'Electronic' }];
