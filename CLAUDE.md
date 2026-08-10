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
  spelling) — see "How melody notation works" above. **Reconsidered for export specifically** —
  see "VexFlow for printable/exported lead sheets" below.

## VexFlow for printable/exported lead sheets (idea, not scoped)
Revisits the "no real notation engraving" non-goal above, but scoped deliberately narrower than
"replace the hand-rolled renderer" — the idea is a **printable/exportable** lead sheet, generated
through VexFlow, sitting alongside the existing live editable grid rather than necessarily
replacing it.

**Why export is the natural scope, not the live view.** `ChordGrid.tsx`'s staff isn't just a
picture of notation — it's the live editing surface for drag/resize/select/copy-paste on chord
placements, a scrubbable playhead, a draggable loop range (rendered as repeat-barline glyphs), the
section-marker overlay, and now the melody editor (`melodyEditMode`, see "In-browser MIDI editor"
above) with click-to-place/drag-to-move notes directly on the rendered staff. VexFlow is an
engraving library, not an interaction framework — it renders notation, it doesn't host drag
gestures or click-to-edit on what it draws. Retrofitting all of that interactivity onto/into
VexFlow-rendered output would be a substantial rework with real risk of regressing everything
"Current shape" above describes as already working, for a payoff (nicer-looking *live* notation)
this app hasn't actually been missing. A **separate, static/printable export path** sidesteps all
of that: feed the same underlying data (`ChordPlacement[]`, `MelodyNote[]`, `SectionMarker[]`,
key/scale) into VexFlow's own note/voice/formatter API to produce a real-engraved, non-interactive
page — nothing about the live grid has to change at all.

**What VexFlow would newly deliver that the hand-rolled renderer explicitly doesn't** (see "How
melody notation works" above for why each was accepted as a trade-off, not an oversight): real
beaming, rhythm-accurate note-duration shapes (today's renderer only ever draws a notehead at
`startBeat`, never a length), and real key-signature-aware enharmonic spelling (today's
`spellPitch` always spells a black key as "the natural below it, sharp," regardless of key —
wrong in flat-heavy keys). All three are exactly the gaps "How melody notation works" lists as
*accepted*, not fixable-later — an export path is where fixing them for real would actually
belong, since export doesn't also need to stay live-editable the way the grid does.

**Hybrid chord symbols, not VexFlow's own text/annotation API.** This app's chord-symbol rendering
is a deliberate, already-documented choice — Architects Daughter specifically chosen over a plain
default for legibility on dense symbols like "F#m7b5" (see "Fonts / notation rendering" above).
The plan here is a hybrid: VexFlow owns the staff/clef/key-signature/noteheads/beaming, but this
app's own chord-symbol layer (same font, same positioning logic) renders as an overlay on top of
whatever coordinates VexFlow's formatter hands back for each measure/beat, the same way
`staffLayout.ts` today shares one set of staff-geometry constants between `ChordGrid.tsx` and
`SheetMusicHeader.tsx` so two independently-rendered staves still line up exactly — same idea,
just reconciling this app's own layout math against VexFlow's instead of against itself.

**Open question, not yet resolved:** whether "possibly the lead sheet view on desktop app" (as
raised) means export-only, or eventually swapping the *live* view's rendering to VexFlow too once
an export path proves the hybrid chord-symbol approach works. Given the interactivity risk above,
export-first with the live grid untouched is the safer order either way — a live-view swap, if
ever attempted, should come after, not alongside.

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
- **Attempted and reverted:** rhythmic variation for the "Smart Walking" bass style
  (`audio/bass.ts`'s `smartWalkBarEvents`) — beats 2/3 of each bar occasionally breaking from a
  plain quarter note into an eighth-note leading pair or an eighth-note triplet run, rolled
  randomly per bar, both still resolving onto the same harmonic target the straight quarter
  would have. Reverted after listening — didn't sound right, not narrowed down further (the
  probabilities/note choices were a first guess, never tuned by ear). If retried, worth trying a
  lower probability and/or restricting the triplet case to specific bars (e.g. only right before
  a chord change) rather than any bar 2/3, rather than assuming the mechanism itself was wrong.

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

## Attributions & references
Consolidates the credits that used to live scattered across each sample file's own comment
(still there too — this is the one place to check all of them at a glance) plus non-code
resources worth remembering why they're relevant. Also surfaced in-app via the desktop Settings
modal's "Attributions" link (`components/AttributionsModal.tsx`) — that panel should stay in
sync with this list, not drift into its own separate copy.

**Samples:**
- **Acoustic Piano** (`data/pianoSamples.ts`) — Salamander Grand Piano by Alexander Holm,
  CC-BY 3.0 (http://freesound.org/people/sarulis/), specifically the pre-trimmed web-ready subset
  Tone.js's own team cuts for their examples/@tonejs/piano
  (https://github.com/Tonejs/audio/tree/master/salamander).
- **Upright Bass pizzicato** (`data/bassSamples.ts`) — Freesound, uploaded by "mtg" (Music
  Technology Group, Universitat Pompeu Fabra), Freesound IDs in the 354xxx range. The real
  note-by-note multisample (`UPRIGHT_MULTISAMPLE_URLS`) is what's actually wired up now; the
  original single-anchor sample (`UPRIGHT_SAMPLE_URLS`) stays exported as a fallback — see
  bass.ts's `buildSynth()` for the still-open per-file transient-trim caveat.
- **Electric Bass** (`data/bassSamples.ts`) — recorded directly, no external source to credit.
- **Acoustic Guitar** (`data/guitarSamples.ts`) — Freesound, uploaded by "harri", IDs 13699-13711.
  **License not yet verified/recorded here** — added and wired up without the licensing gut-check
  this file asks for elsewhere (see "Sample-based drum playback" above); needs the same check
  (and this entry filled in properly) before treating it as cleared.
- **Acoustic drum kit** (`data/drumSamples.ts`) — Ableton factory content; see "Sample-based drum
  playback" above for the licensing gut-check this app applies before committing anything sourced
  this way.

**Fonts** (see "Fonts / notation rendering" above for how each is actually used): Architects
Daughter and Noto Music, both via Google Fonts, both OFL-licensed.

**Reference resources:**
- https://standardrepertoire.com/pages/the-top-25-jazz-standards.html — referenced when picking/
  verifying which jazz standards to bundle as bundled `data/songPresets/*.json` presets.

## In-browser MIDI editor (done, v1)
Melody used to be import-only — no way to program a line by hand, only drop in a `.mid` file.
`ChordGrid.tsx` now has an "Edit Melody" toggle (`melodyEditMode`, in the section toolbar next to
"+ Section") that turns the staff itself into a note editor, editing whatever's currently in the
`melody` array in place — imported, hand-drawn, or empty, all the same underlying data, no
separate "imported vs. drawn" concept.

**Interaction model, as built:**
- **Click empty staff space** to add a note at the nearest eighth note / staff line-or-space.
  Snaps to a half-beat grid (`MELODY_SNAP_BEATS`) — finer than chord placements' whole-beat
  snapping (real melodic rhythm needs it), coarser than free placement (stays clickable with a
  mouse). New notes default to that same half-beat length.
- **Click a natural** to place one; **Shift+click** raises it a semitone (sharp) — a plain click
  alone can only reach the naturals, since a Y position alone only encodes the diatonic staff
  step, not an accidental (see `midiFromStaffSteps` in `data/melody.ts`, the inverse of the
  existing `staffStepsAboveBottomLine`). Same "natural below, sharp" spelling convention the
  rendering already used, just inverted.
- **Drag an existing note** to move it in time and pitch together; **held Shift while dragging**
  reaches the sharps the same way. A plain click with no drag just selects it.
- **Delete/Backspace** removes the selected note; **Escape** deselects. Single-note selection
  only (an index into `melody`, not a `Set` like chord placements use) — no multi-select, no
  copy/paste, no undo, in this v1.
- **Off by default**: while `melodyEditMode` is off (the normal state), the staff behaves exactly
  as it always did — clicking it scrubs the playhead. Turning editing on is what hands staff
  clicks to note placement/selection instead (`handlePlayheadScrubStart` explicitly excludes
  `.staff` while editing is on, mirroring how it already excludes chord labels/loop handles/
  section markers).

**Explicitly not in v1** (all real gaps, not deliberate non-goals — just cut for scope): no
note-duration/resize dragging (every new note is a fixed half-beat; existing notes' `lengthBeats`
can only change by deleting and re-adding); no multi-select or copy/paste for notes (chord
placements have both); no undo/redo; no velocity editing (every new note gets a fixed default);
no visual indication of a note's actual duration on the staff (rendering only ever drew a
notehead at `startBeat`, never a length, before or after this).

**Identity note:** `MelodyNote` has no persisted id (same as `SongPresetPlacement` before
`App.tsx` mints a runtime one) — editing uses the note's index in the `melody` array as its
identity for the duration of a drag/selection. Safe because nothing else mutates `melody`
concurrently; would need real ids if that stopped being true (e.g. notes gained multi-select).

**Considered next revision: a piano-roll editing surface, not click-on-staff (idea, not built).**
V1's interaction model above edits notes directly on the rendered staff — click near a line/space
to add a natural, Shift+click for a sharp, snapped to a fixed half-beat grid. The idea here is a
different *editing* front-end entirely: a sideways piano-roll (pitch as a vertical keyboard —
black/white key rows — time running horizontally, the standard DAW piano-roll layout) overlaid on
a **customizable** rhythmic grid (1/8, 1/8 triplet, 1/16, 1/16 triplet — a real subdivision picker,
not just finer straight-grid snapping), with the result translated into this app's existing
approximate staff rendering as a separate display step rather than editing the staff directly.
Worth noting because it would close several of v1's explicitly-cut gaps essentially for free:
- **Note-duration/resize dragging** — the biggest one. A piano-roll block's width *is* its
  duration; dragging its right edge to resize is the natural interaction there in a way it never
  was for a notehead click on a staff. V1 has no story for this at all (`lengthBeats` today can
  only change by delete-and-re-add).
- **Triplet subdivisions** — `MELODY_SNAP_BEATS` today is a single fixed straight-grid value;
  nothing in the current model has a notion of a triplet grid at all. A piano roll's grid is
  already just a rendering choice independent of the underlying beat math, so swapping in a
  triplet-spaced grid is mostly a rendering change, not a data-model one.
- **Pitch entry without the natural+Shift dance** — a piano roll's vertical axis is one row per
  semitone (with visual black/white key styling), so every pitch is directly clickable; the
  current natural-then-Shift-for-sharp scheme exists specifically because a staff Y-position alone
  only encodes a diatonic step, not an accidental (see `midiFromStaffSteps` in `data/melody.ts`) —
  a problem a piano roll doesn't have in the first place.

**What stays the same:** the underlying data model doesn't change at all — `MelodyNote` (`data/
melody.ts`) is already decoupled from its rendering, so a piano roll would just be a second editing
front-end producing the same `{startBeat, midi, lengthBeats, velocity}` shape v1 does, translated
back into the existing (still deliberately approximate — see "How melody notation works" above)
staff rendering as a read-only display step. The "not aiming to nail every engraving rule" non-goal
there is unaffected either way — a piano roll makes *editing* more precise, it doesn't obligate the
staff *display* to become rhythm-accurate engraving too (that's the separate, larger VexFlow idea
below).

**Possible connection to the per-section drum/bass/keys overlay idea above:** a piano-roll-plus-
customizable-grid editor is close to the generic shape a hand-drawn bassline editor would also
want (same pitch-vs-time grid, same drag-to-resize), and a drum lane editor is a structural cousin
of it too (fixed named lanes instead of continuous pitch, same time grid). Not the same feature —
melody is monophonic and chord-independent, drums/bass are polyphonic-lane and chord/section-aware
— but if both get built, sharing the underlying grid/drag-resize interaction code is worth
revisiting rather than building three independent editors from scratch.

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

## Sections + arrangement in song presets (done)
Song presets used to only store one flat `placements` array covering the whole timeline. When a
section repeats verbatim (e.g. Autumn Leaves' AABC form, where the two "A" sections are
identical chords), it had to be typed out twice in the JSON. Now a preset can instead define
each section once — a self-contained chord progression, no start/length stored on it at all,
since both are derivable (length from its own chords, start from its position in the play
order) — plus a separate `arrangement: string[]` listing what order the named sections play in,
repeats allowed.

**Scope, as built:** file-format-only, exactly as originally planned. The live chord grid, its
drag/resize/move editing, and `SectionMarker` rendering (`data/sections.ts`, `ChordGrid.tsx`)
are untouched — on load, sections+arrangement just expands into the same flat,
independently-editable placements shape `resolvePlacementStarts` always produced. No
live-linked/shared section editing (editing one occurrence of a repeated section never touches
another once loaded), no arrangement-reordering UI (hand-authored in the JSON, like section
markers already are).

The actual mechanism (`data/songPresets.ts`):
- `SongPresetSectionDef = { label: string; placements: SongPresetPlacement[] }` — same
  placement shape/rules as the flat shape (`startBeat` optional, relative to that section's own
  start).
- `resolveArrangement(sectionDefs, arrangement)` (load-side): for each label in `arrangement`,
  resolves that section's own placements via the existing `resolvePlacementStarts` to get its
  local (0-based) chords + total length, then places that sequence at the running global cursor
  and advances it — producing both the flat placements and a derived `SectionMarker[]`-shaped
  `sections` array in exactly the shape everything downstream already consumes. An arrangement
  entry naming an unknown section is skipped with a console warning, not a crash.
- `deriveSectionsAndArrangement(placements, sections)` (save-side, the reverse): slices
  placements by each section marker's range, rebases to a relative startBeat, and dedupes
  identical `{label, placements}` containers across markers so a preset that already has
  repeated sections doesn't re-duplicate them on save — this is what actually delivers "don't
  retype A twice." Two sections sharing a label but with *different* chords get disambiguated
  (`"A (2)"`) rather than merged. Only returns the arrangement shape when it can represent the
  chart losslessly — sections must tile the whole progression contiguously with no gaps/overlaps,
  and every placement must fit entirely within exactly one section; anything else returns `null`
  so the caller falls back to the flat shape rather than risk dropping or misplacing chords.
- `resolveSongPreset(preset)` is the one shared entry point both `App.tsx` and
  `MobilePlayer.tsx` use instead of reading `preset.placements`/`preset.sections` directly — it
  picks whichever shape a given preset actually stores.
- `SongPreset`/`isSongPreset` accept **either** shape (new `sectionDefs`+`arrangement`, or the
  original flat `placements` + optional flat-marker `sections`) — every existing bundled preset
  and anything hand-authored keeps loading unchanged indefinitely. `handleSaveSongPreset`
  (`App.tsx`) is the only place that started writing the new shape, and only when it applies
  (falls back to flat when there are no sections, or they don't cleanly tile the chart).

No bundled presets have been manually migrated to the new shape — they'll pick it up naturally
the next time each is re-saved through the app.

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

**"Audition any scale" modal (done).** The suggestions panel above is
deliberately narrow — only this app's own 7-mode `ScaleName` vocabulary, only the
qualities `SCALE_SUGGESTIONS` has a real answer for. The "🎵 Audition any
scale…" button (`ChordPalette.tsx`) opens a free-form companion: any of 12 roots
× all `ChordQuality` values for the chord, any of 19 scales from
`data/exoticScales.ts`'s `EXOTIC_SCALE_GROUPS` (grouped the same way
`QUALITY_GROUPS` groups chord qualities, into `<optgroup>`s — Diatonic Modes,
Minor & Major Variants, Symmetric & Altered, Pentatonic & Blues, Bebop) for the
scale, *and* an independently-pickable root for the scale itself — the chord and
the scale don't have to share a root (e.g. "E minor over Cmaj7"). Two labeled
sections (Chord, Scale) rather than one form, plus a single "▶ Audition (root)
(scale) over (chord)" button, not one button per scale — 19 always-visible pill
buttons was the first version, but doesn't scale (heh) now that the scale root
is independent too (19 scales × 12 roots = 228 combinations).

Audio-side, `audio/engine.ts`'s `auditionExoticScale(chord, scaleRoot,
intervals)` and `progressions.ts`'s new `notesFromIntervals(root, intervals,
octave)` generalize `auditionScale`/`scaleTones` to accept a raw semitone-interval
set and an independent root instead of one of this app's own `ScaleName`s — the
actual sustained-pad-plus-run playback mechanism (`runScaleAudition`, shared by
both `auditionScale` and `auditionExoticScale`) didn't need to change at all.
`EXOTIC_SCALES`/`ScaleName` are deliberately two separate, unrelated vocabularies
— `ScaleName` stays tied to key signatures/diatonic chord-building, so scales that
don't fit that model (whole-tone, both diminished scales, altered, pentatonics)
were never forced into it.

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

**Attempted and reverted: a pure algorithmic-generation version ("Jazzbot").**
Built and briefly shipped a scoped-down cut of the above — no lick bank, no
turn-taking cue, just an always-on "Jazzbot" toggle on the Melody track
(`data/jazzbot.ts`) that replaced the fixed/imported melody with an
algorithmically-generated line: alternating fixed 4-bar solo/rest blocks, notes
picked via a small-step random walk across each chord's `SCALE_SUGGESTIONS`
pool (or a `chordTones` arpeggio fallback). Pulled back out after listening to
it — it didn't sound right, and wasn't refined further to find out exactly why
(candidates, untested: the random walk has no phrasing/motif sense so it reads
as aimless rather than "soloing"; no rhythmic contour beyond
quarter/eighth-note coin-flips; landing on scale tones with no resolution logic
around chord changes). If this gets picked back up, the lick-bank approach
above (real short phrases, not generated-from-scratch notes) is probably the
one worth trying first — pure algorithmic generation is exactly the part that
didn't hold up.

**Considered and set aside: a trained model (chord progressions + transcribed solos) for solo
generation.** Come up in conversation as an alternative to the lick-bank/algorithmic approach
above. Real difference from everything else in this section: training a model on a corpus of
paired chords+transcribed solos is actual machine learning, not "picks from pre-written phrases /
picks notes algorithmically from a scale" — it runs straight into this file's "No AI/generative
anything" non-goal (see above) rather than skirting it. Three separate problems, not just the
principle of the thing:
- **Training data licensing.** Transcribed jazz solos are near-universally derivative of
  copyrighted recordings/compositions; a corpus large enough to train anything usable (something
  like the Weimar Jazz Database exists for *research* use, not redistribution-in-a-portfolio-app
  use) would need its own licensing gut-check, the same kind already done for sample audio (see
  "Attributions & references" above) but harder — there's no equivalent of a commercial sample
  pack's clear license terms for "solo transcriptions."
- **No backend, but also no free lunch client-side.** Training itself would happen offline either
  way (this app has no server to train on), but *inference* would need to ship a real model to the
  browser — feasible in principle (ONNX Runtime Web / TensorFlow.js, small enough sequence model),
  but a meaningfully different engineering surface from anything else here: a model file to bundle,
  a runtime dependency, tokenization/detokenization glue between MIDI-ish note sequences and
  whatever the model expects. Not a natural extension of `instrumentStyles.ts`'s rule-based
  pattern engines the way the lick-bank idea is.
- **Not actually needed for the stated goal.** The trading-fours feature's actual requirement is
  "sounds like a plausible bot soloist," which the lick-bank + scale-constrained-generation plan
  above is scoped to deliver without any of the above. A trained model would be a strictly bigger,
  riskier bet for the same end-user outcome.

Net: stays out of scope for the reasons "AI trading-fours" above already gives, just spelled out
here since it's a materially different (and bigger) idea than the lick-bank one, not a restatement
of it.

**Chord progression analyzer (considered, looks genuinely buildable — not on the roadmap yet).**
Distinct from every idea above in one important way: it's pure music theory / pattern-matching
over data the app already has, not generative anything, so it doesn't touch the "No AI/generative
anything" non-goal at all. Same UI shape either way — see "What harmony to detect" below for the
actual catalog of patterns this would need to recognize, worked out in more detail than a first
pass would need, on the theory that scoping the intelligence first is cheaper than re-deriving it
mid-implementation.

## Chord progression analyzer: what harmony to detect (design doc, not built yet)
The detector's real math is already half-available: every chord's root is stored as an offset
from the song's key (the same offset math `Chord.bass`/`ChordSelection`'s `bassOffset` already use
for slash-bass notes — see "Chord grid" in "Current shape" above), not an absolute note name, so
"is this root a fourth above the last one" or "what scale degree is this" is modular arithmetic on
numbers the app already has, not new data modeling. What's not built yet is the actual pattern
catalog — this section is that catalog, ordered from "always on" to "speculative stretch goal."

**Layer 0 — functional labeling (always computed, the foundation everything else sits on).**
Every chord gets a tonic/subdominant/dominant bucket (or a scale-degree Roman numeral) purely from
its own root's offset from the song's key — I/iii/vi read as tonic, ii/IV as subdominant, V/vii°
as dominant. This doesn't require any relationship to neighboring chords at all, unlike every
pattern below it, so it's the one thing that can always render even when nothing else matches.

**Layer 1 — cadential patterns (root motion + quality, the main event):**
- **ii-V-I (major)**: three consecutive chords, root motion descending a P4 (or ascending P5)
  twice, qualities min7 → dom7 → maj7/maj6. The canonical jazz cell — this is the pattern the
  whole feature exists for.
- **ii-V-i (minor)**: the minor-key cousin, and a genuinely separate check, not a quality-relaxed
  version of the major one — misreading a real minor ii-V-i as an incomplete major ii-V would be
  actively wrong, not just less precise. Same root motion, qualities min7b5 ("ii°") → dom7 →
  min7/min(maj7). Real jazz theory usually wants the V altered (b9/#9/#5) here — this app's chord
  model only has a plain `dom7` quality (see "Chord-scale suggestions" above for the same
  constraint already accepted elsewhere), so there's nothing to special-case: every dominant in
  this app already reads as the generic case altered dominants would specialize from.
- **Secondary dominants (V7/x)**: any dom7 chord whose root sits a P5 above (P4 below) the
  *next* chord's root, where that next chord ISN'T the song's actual tonic — e.g. in C major, an
  A7 resolving to Dmin7 is "V7/ii." Looser than ii-V-I: no preceding min7 required, just the
  dominant-to-target root relationship. Very common in real jazz charts, and a natural superset
  check to run wherever ii-V-I didn't already claim a match.
- **Tritone substitution**: a dom7 chord resolving *down a half-step* into its target instead of
  down a fourth (e.g. Db7 → Cmaj7 standing in for G7 → Cmaj7). Distinct, easy-to-detect root-motion
  signature (half-step resolution into the target) rather than a variant of the fourth-motion
  checks above — worth its own pass.
- **Backdoor ii-V (bIII-min7 → bVII7 → I)**: e.g. in C, Ebmin7 - Ab7 - Cmaj7. A real, idiomatic
  jazz cadence, but a bigger lift than the others — flagged as a stretch item within Layer 1, not
  core to a first pass.

**Layer 2 — root-motion-only, quality-agnostic (the loosest, most permissive check):**
- **Cycle of fourths/fifths runs**: 3+ consecutive chords whose roots each move a P4/P5 from the
  last, regardless of quality (classic example: "Autumn Leaves"' A section). This overlaps
  constantly with Layer 1 — a ii-V-I *is* a 3-chord cycle-of-fourths fragment with specific
  qualities layered on — so it only fires on a span Layer 1 didn't already claim (see precedence
  below), rather than double-labeling the same three chords two ways.

**Layer 3 — structural/positional, not just chord-to-chord (stretch, needs section data):**
- **Turnarounds** (I-vi-ii-V and its many substitution variants): recognizable less by local root
  motion and more by *where* they sit — short (~2 bar), near-tonic-to-V, right before a section
  repeat or ending. Needs `SectionMarker`/arrangement position info as an input, not just the
  chord list, unlike everything above — a meaningfully different kind of check, not just another
  entry in the same pattern table.
- **Modal interchange / borrowed chords** (stretch): a chord whose quality doesn't match what the
  song's own diatonic scale degree "should" produce, but does match the parallel minor/major's
  equivalent (e.g. a borrowed Fmin7 in C major). This app's `ScaleName` has no harmonic/melodic
  minor modeled at all (same gap `SCALE_SUGGESTIONS`' empty-array handling already accepts) — this
  would need its own small parallel-mode quality lookup table rather than reusing anything that
  exists today.

**Precedence, since these overlap heavily by design:** try Layer 1's most-specific checks first
(ii-V-I/ii-V-i, then tritone sub/backdoor, then secondary dominants for whatever's left), and only
fall back to Layer 2's generic cycle label for a root-motion run nothing more specific already
explained. Layer 0's functional label always renders regardless — it's a property of each chord,
not a competing match for a span. Layer 3 checks run independently and can legitimately overlap
Layer 1/2 labels (a turnaround is *built from* ii-V-I/cycle pieces, so both labels being present at
once is correct, not a bug).

**Still genuinely unresolved, same open questions as before:** ambiguous key centers (a ii-V can
plausibly resolve to more than one key, and picking a "best" one per window rather than always
assuming the song's overall key is the real implementation work here, not the root-motion math
itself), and how aggressively Layer 2's loose cycle check should fire before it starts feeling
like noise rather than insight.

**UI sketch (unchanged from the original idea):** a small annotation layer above/below the
affected chord blocks in `ChordGrid.tsx` (bracket + label, e.g. "ii–V–I in Bb") rather than a
separate panel — reads closest to how real lead sheets sometimes get theory-teacher pencil
annotations, and sits next to the existing chord-scale-suggestions panel (`ChordPalette.tsx`) as a
second, complementary pedagogical feature rather than a competing one.

## Per-section instrument arrangement + "[Track] mode" editing overlays (idea, not scoped)
Three related asks bundled as one: (1) let drums/bass/keys vary by section instead of one style
for the whole song, (2) let the user manually place content — pick a drum fill from a dropdown or
draw one, hand-draw a bassline/comp — instead of only ever picking from the pattern library, (3) a
consistent per-track editing overlay, skinned in that track's own color, for doing so. Splits into
pieces of very different size:

**1. Per-section style/pattern selection — the more foundational, more disruptive half.**
`drumStyle`/`bassStyle`/`keysStyle` are single top-level song settings today (`App.tsx`), and
`SectionMarker` (`data/sections.ts`) is explicit that it's "purely a visual/organizational aid:
nothing in playback reads this array at all" — sections don't drive scheduling anywhere yet except
the one exception carved out for fills (see below). Making drums/bass/keys vary by section means:
- A place to store per-section overrides — a `Record<sectionId, { drumStyle?, bassStyle?,
  keysStyle? }>`-shaped map is the natural fit, most likely living alongside the `sectionDefs`
  from "Sections + arrangement in song presets" above, since that's already the shape that ties a
  named section to its own self-contained content.
- Every scheduling function (`scheduleDrums` in `audio/drums.ts` and its bass/keys equivalents)
  currently schedules the *whole* timeline in one pass against one style. They'd need to become
  section-aware, switching pattern source at each section boundary. There's real precedent for
  "sections drive scheduling" — "Drum fills into section starts" already computes a per-section
  window and schedules a separate `Tone.Part` against it — just not yet for the main groove
  itself, which is still one continuous `Tone.Loop` with no concept of song position at all.

**2. Hand-drawn/placed content, not just picked from the library — the more novel half.**
- Drums: a crash + lead-in fill already happens automatically at every section start ("Drum fills
  into section starts", done) — this idea asks for *manual* control over that instead: pick a fill
  from a dropdown (of bundled `data/drumFills/*.mid`, the same library `data/drumFills.ts` already
  loads) or, further out, draw one directly. Closest existing precedent for "draw one directly" is
  the melody editor's click-to-place interaction model (see "In-browser MIDI editor" above), but on
  a percussion grid instead of a staff — no pitch axis, one row per `DrumVoice` lane instead
  (kick/snare/rim/hihat×3/ride/ride bell/crash/toms) — nothing like that grid shape exists in this
  app yet.
- Bass/keys: a bigger lift than drum fills, since existing bass/keys patterns are *rule-based*
  (`BassRule`/`KeysRule` in `instrumentStyles.ts`) — chord-relative, re-evaluated live against
  whatever chord is currently sounding, not a literal note list. A hand-drawn bassline would
  produce something closer to a fixed melody line (`MelodyNote[]`-shaped, see `data/melody.ts`)
  than another `BassRule`, meaning a hand-drawn section would need its own separate playback path
  (a fixed-note scheduler like `audio/melody.ts`'s single `Tone.Synth`, not `audio/bass.ts`'s
  chord-tracking one) coexisting with library-picked sections that still use the rule engine.

**3. The overlay UI itself — genuinely the cheapest, most reusable part.** This app already has one
precedent for "toggle a track into an edit mode that takes over the staff/grid": the melody editor
(`ChordGrid.tsx`'s `melodyEditMode`). A drums/bass/keys equivalent would follow the same shape — a
per-track toggle, its own edit surface, off by default so normal scrubbing/playback behavior is
preserved, coexisting with the existing library-picker UI rather than replacing it (a section with
no manual edits just keeps using its style pick, same as today). "Matches the colour of the
instrument" is close to free: each track already has its own `--track-accent` custom property
defined in `index.css` for its channel strip (drums `#e0803f`, bass `#3f8fe0`, keys/harmony
`#9f5fe0`, melody `#4fb06d`) — an overlay for any of them could reuse that same value directly
rather than picking new colors.

**Genuinely open questions, not yet resolved:**
- Whether per-section overrides fully replace "one style for the whole song" as the mental model,
  or layer on top of it as an opt-in per section (probably the latter — least disruptive to every
  existing song preset, which has no concept of this at all today).
- Whether a hand-drawn bass/keys line should still make harmonic sense when a section repeats with
  *different* chords (an arrangement repeating a section verbatim, per "Sections + arrangement"
  above, is exactly the case where this bites) — a fixed note line, unlike the rule engines, has no
  way to adapt to a different underlying chord the second time it plays.
- Whether drums needs its own lane-grid editor built from scratch, or whether the dropdown-only
  fill picker (much cheaper, reuses the existing bundled-fills library as-is) is enough on its own
  to satisfy most of what this idea is actually after.

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
2. **AI trading-fours** (see above) — the scoping questions are answered; building it is a genuinely
   large effort (lick bank/generator, turn scheduler) on top of pieces that now all actually exist
   (monophonic playback, the countdown-cue pattern, scale-rooted note generation, and now a real
   melody editor to build/audition licks against).

The in-browser MIDI editor that used to top this list shipped (v1) — see "In-browser MIDI editor"
above for what's covered and what's still cut for scope (note resize, multi-select, undo,
velocity editing).
