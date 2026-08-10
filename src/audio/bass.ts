import * as Tone from 'tone';
import {
  chordTones,
  resolveSelection,
  rootSemitone,
  bassRootNote,
  type ChordPlacement,
  type Chord,
  type ScaleName,
} from '../data/progressions';
import { STEPS_PER_BEAT, timeFeelFactor } from '../data/instrumentStyles';
import type { BassRule, BassPattern, TimeFeel } from '../data/instrumentStyles';
import { REFERENCE_ROOT_MIDI } from '../data/midiBassImport';
import { UPRIGHT_SAMPLE_URLS, ELECTRIC_SAMPLE_URLS } from '../data/bassSamples';

// Tone.js's Bars:Beats:Sixteenths time strings accept a fractional sixteenths
// component, so a STEPS_PER_BEAT (12-per-beat) step converts to sixteenths just by
// scaling — this is what lets an imported 8th-note-triplet hit (step 4, 8) land at
// its true triplet position (1.33, 2.67) instead of snapping to a straight 16th.
function stepToSixteenths(stepInBeat: number): number {
  return (stepInBeat * 4) / STEPS_PER_BEAT;
}

// This app never uses the "bars" component of a Bars:Beats:Sixteenths string — every
// event time is `0:<beat>:<sixteenths>`, with the full absolute beat count stuffed
// into the "beats" slot. That makes these two trivial, and is what withTimeFeel below
// relies on to shift/rescale already-built event times without re-deriving them.
function parseBeat(time: string): number {
  const [, beats, sixteenths] = time.split(':').map(Number);
  return beats + (sixteenths || 0) / 4;
}

function beatToTime(beat: number): string {
  const wholeBeat = Math.floor(beat);
  return `0:${wholeBeat}:${(beat - wholeBeat) * 4}`;
}

const BASS_OCTAVE = 2;
// Lowest note a real 4-string bass guitar can reach (E1) — same floor
// smartWalkBarEvents' own SMART_WALK_LOW uses, for the same reason: below this
// isn't a real bass part any more, whatever the pattern math would otherwise ask for.
const BASS_LOW_FLOOR_MIDI = 28;

// Toggleable compressor — always in the chain (like keys.ts's chorus/reverb),
// off by default via ratio:1 (mathematically zero gain reduction, a real bypass
// rather than a parameter that merely makes compression subtle) rather than
// rewiring the audio graph live. Evens out the gap between the sampled
// instruments' inherently inconsistent recorded levels and the synths' more
// uniform output, and generally makes the line punchier/more consistent.
const compressor = new Tone.Compressor({ threshold: -30, ratio: 1, attack: 0.005, release: 0.15 }).toDestination();

export function setCompressionEnabled(enabled: boolean): void {
  // -30dB threshold means most of the line sits above it, so a 6:1 ratio actually
  // reads as an audible punch/sustain boost rather than the barely-there change a
  // higher threshold + gentler ratio produced (confirmed by directly reading the
  // live DynamicsCompressorNode's params in the browser — toggling it was always
  // wired correctly, just tuned too subtle to notice on sparse bass content).
  compressor.ratio.value = enabled ? 6 : 1;
}

const output = new Tone.Volume(0).connect(compressor);

let synth: Tone.MonoSynth | Tone.PluckSynth | Tone.Sampler | null = null;
let currentInstrument = 'Upright';
type BassEvent = { time: string; note: string; duration: string; velocity: number };
let part: Tone.Part<BassEvent> | null = null;

// A uniform lead-trim was tried here (fetch + decode + slice a fixed amount off
// every buffer's front before handing it to Tone.Sampler) and reverted — the
// actual pre-transient silence varies file to file, so one flat cut either left
// some notes with residual latency or clipped into others' real attack,
// audible as a wrong-sounding pluck either way. Fixing each file's own
// transient by ear (Ableton) is the real fix; this just plays whatever's in
// data/bassSamples.ts as-is, same as every other sampled instrument here.
//
// Upright is temporarily back on the single-anchor UPRIGHT_SAMPLE_URLS instead
// of the real per-note UPRIGHT_MULTISAMPLE_URLS — see bassSamples.ts's own
// comment on UPRIGHT_SAMPLE_URLS for why, and swap this back once the
// multisample's transients are properly trimmed.
function buildSynth(): Tone.MonoSynth | Tone.PluckSynth | Tone.Sampler {
  // Checked by key count, not a specific hardcoded note like "C2"/"G#2" — which
  // note ends up as the anchor depends entirely on whatever data/bassSamples.ts
  // parses the bundled file's name as, and a hardcoded check silently (no error,
  // just a wrong-sounding fallback) goes stale the moment that note's spelling
  // changes, exactly what happened here once already.
  if (currentInstrument === 'Upright' && Object.keys(UPRIGHT_SAMPLE_URLS).length > 0) {
    // Real recorded pizzicato (see data/bassSamples.ts) rather than a synth patch
    // — Tone.Sampler repitches the one sampled note to cover the rest of the
    // range. Falls through to the synth below if the sample isn't there.
    // +6dB trim — the raw recording sits quieter than the synth patches at the
    // same nominal fader position.
    return new Tone.Sampler({ urls: UPRIGHT_SAMPLE_URLS, release: 0.3 }).connect(new Tone.Volume(6).connect(output));
  }
  if (currentInstrument === 'Electric' && Object.keys(ELECTRIC_SAMPLE_URLS).length > 0) {
    // Same technique as sampled 'Upright' above, one anchor note repitched by
    // Tone.Sampler. Falls through to 'Electric (Synth)' below if missing.
    return new Tone.Sampler({ urls: ELECTRIC_SAMPLE_URLS, release: 0.2 }).connect(output);
  }
  if (currentInstrument === 'Electric (Synth)') {
    // Karplus-Strong string synthesis — genuinely plucked/woody, a good fit for
    // upright pizzicato without needing sampled strings.
    return new Tone.MonoSynth({
      "oscillator": {
          "type": "fmsquare5",
      "modulationType" : "triangle",
          "modulationIndex" : 2,
          "harmonicity" : 0.501
      },
      "filter": {
          "Q": 1,
          "type": "lowpass",
          "rolloff": -24
      },
      "envelope": {
          "attack": 0.01,
          "decay": 0.1,
          "sustain": 0.4,
          "release": 2
      },
      "filterEnvelope": {
          "attack": 0.01,
          "decay": 0.1,
          "sustain": 0.8,
          "release": 1.5,
          "baseFrequency": 50,
          "octaves": 4.4
      }
  }).connect(output);
  }
  // 'Upright (Synth)' — the original generated upright sound, kept as its own
  // selectable option rather than replaced outright by the sampled 'Upright'
  // above. Also the fallback if 'Upright'/'Electric' are picked but their
  // samples aren't bundled, and for any other/future instrument name. Sawtooth
  // through a lowpass filter that closes down after the pluck — brighter attack
  // settling into a warmer sustain, like a plucked bass string.
  return new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.3 },
    filter: { type: 'lowpass', rolloff: -24, Q: 1 },
    filterEnvelope: {
      attack: 0.005,
      decay: 0.2,
      sustain: 0.3,
      release: 0.3,
      baseFrequency: 100,
      octaves: 3,
    },
  }).connect(output);
}

function ensureSynth() {
  if (!synth) synth = buildSynth();
}

export function setVolume(db: number): void {
  output.volume.value = db;
}

export function setMuted(muted: boolean): void {
  output.mute = muted;
}

export function setInstrument(name: string): void {
  if (name !== currentInstrument) {
    currentInstrument = name;
    synth?.dispose();
    synth = null;
  }
  // Eagerly (not lazily at first Play) so a sample-based instrument's buffer
  // starts loading as soon as it's selected — see isInstrumentLoaded and
  // keys.ts's identical reasoning for the piano.
  ensureSynth();
}

/** False only while the current instrument is sample-based (Tone.Sampler) and
 * still loading its buffer — always true for the synth patches. */
export function isInstrumentLoaded(): boolean {
  if (!synth) return false;
  return synth instanceof Tone.Sampler ? synth.loaded : true;
}

// A chord's tones with the bottom one swapped for its slash bass note, if it has
// one — 3rd/5th/7th (positions 1+) still come from the chord's real root/quality,
// only "the root" a bass line would actually play changes. See bassRootNote.
function rootTones(chord: Chord, baseOctave: number): string[] {
  const tones = chordTones(chord, baseOctave);
  tones[0] = `${bassRootNote(chord)}${baseOctave}`;
  return tones;
}

function noteForBeat(chord: Chord, rule: BassRule, beat: number): string | null {
  const tones = rootTones(chord, BASS_OCTAVE);
  const root = tones[0];
  const fifth = tones[2] ?? root;
  const beatInBar = beat % 4;

  switch (rule.style) {
    case 'root-fifth': {
      if (beatInBar === 0) return root;
      if (beatInBar !== 2) return null;
      // Prefers the fifth *below* the root (one octave down from the fifth
      // above it that chordTones' own ascending voicing gives) — smoother than
      // leaping up to it, and how a real bassist plays this pattern by default.
      // Falls back to the upper fifth only when the lower one would dip below a
      // real bass guitar's lowest string.
      const fifthBelow = rootTones(chord, BASS_OCTAVE - 1)[2] ?? fifth;
      return Tone.Frequency(fifthBelow).toMidi() >= BASS_LOW_FLOOR_MIDI ? fifthBelow : fifth;
    }
    case 'walking':
      return tones[beatInBar % tones.length];
    case 'syncopated':
      return beatInBar === 0 || beatInBar === 2 ? root : null;
    case 'octaves': {
      const rootHigh = rootTones(chord, BASS_OCTAVE + 1)[0];
      return beatInBar % 2 === 0 ? root : rootHigh;
    }
    case 'pedal':
      return root;
    case 'walk-updown': {
      // Climbs root -> ...chord tones... -> octave, then back down, running
      // continuously across the chord's full duration rather than resetting each bar.
      const octaveRoot = rootTones(chord, BASS_OCTAVE + 1)[0];
      const up = [...tones, octaveRoot];
      const updown = [...up, ...up.slice(1, -1).reverse()];
      return updown[beat % updown.length];
    }
    case 'tumbao':
      // Handled by tumbaoEvents (needs sixteenth-note placement and next-chord
      // lookahead, which this per-beat/single-chord function can't express).
      return null;
    case 'root-fifth-pump':
      // Handled by rootFifthPumpEvents (needs sixteenth-note placement this
      // per-beat/single-chord function can't express).
      return null;
    case 'smart-walk':
      // Handled by smartWalkAllEvents (needs the whole progression at once for
      // chord-change lookahead and a continuous register pointer).
      return null;
    case 'tunisia-vamp':
      // Handled by tunisiaVampEvents (needs sixteenth-note placement this
      // per-beat/single-chord function can't express).
      return null;
  }
}

/**
 * Afro-Cuban tumbao: root on beat 1, a pickup (the 3rd) on the "and" of 2, and the
 * 5th on beat 4 — except on the bar right before the chord changes, where the 5th is
 * replaced by an anticipation of the *next* chord's root on the "and" of 4. That
 * early, syncopated arrival across the barline is tumbao's signature move, so it
 * needs the next chord as lookahead (unlike every other rule-based style here, which
 * only ever looks at the current one).
 */
function tumbaoEvents(chord: Chord, nextChord: Chord | null, placement: ChordPlacement): BassEvent[] {
  const tones = rootTones(chord, BASS_OCTAVE);
  const root = tones[0];
  const third = tones[1] ?? root;
  const fifth = tones[2] ?? root;
  const nextRoot = nextChord ? rootTones(nextChord, BASS_OCTAVE)[0] : root;

  const totalSixteenths = placement.lengthBeats * 4;
  const events: BassEvent[] = [];

  const push = (offset: number, note: string, duration: string, velocity: number) => {
    if (offset >= totalSixteenths) return;
    const beat = placement.startBeat + Math.floor(offset / 4);
    const sixteenths = offset % 4;
    events.push({ time: `0:${beat}:${sixteenths}`, note, duration, velocity });
  };

  for (let barStart = 0; barStart < totalSixteenths; barStart += 16) {
    const isLastBarOfPlacement = barStart + 16 >= totalSixteenths;

    push(barStart, root, '4n', 0.85); // beat 1: root
    push(barStart + 6, third, '8n', 0.65); // "and" of 2: pickup

    if (isLastBarOfPlacement && nextChord) {
      push(barStart + 14, nextRoot, '8n', 0.9); // "and" of 4: anticipate the next chord
    } else {
      push(barStart + 12, fifth, '4n', 0.75); // beat 4: fifth
    }
  }
  return events;
}

/**
 * Root-fifth pump: a driving four-beat cell — root on beat 1, root again on the
 * "and" of beat 2 (a dotted-quarter later), fifth on beat 3, fifth on beat 4 —
 * tiled continuously across the placement, so it repeats once per bar and keeps
 * cycling into any following bars. Half the speed of the original two-beat-cell
 * version: same shape, uniformly stretched to fill a full bar instead of half of
 * one. Needs its own sixteenth-resolution generator (like tumbaoEvents) rather
 * than noteForBeat, since that only ever places one note per whole beat.
 */
function rootFifthPumpEvents(chord: Chord, placement: ChordPlacement): BassEvent[] {
  const tones = rootTones(chord, BASS_OCTAVE);
  const root = tones[0];
  const fifth = tones[2] ?? root;
  const totalSixteenths = placement.lengthBeats * 4;
  const events: BassEvent[] = [];

  const push = (offset: number, note: string) => {
    if (offset >= totalSixteenths) return;
    const beat = placement.startBeat + Math.floor(offset / 4);
    const sixteenths = offset % 4;
    events.push({ time: `0:${beat}:${sixteenths}`, note, duration: '16n', velocity: 0.8 });
  };

  for (let cellStart = 0; cellStart < totalSixteenths; cellStart += 16) {
    push(cellStart, root); // beat 1
    push(cellStart + 6, root); // "and" of 2
    push(cellStart + 8, fifth); // beat 3
    push(cellStart + 12, fifth); // beat 4
  }
  return events;
}

/**
 * The "A Night in Tunisia" vamp bass figure: a symmetric arc arpeggio across one
 * bar — root, 3rd, 5th, octave rising on 1, 1&, 2, 2& (that last note held
 * through beat 3, since nothing re-attacks there), then 5th, 3rd falling back on
 * 3& and 4& (3& likewise held through beat 4) before landing back on the root
 * for the next bar's downbeat. Needs its own sixteenth-resolution generator
 * (like rootFifthPumpEvents) since noteForBeat only ever places one note per
 * whole beat.
 */
function tunisiaVampEvents(chord: Chord, placement: ChordPlacement): BassEvent[] {
  const tones = rootTones(chord, BASS_OCTAVE);
  const root = tones[0];
  const third = tones[1] ?? root;
  const fifth = tones[2] ?? root;
  // The real 7th when the chord has one (min7/dom7/etc.) — arpeggiating up
  // through root-3rd-5th-7th is the actual chord-tone shape this figure wants
  // for a seventh chord. Falls back to the octave root for a plain triad
  // (maj/min), which has no 7th to reach for.
  const seventh = tones[3] ?? rootTones(chord, BASS_OCTAVE + 1)[0];
  const totalSixteenths = placement.lengthBeats * 4;
  const events: BassEvent[] = [];

  const push = (offset: number, note: string, duration: string) => {
    if (offset >= totalSixteenths) return;
    const beat = placement.startBeat + Math.floor(offset / 4);
    const sixteenths = offset % 4;
    events.push({ time: `0:${beat}:${sixteenths}`, note, duration, velocity: 0.8 });
  };

  for (let barStart = 0; barStart < totalSixteenths; barStart += 16) {
    push(barStart, root, '8n'); // beat 1
    push(barStart + 2, third, '8n'); // 1&
    push(barStart + 4, fifth, '8n'); // beat 2
    push(barStart + 6, seventh, '4n'); // 2& — held through beat 3
    push(barStart + 10, fifth, '4n'); // 3& — held through beat 4
    push(barStart + 14, third, '8n'); // 4&
  }
  return events;
}

/** Transposes a pattern's steps to a chord, tiling the pattern across the placement's length. */
function patternEvents(chord: Chord, pattern: BassPattern, placement: ChordPlacement): BassEvent[] {
  const rootMidi = Tone.Frequency(chordTones(chord, BASS_OCTAVE)[0]).toMidi();
  const patternLengthSteps = pattern.bars * STEPS_PER_BEAT * 4;
  const totalSteps = placement.lengthBeats * STEPS_PER_BEAT;

  const events: BassEvent[] = [];
  for (let s = 0; s < totalSteps; s++) {
    const localStep = s % patternLengthSteps;
    for (const hit of pattern.steps) {
      if (hit.time !== localStep) continue;
      const beat = placement.startBeat + Math.floor(s / STEPS_PER_BEAT);
      const sixteenths = stepToSixteenths(s % STEPS_PER_BEAT);
      events.push({
        time: `0:${beat}:${sixteenths}`,
        note: Tone.Frequency(rootMidi + hit.intervalFromRoot, 'midi').toNote(),
        duration: '8n',
        velocity: hit.velocity,
      });
    }
  }
  return events;
}

/**
 * Plays the pattern through once, verbatim, spanning every placement — no
 * transposition at all. Only used when the pattern's own length exactly matches
 * the total progression length (see scheduleBass): that's the signal it's a
 * finished bassline someone already composed against the real chords (not an
 * abstract relative lick), so re-deriving pitches from "whichever chord is
 * sounding" would just repitch a take that was already correct.
 */
function wholeProgressionEvents(placements: ChordPlacement[], pattern: BassPattern): BassEvent[] {
  const patternLengthSteps = pattern.bars * STEPS_PER_BEAT * 4;
  const spanStart = Math.min(...placements.map((p) => p.startBeat));
  const spanEnd = Math.max(...placements.map((p) => p.startBeat + p.lengthBeats));
  const totalSteps = (spanEnd - spanStart) * STEPS_PER_BEAT;

  const events: BassEvent[] = [];
  for (let s = 0; s < totalSteps; s++) {
    const beat = spanStart + Math.floor(s / STEPS_PER_BEAT);
    const covered = placements.some((p) => beat >= p.startBeat && beat < p.startBeat + p.lengthBeats);
    if (!covered) continue; // a gap between placements — nothing sounding here

    const localStep = s % patternLengthSteps;
    for (const hit of pattern.steps) {
      if (hit.time !== localStep) continue;
      events.push({
        time: `0:${beat}:${stepToSixteenths(s % STEPS_PER_BEAT)}`,
        note: Tone.Frequency(REFERENCE_ROOT_MIDI + hit.intervalFromRoot, 'midi').toNote(),
        duration: '8n',
        velocity: hit.velocity,
      });
    }
  }
  return events;
}

// Range for the smart-walk generator: wide enough for real melodic motion, narrow
// enough to stay clearly "bass" — roughly E1 to G3.
const SMART_WALK_LOW = 28;
const SMART_WALK_HIGH = 55;

/** The instance of `pitchClass` closest to `reference` — may land above or below it. */
function nearestMidi(reference: number, pitchClass: number): number {
  const base = reference - (((reference % 12) + 12) % 12) + (((pitchClass % 12) + 12) % 12);
  let best = base;
  for (const candidate of [base - 12, base, base + 12]) {
    if (Math.abs(candidate - reference) < Math.abs(best - reference)) best = candidate;
  }
  return best;
}

// Applied only to each bar's beat-1 root (see smartWalkBarEvents) — the rest of
// the bar (beats 2-4) is built relative to that root, so leaning just the root
// choice downward is enough to pull the whole line's register with it, without
// touching nearestMidi's other callers (direction-finding, beat 2/3 chord-tone
// choice) and their own voice-leading logic.
const SMART_WALK_LOW_BIAS = 4; // semitones — how much closer the higher octave has to be before it wins anyway

/** Same idea as nearestMidi, but tilted toward the lower octave candidate: a
 * higher one only wins if it's more than `biasSemitones` closer to `reference`.
 * Without this, walking bass drifts and settles wherever the previous bar's
 * pointer happened to land, with no pull back toward the bottom of the range. */
function nearestMidiLowBiased(reference: number, pitchClass: number, biasSemitones: number): number {
  const base = reference - (((reference % 12) + 12) % 12) + (((pitchClass % 12) + 12) % 12);
  let best = base;
  let bestScore = Infinity;
  for (const candidate of [base - 12, base, base + 12]) {
    const score = Math.abs(candidate - reference) + (candidate > reference ? biasSemitones : 0);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function clampToBassRange(midi: number): number {
  while (midi < SMART_WALK_LOW) midi += 12;
  while (midi > SMART_WALK_HIGH) midi -= 12;
  return midi;
}

/**
 * One bar of smart-walking bass. Beat 1 is always `chord`'s root; beat 4 is a
 * chromatic approach tone into `targetChord`'s root (the *next* chord's root on a
 * bar right before a change, thanks to the lookahead in smartWalkAllEvents — or
 * just next bar's own root if the chord is holding). Beats 2 and 3 are `chord`'s
 * own tones, picked to land close to the straight line between beat 1 and the
 * approach tone, so the line leans the same direction it's about to move rather
 * than wandering. `pointer` threads the last note's absolute pitch in from the
 * previous bar (see smartWalkAllEvents) so octave choices stay smooth instead of
 * leaping — and a held chord still gets real movement, alternating up/down bar to
 * bar, rather than collapsing back onto the same note it started on.
 */
function smartWalkBarEvents(
  chord: Chord,
  targetChord: Chord,
  bar: number,
  cellStart: number,
  totalSixteenths: number,
  placement: ChordPlacement,
  pointer: { midi: number },
): BassEvent[] {
  const events: BassEvent[] = [];
  const push = (offset: number, midi: number, velocity: number) => {
    if (offset >= totalSixteenths) return;
    const beat = placement.startBeat + Math.floor(offset / 4);
    const sixteenths = offset % 4;
    events.push({
      time: `0:${beat}:${sixteenths}`,
      note: Tone.Frequency(midi, 'midi').toNote(),
      duration: '4n',
      velocity,
    });
  };

  const rootPc = rootSemitone(bassRootNote(chord));
  const targetPc = rootSemitone(bassRootNote(targetChord));
  const rootMidi = clampToBassRange(nearestMidiLowBiased(pointer.midi, rootPc, SMART_WALK_LOW_BIAS));
  push(cellStart, rootMidi, 0.85);

  const sameTarget = targetPc === rootPc;
  const direction = sameTarget ? (bar % 2 === 0 ? 1 : -1) : nearestMidi(rootMidi, targetPc) >= rootMidi ? 1 : -1;
  const targetMidi = clampToBassRange(sameTarget ? rootMidi + direction * 12 : nearestMidi(rootMidi, targetPc));
  const approachMidi = direction === 1 ? targetMidi - 1 : targetMidi + 1;

  const chordTonePcs = chordTones(chord, BASS_OCTAVE)
    .map((n) => Tone.Frequency(n).toMidi() % 12)
    .filter((pc) => pc !== rootPc);

  const pickMid = (fraction: number) => {
    const desired = rootMidi + (approachMidi - rootMidi) * fraction;
    const pcs = chordTonePcs.length > 0 ? chordTonePcs : [rootPc];
    let best = nearestMidi(desired, pcs[0]);
    for (const pc of pcs) {
      const candidate = nearestMidi(desired, pc);
      if (Math.abs(candidate - desired) < Math.abs(best - desired)) best = candidate;
    }
    return best;
  };

  push(cellStart + 4, pickMid(1 / 3), 0.7); // beat 2
  push(cellStart + 8, pickMid(2 / 3), 0.7); // beat 3
  push(cellStart + 12, approachMidi, 0.75); // beat 4: chromatic approach

  pointer.midi = approachMidi;
  return events;
}

/** Walks `chord` across a single placement, bar by bar, approaching `nextChord`'s
 * root (if any) on the last bar. */
function smartWalkPlacementEvents(
  chord: Chord,
  nextChord: Chord | null,
  placement: ChordPlacement,
  pointer: { midi: number },
): BassEvent[] {
  const totalSixteenths = placement.lengthBeats * 4;
  const events: BassEvent[] = [];
  let bar = 0;
  for (let cellStart = 0; cellStart < totalSixteenths; cellStart += 16, bar++) {
    const isLastBar = cellStart + 16 >= totalSixteenths;
    const targetChord = isLastBar && nextChord ? nextChord : chord;
    events.push(...smartWalkBarEvents(chord, targetChord, bar, cellStart, totalSixteenths, placement, pointer));
  }
  return events;
}

/**
 * Runs the walk across the whole progression rather than placement-by-placement,
 * since the two things that make it "smart" — approaching the next chord change,
 * and keeping octave choices smooth — both need to see past a single placement's
 * own boundary. Placements are sorted by startBeat first because the walk needs a
 * real left-to-right chord sequence, not insertion order. "Next" only counts as
 * real lookahead when the following placement starts exactly where this one ends
 * (same adjacency rule tumbaoEvents uses) — across a gap, a bar just walks back to
 * its own root instead of reaching for a chord that isn't actually coming next.
 */
function smartWalkAllEvents(placements: ChordPlacement[], key: string, scale: ScaleName, factor: number): BassEvent[] {
  const sorted = [...placements].sort((a, b) => a.startBeat - b.startBeat);
  const events: BassEvent[] = [];
  if (sorted.length === 0) return events;

  const firstChord = resolveSelection(key, scale, sorted[0].selection);
  const pointer = { midi: Tone.Frequency(chordTones(firstChord, BASS_OCTAVE)[0]).toMidi() };

  for (let i = 0; i < sorted.length; i++) {
    const placement = sorted[i];
    const chord = resolveSelection(key, scale, placement.selection);
    const next = sorted[i + 1];
    const nextChord =
      next && next.startBeat === placement.startBeat + placement.lengthBeats
        ? resolveSelection(key, scale, next.selection)
        : null;
    events.push(...withTimeFeel(placement, factor, (vp) => smartWalkPlacementEvents(chord, nextChord, vp, pointer)));
  }
  return events;
}

/**
 * Applies half/double time by generating against a *virtual* placement — same start,
 * length scaled by `factor` — then rescaling each resulting event's absolute beat
 * back down into the real placement's actual (unchanged) span. Generating against a
 * scaled-but-still-integer-beat virtual placement (rather than feeding fractional
 * beats straight into a generator) keeps every existing rule's `beat % 4` bar-relative
 * logic working correctly — they never need to know time-feel exists at all.
 */
function withTimeFeel(
  placement: ChordPlacement,
  factor: number,
  generate: (virtualPlacement: ChordPlacement) => BassEvent[],
): BassEvent[] {
  if (factor === 1) return generate(placement);
  const virtualPlacement: ChordPlacement = {
    ...placement,
    startBeat: 0,
    lengthBeats: Math.max(1, Math.round(placement.lengthBeats * factor)),
  };
  return generate(virtualPlacement).map((event) => ({
    ...event,
    time: beatToTime(placement.startBeat + parseBeat(event.time) / factor),
  }));
}

export function scheduleBass(
  placements: ChordPlacement[],
  key: string,
  scale: ScaleName,
  rule: BassRule | null,
  pattern: BassPattern | null,
  timeFeel: TimeFeel = 'normal',
): void {
  ensureSynth();
  const factor = timeFeelFactor(timeFeel);

  const events: BassEvent[] = [];
  if (pattern) {
    const totalBeats = placements.reduce((sum, p) => sum + p.lengthBeats, 0);
    if (pattern.bars * 4 === totalBeats) {
      // A finished, already-composed bassline played back verbatim — time-feel
      // doesn't apply, same reason transposition doesn't either (see the doc comment
      // on wholeProgressionEvents).
      events.push(...wholeProgressionEvents(placements, pattern));
    } else {
      for (const placement of placements) {
        const chord = resolveSelection(key, scale, placement.selection);
        events.push(...withTimeFeel(placement, factor, (vp) => patternEvents(chord, pattern, vp)));
      }
    }
  } else if (rule && rule.style === 'smart-walk') {
    // Needs the whole progression at once (chord-change lookahead + a continuous
    // register pointer), not the per-placement loop below — see smartWalkAllEvents.
    events.push(...smartWalkAllEvents(placements, key, scale, factor));
  } else if (rule) {
    for (const placement of placements) {
      const chord = resolveSelection(key, scale, placement.selection);
      if (rule.style === 'tumbao') {
        const next = placements.find((p) => p.startBeat === placement.startBeat + placement.lengthBeats);
        const nextChord = next ? resolveSelection(key, scale, next.selection) : null;
        events.push(...withTimeFeel(placement, factor, (vp) => tumbaoEvents(chord, nextChord, vp)));
        continue;
      }
      if (rule.style === 'root-fifth-pump') {
        events.push(...withTimeFeel(placement, factor, (vp) => rootFifthPumpEvents(chord, vp)));
        continue;
      }
      if (rule.style === 'tunisia-vamp') {
        events.push(...withTimeFeel(placement, factor, (vp) => tunisiaVampEvents(chord, vp)));
        continue;
      }
      events.push(
        ...withTimeFeel(placement, factor, (vp) => {
          const beatEvents: BassEvent[] = [];
          for (let beat = 0; beat < vp.lengthBeats; beat++) {
            const note = noteForBeat(chord, rule, beat);
            if (note) beatEvents.push({ time: `0:${vp.startBeat + beat}:0`, note, duration: '4n', velocity: 0.8 });
          }
          return beatEvents;
        }),
      );
    }
  }

  part = new Tone.Part<BassEvent>((time, event) => {
    synth!.triggerAttackRelease(event.note, event.duration, time, event.velocity);
  }, events).start(0);
}

export function disposeBass(): void {
  part?.dispose();
  part = null;
  // See disposeKeys's comment — an already-scheduled note's release time is baked
  // into the Web Audio graph at trigger time, so force-release the active voice too.
  // Sampler's triggerRelease needs to know which note(s) to release (it's
  // polyphonic-capable, unlike MonoSynth/PluckSynth) — releaseAll sidesteps
  // having to track that for what's always single-note-at-a-time content anyway.
  if (synth instanceof Tone.Sampler) {
    synth.releaseAll();
  } else {
    synth?.triggerRelease();
  }
}
