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
- Instruments are Tone.js synths (`Tone.Synth`, `Tone.MembraneSynth`, `Tone.PolySynth`,
  `Tone.MonoSynth`, `Tone.FMSynth`, `Tone.MetalSynth`, `Tone.NoiseSynth` — different lanes use
  whichever fits), not sample libraries — sounds "demo-y" but avoids sourcing/licensing sample
  content. See "Planned: sample-based drum playback" below for the one place this is actively
  being moved toward real samples.
- `midi-file` for parsing imported `.mid` files (drum/bass/melody).

## Current shape
- **Chord grid** (`components/ChordGrid.tsx`) — a 48-bar (12 rows × 4 bars) drag/drop lead-sheet
  page, not a text field. Chord symbols sit above a real 5-line staff per row; row 0 also carries
  the clef, a computed key signature, and the 4/4 time signature (see `data/progressions.ts`'s
  `keySignatureAccidentals`). Placements support multi-row spans, resize/move/select/copy-paste,
  a scrubbable playhead, and a draggable loop range (rendered as 𝄆/𝄇 repeat-barline glyphs, not
  the exact loop beat — see the row's edge, not mid-measure).
- **Sheet header** (`components/SheetMusicHeader.tsx`) — real-book-style masthead: tempo
  (left)/title (centered, underlined)/author (right, wraps in a `<textarea>` — a single-line
  `<input>` cannot wrap its own text, learned that the hard way), all caps, over its own blank
  staff aligned with the grid's.
- **Drums/bass/keys** — each has multiple selectable styles (`data/drumLibrary.ts` loads
  `.mid` files from `data/drumPatterns/`; `data/bassLibrary.ts` similarly from
  `data/bassPatterns/`; keys styles are rule-based, defined in `data/instrumentStyles.ts`), each
  with its own instrument/timbre variant and half/double time-feel option. MIDI files can also
  be imported live (`components/MidiUpload.tsx` + `data/midi{Drum,Bass}Import.ts`).
- **Melody** — a MIDI-importable, fixed (not chord-derived) line: `data/melody.ts` (data model +
  pitch→staff-position math), `data/midiMelodyImport.ts` (import), `audio/melody.ts` (playback),
  rendered as noteheads/ledger lines/accidentals directly on the grid's staff. See the "How
  melody notation works" section below for the actual mechanics.
- **Mixer** (`components/ChannelStrip.tsx` + `App.tsx`) — per-track volume/mute for drums (with
  a per-voice sub-mix popout: kick/snare/rim/hihat×3/ride/ride bell/crash/toms), bass, keys
  ("Harmony"), melody, and metronome, plus master. Collapsible sidebar (`layout-sidebar`) so the
  grid can claim more width on smaller screens.
- **Song presets** — `data/songPresets.ts` + `data/songPresets/*.json`. A preset captures
  key/scale/tempo/loop range/styles/instruments/placements and optionally an embedded custom
  drum pattern and/or melody. Loaded eagerly via `import.meta.glob`; adding a new bundled song is
  just dropping a new JSON file there (must pass `isSongPreset`'s shape check).

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
- No mobile-specific UI work.
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

## Planned: sample-based drum playback
The drum engine (`audio/drums.ts`) has one lane per physical sound source — kick, snare, rim,
hihat (closed/open/foot), ride, ride bell, crash, and three tom pitches (see `DrumVoice` in
`data/instrumentStyles.ts`) — each currently a placeholder synth. Real samples are the next step
for these specifically (bass/keys are pitched, multi-sample instruments — a separate, bigger
undertaking; drums are one-shots, the cheap win). **Not yet wired up** — `audio/drums.ts` still
has no `Tone.Player` usage, despite converted sample files having existed at points during
development. Plan, once sample files exist:

- **Location/naming:** `src/data/drumSamples/`, one short one-shot per lane per instrument
  variant (Acoustic/Electronic), filenames matching `DrumVoice` + variant
  (`kick-acoustic.wav`, `hihat-open-electronic.wav`, etc.). No pitch-mapping needed — unlike
  bass/keys, each lane is a single unpitched sound.
- **Format:** short WAV, not MP3 or AIFF — these are all sub-second transients, MP3 compression
  artifacts are most audible on exactly that kind of sharp attack, and note that **Ableton's own
  "compressed" AIFC pack samples use a proprietary codec (`able` fourCC) that only Ableton itself
  can decode** — ffmpeg and everything else will fail on them with a "could not find COMM tag"
  error. Use Ableton's "Collect All and Save" to get real, standard PCM copies first.
- **Licensing gut-check before committing:** sample files sourced from a commercial pack
  (Ableton factory content, etc.) are typically fine to use *in a production*, but redistributing
  the raw sample files themselves in a public repo is a different question the pack's license
  may not clearly cover — worth resolving explicitly before committing `drumSamples/`, not
  silently included in a routine commit.
- **Tone primitive:** `Tone.Player`, not `Tone.Sampler` — Sampler is for pitched, multi-note
  instruments (the bass/keys case later); one-shot unpitched hits want a plain Player per lane,
  connected the same way the current synths connect to each lane's `Tone.Volume` node. Velocity
  becomes a per-trigger volume offset rather than a native velocity-sensitive envelope — fine for
  v1; per-lane velocity-layered samples (soft/hard variants) would be the natural upgrade later.
- **Loading:** `Tone.Player` loads its buffer asynchronously, unlike the synths it replaces
  (ready the instant they're constructed) — preload every drum sample eagerly at module load
  (mirroring how the bundled `.mid` patterns are already loaded via `import.meta.glob`), and
  accept that a Play click in the first instant before load completes might land silently.
  `Tone.loaded()` is the escape hatch for a real "ready" gate if that gap ever actually matters.

## Planned: in-browser MIDI editor
Melody is currently import-only — no way to program a line by hand, only drop in a `.mid` file.
A real editor is a genuinely bigger job than it sounds: comparable in scope to what
`ChordGrid.tsx` itself already is (400+ lines of drag/resize/move/select/clipboard logic), just
extended to a 2D pitch-and-time surface instead of chords' 1D time-only placement — clicking to
add a note needs both a beat position (already solved, see `clientPosToGlobalBeat`) and a pitch
(new: inverse of `staffStepsAboveBottomLine`, mapping a Y coordinate back to a MIDI pitch).
Worth treating as its own scoped effort, not bundled into a smaller task.

## Planned: drum fills into section starts
Every section marker (see `data/sections.ts`) now gets a crash on its downbeat — `audio/drums.ts`'s
`scheduleDrums` takes an optional `sections` param and layers a `Tone.Part` of one-off crash hits
(scheduled at each section's absolute `startBeat`) on top of the main repeating pattern `Tone.Loop`,
the same "events scheduled against absolute song position" mechanism bass/keys already use per-chord.
The main Loop itself has no concept of song position at all (just its own step counter modulo the
pattern length), which is why this needed a second, independent part rather than a tweak to the loop.

Still just the crash half of the idea — the more useful half, a short drum fill in the bar *leading
into* a section change, isn't implemented. The hard part isn't the scheduling (same mechanism, just
scheduled a bar earlier) but where the fill itself comes from: there's no "fill" concept anywhere in
the pattern data today, and a genuinely good-sounding fill isn't something worth trying to generate
algorithmically. The honest move would be one fixed, hand-authored placeholder fill (e.g. a
descending tom run into the crash) rather than a fill "engine" — consistent with this file's
placeholder-first philosophy elsewhere (see the synth voices note above).

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

## Direction: what this app needs next
Asked-and-answered product question, worth keeping around since it'll come up again. Given how
much of the recent work went into looking/feeling like a real fake book (staff notation, key
signatures, MIDI melody import) rather than into export/production tooling or pedagogy, **jam/
practice aid** is the natural next identity to lean into — it's the shortest path from the
current shape, versus retrofitting this into a demo maker (needs audio export, song-structure/
arrangement, better instrument quality) or a music theory teacher (needs genuinely new
pedagogical features — scale/chord-tone highlighting, ear training — that nothing here currently
hints at).

Highest-leverage next pieces, in order:
1. **Finish sample-based drums** (see above) — the biggest remaining gap between "looks real"
   (the notation work) and "sounds real" for something you'd actually want to jam along to.
2. **The in-browser MIDI editor** (see above) — program a head to play/comp against, not just
   import one.
