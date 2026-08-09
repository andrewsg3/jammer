# Backing Track Generator — Project Guide

## What this is
A web app for guitarists/musicians to build a chord progression and hear it played back by
a full band (drums, bass, keys/pads, optional melody) in any key, tempo, and style — rendered
as an actual lead sheet (staff, clef, key/time signature, chord symbols) rather than a plain
form. Portfolio piece. Long past its original v0 scope — see "Current shape" below for what's
actually here now.

## Stack
- **Vite + React + TypeScript.**
- **Tone.js** for scheduling and playback (Web Audio under the hood). No backend — everything
  runs client-side. No user accounts; song presets persist as downloadable/importable JSON
  files, not localStorage.
- Instruments are a mix now, not purely Tone.js synths — real samples for the instrument variants
  where it mattered most (Acoustic Piano keys via `Tone.Sampler`, `data/pianoSamples.ts`; Upright
  and Electric bass via `Tone.Sampler`, `data/bassSamples.ts`; the Acoustic drum kit via one
  `Tone.Player` per lane, `data/drumSamples.ts`), `Tone.Synth`/`Tone.MembraneSynth`/
  `Tone.PolySynth`/`Tone.MonoSynth`/`Tone.FMSynth`/`Tone.MetalSynth`/`Tone.NoiseSynth` patches for
  everything else (every other keys/bass timbre, the Electronic drum kit). Avoids sourcing/
  licensing sample content wholesale while still sounding real where it's most noticeable. See
  "Current shape" below.
- `midi-file` for parsing imported `.mid` files (drum/bass/melody).

## Current shape
- **Chord grid** (`components/ChordGrid.tsx`) — a 48-bar (12 rows × 4 bars) drag/drop lead-sheet
  page, not a text field. Chord symbols sit above a real 5-line staff per row; row 0 also carries
  the clef, a computed key signature, and the 4/4 time signature (see `data/progressions.ts`'s
  `keySignatureAccidentals`). Placements support multi-row spans, resize/move/select/copy-paste,
  a scrubbable playhead, and a draggable loop range (rendered as 𝄆/𝄇 repeat-barline glyphs, not
  the exact loop beat — see the row's edge, not mid-measure). Chromatic chords can carry an
  optional slash bass note (`Chord.bass`, `ChordSelection`'s chromatic variant `bassOffset` —
  both offsets from the key, not absolute note names, so they transpose correctly) — e.g. "D7/F#".
  Only the bottom note changes for playback: `progressions.ts`'s `bassRootNote()` is what bass.ts
  and keys.ts's bossa-nova/blues-shuffle "root" hits use instead of `chord.root`, while every
  voicing's 3rd/5th/7th still comes from the chord's real root/quality. Picked via the second
  dropdown next to Chromatic's quality picker in `ChordPalette.tsx`.
- **Sheet header** (`components/SheetMusicHeader.tsx`) — real-book-style masthead: tempo
  (left)/title (centered, underlined)/author (right, wraps in a `<textarea>` — a single-line
  `<input>` cannot wrap its own text, learned that the hard way), all caps, over its own blank
  staff aligned with the grid's.
- **Drums/bass/keys** — each has multiple selectable styles (`data/drumLibrary.ts` loads
  `.mid` files from `data/drumPatterns/`; `data/bassLibrary.ts` similarly from
  `data/bassPatterns/`; keys styles are rule-based, defined in `data/instrumentStyles.ts`), each
  with its own instrument/timbre variant (some sample-based — Acoustic Piano, Upright/Electric
  bass, the Acoustic drum kit — most still synths, see "Stack" above) and half/double time-feel
  option. MIDI files can also be imported live (`components/MidiUpload.tsx` +
  `data/midi{Drum,Bass}Import.ts`).
- **Melody** — a MIDI-importable, fixed (not chord-derived) line: `data/melody.ts` (data model +
  pitch→staff-position math), `data/midiMelodyImport.ts` (import), `audio/melody.ts` (playback),
  rendered as noteheads/ledger lines/accidentals directly on the grid's staff. See the "How
  melody notation works" section below for the actual mechanics.
- **Mixer** (`components/ChannelStrip.tsx` + `App.tsx`) — per-track volume/mute for drums (with
  a per-voice sub-mix popout: kick/snare/rim/hihat×3/ride/ride bell/crash/toms), bass, keys
  ("Harmony"), melody, and metronome, plus master. Collapsible sidebar (`layout-sidebar`) so the
  grid can claim more width on smaller screens.
- **Song presets** — `data/songPresets.ts` + `data/songPresets/*.json`. A preset captures
  key/scale/tempo/loop range/styles/instruments/per-track time-feel/placements and optionally an
  embedded custom drum pattern and/or melody. Loaded eagerly via `import.meta.glob`; adding a new
  bundled song is just dropping a new JSON file there (must pass `isSongPreset`'s shape check).
- **Mobile companion view** (`components/MobilePlayer.tsx`) — a separate, playback-only view for
  phones, picked in `main.tsx` by viewport width/pointer type (`?view=mobile`/`?view=desktop`
  forces either). Deliberately can't build or edit a progression — only plays a bundled preset:
  song picker, a minimal beat-grid lead sheet (bars-per-row, blank cells for a held chord's
  duration, a "%" mark for a bar that repeats the previous one, real-book-style boxed section
  markers), a full-screen "now playing" mode with a beat countdown next to the current chord and
  the next chord/duration shown smaller beneath it, and a settings modal (per-track volume,
  notation style, a user-pickable accent color). Shares the same audio engine as desktop
  (`audio/engine.ts`) — nothing about playback itself is mobile-specific, only the UI around it.
  Volume/accent-color/notation-style preferences persist across reloads via `localStorage` — the
  one deliberate exception to the no-storage stance above, scoped to UI prefs rather than song
  data (a manual pick, not the app silently remembering unrelated state).

## Fonts / notation rendering
- **Architects Daughter** (Google Fonts) — chord symbols and the sheet header text. Chosen over
  a cursive script for legibility on dense chord symbols (e.g. "F#m7b5"); has no bold weight, so
  nothing here fakes one (synthetic bold looks blurry on a handwriting-style font).
- **Noto Music** — self-declared `@font-face` in `index.css` with a `unicode-range` scoped to
  digits + the accidental symbols + the whole Musical Symbols Unicode plane (clef, repeat
  barlines). Deliberately *not* loaded broadly — it has full Latin coverage too, and without the
  range restriction it would hijack ordinary chord-symbol text. Its accidental glyphs also sit
  measurably below the font's own vertical center (checked against the actual glyf bounding
  boxes), hence the small manual `translateY` nudges next to each use.
- **Staff geometry** lives in `components/staffLayout.ts` (`STAFF_HEIGHT`, `STAFF_LINE_GAP`,
  and the key-signature accidental positions) — shared between `ChordGrid.tsx` and
  `SheetMusicHeader.tsx` so their staves always match exactly, without one importing the other
  (would be circular — `ChordGrid.tsx` renders `SheetMusicHeader`).

## How melody notation works
Deliberately **not** using a notation library (VexFlow etc.) — hand-rolled and approximate, not
aiming to nail every engraving rule (no beaming, no rhythm-accurate note-duration shapes, no
real key-signature-aware spelling). Good enough to look like a real book at a glance.

- **Data model** (`data/melody.ts`): `MelodyNote = { startBeat: number; midi: number;
  lengthBeats: number; velocity: number }` — absolute beat position (same coordinate space as
  `ChordPlacement.startBeat`), not tiled/transposed like bass patterns are; a melody is a fixed
  line composed against real chords, so there's nothing to re-derive per chord.
- **Pitch → staff position**: `spellPitch`/`staffStepsAboveBottomLine` split a MIDI pitch into a
  natural letter (diatonic step) plus an optional sharp — every black key is spelled as "the
  natural below it, sharp" (e.g. Eb renders as D#). Wrong in flat-heavy keys, cheap and always
  visually plausible. Middle C lands exactly one ledger line below the staff — the sanity check
  used when building this.
- **MIDI import** (`data/midiMelodyImport.ts`): real note-on/note-off pairing (unlike the drum/
  bass importers, which only care about note-on) since a melody's actual durations matter for
  both playback and rendering.
- **Playback** (`audio/melody.ts`): a single monophonic `Tone.Synth`, scheduled straight from
  the imported notes — no chord-tracking logic needed at all, unlike bass/keys.

## Explicit non-goals (still true)
- No AI/generative anything.
- No user accounts, no server-side anything.
- No editing on mobile — the mobile view (see "Current shape" above) is playback-only by design,
  not a scaled-down editor; building/editing a progression stays desktop-only, since the chord
  grid's drag/resize/select interactions don't translate to touch.
- No real notation engraving (beaming, rhythm-accurate note shapes, key-aware enharmonic
  spelling) — see "How melody notation works" above.
- No in-browser MIDI editor yet — melody is import-only. See "Planned" below.

## How to run
```
npm install
npm run dev
```

## Notes for whoever's iterating on this (me)
- Adding a drum/bass style: drop a new `.mid` file in `data/drumPatterns/` or
  `data/bassPatterns/` — no code change needed. A leading underscore (`_name.mid`) makes it
  loadable by name (for a song preset to reference) without cluttering the style picker.
- Adding a drum fill: drop a new short (one or half-bar) `.mid` file in `data/drumFills/` — same
  no-code-change convention, see "Drum fills into section starts" below. `data/drumFills/` is empty
  today, so every fill currently played is the one hardcoded `FALLBACK_FILL` in `audio/drums.ts`.
- Adding a keys style: add an entry to `keysStyles` in `data/instrumentStyles.ts` (voicing +
  rhythm combination).
- Adding a bundled song: drop a new `.json` file in `data/songPresets/` matching `SongPreset`'s
  shape (`isSongPreset` validates on load — invalid files are skipped with a console warning,
  not a crash).
- If the app feels robotic on loop repeats, the cheap win is light humanization: jitter velocity
  ±10%, occasionally vary a hi-hat pattern every 4 bars. Still not done, still cheap.
- Before committing/pushing: check `git status` for anything under `data/drumSamples/` or
  similar unreviewed binary assets — see the sample-based drums note below for why that
  directory in particular needs a licensing gut-check before it's ever committed.

## Sample-based drum playback (mostly done)
The drum engine (`audio/drums.ts`) has one lane per physical sound source — kick, snare, rim,
hihat (closed/open/foot), ride, ride bell, crash, and three tom pitches (see `DrumVoice` in
`data/instrumentStyles.ts`). The plan this section used to describe is now implemented for the
**Acoustic** kit: `ensureSynths()` builds a real `Tone.Player` per lane that has a matching file
(`data/drumSamples.ts`'s `getSampleUrl(voice, instrument)`, files at `src/data/drumSamples/*.wav`,
committed and licensing-cleared), preloaded eagerly the same way the bundled `.mid` patterns are;
any lane without a match falls back to its placeholder synth. The **Electronic** kit is still
100% synth — no `*-electronic.wav` files have been committed yet.

`src/data/drumSamples/_incoming/electronic/` currently holds four raw candidate samples (Kick,
Snare, two Hihats) — not yet converted to WAV (see the format note below), not yet reviewed for
licensing, and not yet wired into `getSampleUrl`. `_incoming/acoustic/` is empty (that kit's
samples already made it through this same pipeline and are committed for real). Finishing the
Electronic kit is: convert the remaining `_incoming/electronic/*.aif` files to WAV, decide on the
rest of the lanes it's still missing (rim/ride/ride bell/toms have no candidates at all yet), do
the licensing gut-check, and add them alongside the acoustic ones.

Notes that still apply to any new samples added here:
- **Format:** short WAV, not MP3 or AIFF — these are all sub-second transients, MP3 compression
  artifacts are most audible on exactly that kind of sharp attack, and note that **Ableton's own
  "compressed" AIFC pack samples use a proprietary codec (`able` fourCC) that only Ableton itself
  can decode** — ffmpeg and everything else will fail on them with a "could not find COMM tag"
  error. Use Ableton's "Collect All and Save" to get real, standard PCM copies first.
- **Licensing gut-check before committing:** sample files sourced from a commercial pack
  (Ableton factory content, etc.) are typically fine to use *in a production*, but redistributing
  the raw sample files themselves in a public repo is a different question the pack's license
  may not clearly cover — worth resolving explicitly before committing anything out of
  `_incoming/`, not silently included in a routine commit. This is exactly why `_incoming/` exists
  as a holding pen rather than samples landing straight in `drumSamples/`.

Velocity is a per-trigger volume offset on the `Tone.Player`, not a native velocity-sensitive
envelope — fine for now; per-lane velocity-layered samples (soft/hard variants) would be the
natural upgrade later, for any lane, not just Electronic.

## Planned: in-browser MIDI editor
Melody is currently import-only — no way to program a line by hand, only drop in a `.mid` file.
A real editor is a genuinely bigger job than it sounds: comparable in scope to what
`ChordGrid.tsx` itself already is (400+ lines of drag/resize/move/select/clipboard logic), just
extended to a 2D pitch-and-time surface instead of chords' 1D time-only placement — clicking to
add a note needs both a beat position (already solved, see `clientPosToGlobalBeat`) and a pitch
(new: inverse of `staffStepsAboveBottomLine`, mapping a Y coordinate back to a MIDI pitch).
Worth treating as its own scoped effort, not bundled into a smaller task.

## Drum fills into section starts (done)
Every section marker (see `data/sections.ts`) gets a crash on its downbeat *and* a real lead-in
fill in the bar before — not just extra hits layered over the groove, an actual interrupt: the main
pattern goes quiet for the fill's own window, the same way a drummer stops the beat to play a fill
and picks it back up after.

**Fill source** (`data/drumFills.ts`): bundled `.mid` files in `src/data/drumFills/` (empty today —
same "drop a file, no code change" convention as `data/drumPatterns/`, reusing
`midiDrumImport.ts`'s existing `parseMidiDrumBytes`). Each fill's `lengthBeats` is derived from its
own last hit rounded up to the nearest *beat*, not `parseMidiDrumBytes`' usual "rounded up to a full
*bar*" (right for a looping groove, wrong for a genuinely half-bar fill — that rounding would pad it
with dead space). No bundled fills exist yet, so every fill today is `drums.ts`'s `FALLBACK_FILL` —
the same one-bar tom run this app shipped with before real fills existed, just expressed in the same
`DrumFill` shape as a real one so the rest of the mechanism can't tell the difference. Loaded once at
module scope in `drums.ts` (like the sample maps) rather than threaded through
`engine.ts`/`App.tsx`/`MobilePlayer.tsx` — fills are an internal implementation detail, not a
user-selectable style.

**Scheduling** (`audio/drums.ts`'s `scheduleDrums`): per section (skipping any that start inside the
first bar — nothing to fill before beat 0), picks a random fill from whatever's bundled, computes its
window (`[section.startBeat - fill.lengthBeats, section.startBeat)`, clipped so it can't start before
beat 0), and schedules that fill's own hits via a `Tone.Part` (`sectionFillPart`) — same
"events scheduled against absolute song position" mechanism the crash cue (`sectionCrashPart`) and
bass/keys already use per-chord, since the main pattern `Tone.Loop` has no concept of song position
at all (just its own step counter modulo the pattern length).

**The actual interrupt**: the main Loop's callback checks a module-level `fillWindows` array (one
`{start, end}` range per section, rebuilt each `scheduleDrums()` call) before triggering its normal
pattern hits, converting its own `time` parameter to an absolute transport beat via
`Tone.Transport.getTicksAtTime(time) / Tone.Transport.PPQ` first. That conversion matters — a plain
mutable "is a fill playing right now" flag, flipped inside the fill Part's own callback, would have
been wrong: `Tone.Part`/`Tone.Loop` callbacks fire up to their lookahead window *before* the actual
audio-clock time they're scheduled for, so setting a flag synchronously inside the fill's callback
would have suppressed some of the main Loop's ticks that were genuinely scheduled to sound *earlier*
than the fill's real start. Comparing precomputed absolute-beat ranges against the *converted*
schedule time sidesteps that race entirely.

## Planned: sections + arrangement in song presets
Song presets currently store one flat `placements` array covering the whole timeline. When a
section repeats verbatim (e.g. Autumn Leaves' AABC form, where the two "A" sections are
identical chords), it has to be typed out twice in the JSON. The idea: a preset instead defines
each section once — a self-contained chord progression, no start/length stored on it at all,
since both are derivable (length from its own chords, start from its position in the play
order) — plus a separate `arrangement: string[]` listing what order the named sections play in,
repeats allowed.

**Scope, decided in advance:** file-format-only. The live chord grid, its drag/resize/move
editing, and `SectionMarker` rendering (`data/sections.ts`, `ChordGrid.tsx`) stay exactly as they
are — on load, sections+arrangement just expands into today's flat, independently-editable
placements, the same shape `resolvePlacementStarts` already produces. No live-linked/shared
section editing (editing one occurrence of a repeated section never touches another once
loaded), no new arrangement-reordering UI (hand-authored in the JSON for now, like sections
markers already are). Both explicitly ruled out to keep this a load/save-layer change rather
than a rebuild of the editor's core interaction model.

Sketch of the actual mechanism (`data/songPresets.ts`):
- New `SongPresetSectionDef = { label: string; placements: SongPresetPlacement[] }` — same
  placement shape/rules as today (`startBeat` optional, relative to that section's own start).
- `resolveArrangement(sections, arrangement)` (load-side): for each label in `arrangement`,
  resolve that section's own placements via the *existing* `resolvePlacementStarts` to get its
  local (0-based) chords + total length, then place that sequence at the running global cursor
  and advance it — producing both the flat placements and a derived `SectionMarker[]` in exactly
  the shape everything downstream already consumes.
- `deriveSectionsAndArrangement(placements, sections)` (save-side, the reverse): slice
  placements by each `SectionMarker`'s range, rebase to relative-startBeat, and dedupe
  identical `{label, placements}` containers across markers so a preset that already has
  repeated sections doesn't re-duplicate them on save — this is what actually delivers "don't
  retype A twice."
- `SongPreset`/`isSongPreset` accept **either** shape (new `sections`+`arrangement`, or today's
  flat `placements` + optional flat-marker `sections`) — existing bundled presets and anything
  already hand-authored keep loading unchanged indefinitely; only `handleSaveSongPreset` would
  start writing the new shape going forward.

Not started — shelved for now, no bundled presets migrated.

## Chord-scale suggestions and auditioning (done); AI trading-fours (planned)

Three related practice-aid ideas. The first two are done; the third is a much
bigger, and partly non-goal-conflicting, undertaking — see below.

**Suggest scales over chords (done).** `data/scaleSuggestions.ts`'s
`SCALE_SUGGESTIONS: Record<ChordQuality, ScaleName[]>` maps each chord quality to
the jazz-theory-standard scale(s) that fit it — e.g. Mixolydian for `dom7`, Dorian
for `min7`/`m6`, Lydian for `maj7sharp11`. Real constraint worth knowing: this
app's `ScaleName` only has the 7 diatonic modes of the major scale (see "Current
shape" above) — no melodic/harmonic minor, whole-tone, or diminished/octatonic
scales, which several qualities' actual textbook answer needs (altered dominants,
`aug`, `minMaj7`). Rather than force a wrong single-mode answer onto those, their
entry is an empty array — `ChordPalette.tsx`'s suggestions panel shows "no clean
fit in this app's scales" for those rather than a fabricated-sounding one. UI:
clicking/dragging any palette chord sets it as ChordPalette's own
`selectedChord` state, which drives a small panel above the palette rows
showing that chord's name plus a pill button per suggested scale.

**Audition different scales over chords (done).** `audio/engine.ts`'s
`auditionScale(chord, scale)`, a sibling to `auditionChord` — triggers a sustained
chord pad (one octave down, via `Tone.Sampler.triggerAttack`, no release) then
runs the scale's own notes (rooted on the chord's root, not the song's key —
`progressions.ts`'s new `scaleTones()`, same interval-table approach as
`chordTones`) up and back down over it via `Tone.now()`-relative one-shot
scheduling, independent of Transport/song playback, same as `auditionChord`. A
new scale audition releases whatever pad is still ringing from a previous one
first, so rapid clicking doesn't pile up sustained pads. Wired to each suggestion
pill button in the panel described above.

**Trading fours with an "AI" improviser using a predefined scale/style.** The most
ambitious of the three. Confirmed scope: no audio input at all — the bot doesn't
listen to what the human plays, it just alternates N-bar blocks on a fixed or
randomized pattern, going quiet (or leaving the backing track running solo) for
the human's blocks. Two design points from there:

- **Where the bot's notes come from**: a bank of short pre-written licks (small
  fixed melodic phrases, plausibly authored the same way fixed imported melody
  data already works — see `data/melody.ts`'s `MelodyNote[]`) transposed/fit to
  whatever chords are under that block, picked from at random or by pattern —
  plus, as a supplement or fallback where no lick fits, algorithmic generation
  constrained to a scale (same idea as the existing `BassRule`/`KeysRule`
  pattern-based accompaniment engines in `instrumentStyles.ts`, just producing a
  monophonic solo line instead of comping). Either way this stays "picks from
  pre-written phrases / picks notes algorithmically from a scale," not a trained
  model — worth keeping explicit given this file's "No AI/generative anything"
  non-goal above; "AI improviser" is really shorthand for "bot soloist," not
  actual AI.
- **Turn-taking cue**: reuse the beat-countdown pattern already built for
  `MobilePlayer.tsx`'s now-playing modal (`beatsUntilNextChord` et al.) — same
  mechanism, just counting down to "your turn" instead of "next chord."

The monophonic playback path this would ride on already exists too
(`audio/melody.ts`'s single `Tone.Synth`, same one fixed imported melodies use) —
the new pieces are the lick bank/generator, the random-or-pattern turn scheduler,
and the countdown cue.

## Direction: what this app needs next
Asked-and-answered product question, worth keeping around since it'll come up again. Given how
much of the recent work went into looking/feeling like a real fake book (staff notation, key
signatures, MIDI melody import) rather than into export/production tooling or pedagogy, **jam/
practice aid** is the natural next identity to lean into — it's the shortest path from the
current shape, versus retrofitting this into a demo maker (needs audio export, song-structure/
arrangement, better instrument quality). The mobile companion view (see "Current shape" above) is
the first concrete step actually taken in this direction, not just the theory of it.

The "or a music theory teacher" branch this section used to rule out (on the grounds that it
"needs genuinely new pedagogical features — scale/chord-tone highlighting, ear training — that
nothing here currently hints at") turned out to not hold — the chord-scale suggestion/auditioning
feature above *is* exactly that kind of pedagogical feature, just framed as a practice-aid tool
rather than a teaching mode. The two directions aren't as separate as this file used to assume.

Highest-leverage next pieces, in order:
1. **Finish the Electronic drum kit's samples** (see above) — most of "sample-based drums" is
   already done (Acoustic kit, real bass/piano samples); this is now a much smaller remaining
   task than it used to be, not a from-scratch undertaking.
2. **The in-browser MIDI editor** (see above) — program a head to play/comp against, not just
   import one. The biggest single undertaking on this list.
3. **AI trading-fours** (see above) — the scoping questions are answered; building it is a genuinely
   large effort (lick bank/generator, turn scheduler) on top of pieces that now all actually exist
   (monophonic playback, the countdown-cue pattern, scale-rooted note generation).
