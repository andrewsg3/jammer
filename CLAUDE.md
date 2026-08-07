# Backing Track Generator — Project Guide

## What this is
A web app for guitarists/musicians to generate a full-band backing track (drums, bass, keys/pads)
in any key, tempo, and genre, built from preset style patterns. Portfolio piece — should be small,
runnable in minutes, and easy to iterate on live.

## Stack
- **Vite + React** (JS or TS, TS preferred if quick to set up — don't burn time fighting types early on)
- **Tone.js** for scheduling and playback (Web Audio under the hood). No backend — everything runs
  client-side. No user accounts, no persistence beyond localStorage (optional, skip for v0).
- Sample instruments: start with Tone.js's built-in synths (`Tone.Synth`, `Tone.MembraneSynth`,
  `Tone.PolySynth`) rather than sourcing sample libraries — sounds "demo-y" but removes a huge
  time sink. Swapping in real samples later is a drop-in change, not a rewrite.

## Scope for v0 (do this, nothing more)
1. Chord progression input — simple text field, e.g. `Am F C G`, parsed into chord objects.
2. Genre preset picker — 3 genres max to start (e.g. rock, funk, blues-shuffle).
3. Key + tempo controls (key mostly just transposes the parsed chords; tempo drives Tone.Transport).
4. Play/stop button. Drums + bass + a simple keys/pad layer, looping the chord progression.
5. That's the whole v0. No mixer, no export, no genre editor UI, no multi-section song structure.

Resist scope creep — every genre, mixer knob, or export format is a v1+ feature. The goal is
"click play, hear a full band groove in the chosen key/tempo/genre" as fast as possible.

## Core data model
Single source of truth: **chord progression + genre preset**. Each instrument track reads from
this, not from each other.

```ts
type Chord = { root: string; quality: 'maj' | 'min' | 'dom7' | 'maj7' | 'min7'; };
type Progression = Chord[]; // one chord per bar, simplest case

type DrumPattern = {
  // fixed MIDI-style pattern, one bar, independent of chords
  steps: { time: number; note: 'kick' | 'snare' | 'hihat'; velocity: number }[];
  bars: number;
};

type BassRule = {
  style: 'root-fifth' | 'walking' | 'syncopated';
  // generates notes per-chord at render time, not fixed MIDI
};

type KeysRule = {
  voicing: 'triad' | 'power-chord' | 'seventh';
  rhythm: 'sustained' | 'comped';
};

type GenrePreset = {
  name: string;
  drums: DrumPattern;
  bass: BassRule;
  keys: KeysRule;
};
```

Drums are fixed loops (tempo-scaled, not pitch-scaled). Bass and keys are generated per-chord from
the progression at render/schedule time — this is the one part of the app with actual "logic" in
it; everything else is playback.

## Folder structure (keep flat, this is a small app)
```
src/
  App.tsx
  audio/
    engine.ts        // Tone.Transport setup, play/stop, scheduling
    drums.ts          // drum pattern playback
    bass.ts            // bass rule -> notes
    keys.ts            // keys rule -> notes
  data/
    progressions.ts   // parsing "Am F C G" -> Chord[]
    genrePresets.ts   // the 2-3 GenrePreset objects, hardcoded
  components/
    ChordInput.tsx
    GenrePicker.tsx
    TransportControls.tsx  // key/tempo/play-stop
```

## Explicit non-goals for v0
- No AI/generative anything (no "suggest a progression" feature — that's a different project).
- No real audio samples / sample libraries.
- No user-uploaded MIDI.
- No mobile-specific UI work.
- No genre "sliders" or parametrized style engine — hardcode genre presets, it's faster and
  the point of v0 is a working demo, not a scalable content pipeline.

## How to run
```
npm install
npm run dev
```

## Notes for whoever's iterating on this (me)
- If adding a genre: add a new `GenrePreset` object in `genrePresets.ts`. No other file should
  need to change — that's the test of whether the data model is actually doing its job.
- If the app feels robotic on loop repeats, the cheap win is light humanization: jitter velocity
  ±10%, occasionally vary a hi-hat pattern every 4 bars. Not needed for v0 but noted here so
  future-me doesn't forget it's an easy, high-impact next step.

## Planned: sample-based drum playback
The drum engine (`audio/drums.ts`) now has one lane per physical sound source — kick,
snare, rim, hihat (closed/open/foot), ride, ride bell, crash, and three tom pitches
(see `DrumVoice` in `data/instrumentStyles.ts`) — each currently a placeholder synth.
Real samples are the next step for these specifically (bass/keys are pitched,
multi-sample instruments — a separate, bigger undertaking; drums are one-shots, the
cheap win). Plan, once sample files exist:

- **Location/naming:** `src/data/drumSamples/`, one short one-shot per lane, filenames
  matching `DrumVoice` exactly (`kick.wav`, `hihat-open.wav`, `ride-bell.wav`, etc.).
  No pitch-mapping needed — unlike bass/keys, each lane is a single unpitched sound.
- **Format:** short WAV, not MP3 — these are all sub-second transients, and MP3
  compression artifacts are most audible on exactly that kind of sharp attack.
- **Tone primitive:** `Tone.Player`, not `Tone.Sampler` — Sampler is for pitched,
  multi-note instruments (the bass/keys case later); one-shot unpitched hits want a
  plain Player per lane, connected the same way the current synths connect to each
  lane's `Tone.Volume` node. Velocity becomes a per-trigger volume offset rather than
  a native velocity-sensitive envelope — fine for v1; per-lane velocity-layered
  samples (soft/hard variants) would be the natural upgrade later.
- **Loading:** `Tone.Player` loads its buffer asynchronously, unlike the synths it
  replaces (which are ready the instant they're constructed) — preload every drum
  sample eagerly at module load (mirroring how the bundled `.mid` patterns are
  already loaded via `import.meta.glob`), and accept that a Play click in the first
  instant before load completes might land silently. `Tone.loaded()` is the escape
  hatch for a real "ready" gate if that gap ever actually matters in practice.

## Planned: MIDI-programmable melody on the staff
`ChordGrid.tsx` already renders an empty 5-line staff per row (clef, lines, bar
divisions — see the `.staff` block and `STAFF_HEIGHT`/`STAFF_LINE_GAP` constants),
explicitly reserved for this. Deliberately **not** using a notation library
(VexFlow etc.) — hand-rolled, approximate, doesn't need to nail every engraving
rule (beaming, key-signature-aware spelling, rhythm-accurate note durations).
Good enough to look like a real book at a glance; not a music engraver.

- **Data model:** `MelodyNote = { time: number; pitch: number; duration: number;
  velocity: number }` — `pitch` as a raw MIDI note number (0–127), `time`/`duration`
  on the same `STEPS_PER_BAR` tick grid drums/bass already use (`instrumentStyles.ts`),
  so it lines up with the existing beat math for free. Lives alongside `BassPattern`/
  `DrumPattern` in `instrumentStyles.ts`, or a new `melody.ts` if it grows.
- **MIDI import:** a `midiMelodyImport.ts` mirroring `midiBassImport.ts`/
  `midiDrumImport.ts` — same `midi-file` parsing, same note-on/off → quantized-step
  pattern, just one (presumably monophonic) track instead of per-drum-voice lanes.
- **Pitch → staff position (the actual new part):** convert a MIDI pitch to a
  vertical offset in the same coordinate space as the 5 rendered staff lines
  (`top: i * STAFF_LINE_GAP` for i in 0..4). Treble clef reference: the bottom line
  is E4. Simplification that keeps this manual instead of needing real key-signature
  spelling: split each pitch into a *natural* (C/D/E/F/G/A/B → diatonic step 0–6,
  semitone offsets `[0,2,4,5,7,9,11]`) plus an optional sharp — any black key is
  always spelled as "the natural below it, sharp" (e.g. Eb renders as D#). Looks
  slightly wrong in flat-heavy keys but is visually correct and cheap. Diatonic
  step distance from the reference note × half a line-gap (4px, since each staff
  step — line to adjacent space — is half of `STAFF_LINE_GAP`) gives the y-offset;
  middle C (C4) lands exactly one ledger line below the staff, which is a good
  sanity check when implementing this.
- **Rendering:** notehead = small absolutely-positioned ellipse inside the existing
  `.staff` div, `left` computed the same percentage-of-row-width way the chord
  labels and barlines already are (`(time / BEATS_PER_ROW) * 100%`). Ledger lines
  are short horizontal segments drawn behind the notehead at each line-spacing
  interval beyond the staff edge, only when the note falls outside it. Sharps get
  a small "♯" glyph to the left of the notehead. Skip stems/beams/flags entirely
  for a first pass (every duration renders as the same plain notehead) — the
  cheapest partial upgrade later, if it's worth it, is open vs. filled noteheads
  for half-notes-or-longer vs. shorter, without ever building real beaming.
- **Playback:** `audio/melody.ts` mirroring `audio/keys.ts` — a monophonic
  `Tone.Synth` (not `PolySynth`, unless chords-within-the-melody-line turns out to
  matter) scheduled from the imported `MelodyNote[]` via `Tone.Frequency(pitch,
  'midi')`, same Transport-relative scheduling pattern as bass/keys.
- **Persistence:** an optional `melody?: MelodyNote[]` field on `SongPreset`
  (`songPresets.ts`), following the same "optional, old presets still load without
  it" convention already used for `customDrumPattern`.