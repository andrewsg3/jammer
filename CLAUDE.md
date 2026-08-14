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
- **Edit grid** (`components/EditGrid.tsx`) — desktop's **Edit** view (see "Three desktop views"
  below for the other two, read-only ones, and the mode switcher itself) — a Hookpad-style
  column-per-beat grid, 8 bars per row × 6 rows (48 bars total), not a text field or staff. See
  "Edit view: the Hookpad-style grid" below for the full mechanics (loop row, diatonic melody rows,
  chord blocks, click-to-place). Chromatic chords can carry an optional slash bass note (`Chord.bass`,
  `ChordSelection`'s chromatic variant `bassOffset` — both offsets from the key, not absolute note
  names, so they transpose correctly) — e.g. "D7/F#". Only the bottom note changes for playback:
  `progressions.ts`'s `bassRootNote()` is what bass.ts and keys.ts's bossa-nova/blues-shuffle
  "root" hits use instead of `chord.root`, while every voicing's 3rd/5th/7th still comes from the
  chord's real root/quality. Picked via the second dropdown next to Chromatic's quality picker in
  `ChordPalette.tsx`.
- **Sheet header** (`components/SheetMusicHeader.tsx`) — real-book-style masthead: tempo
  (left)/title (centered, underlined)/author (right, wraps in a `<textarea>` — a single-line
  `<input>` cannot wrap its own text, learned that the hard way), all caps. Can render its own
  decorative blank staff below it (`showStaff`, for continuity with a staff-based grid below) —
  none of the three current views need this (`EditGrid.tsx` has no staff at all; Chord Grid/Lead
  Sheet pass `showStaff={false}` too), so all three currently pass it off.
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

## Beats per bar (Phase 1 done — chart/notation; Phase 2 done — accompaniment engines)
Time-signature support, scoped in two deliberately separate phases so the bigger, riskier half
(rewriting the accompaniment engines) didn't have to land before the chart itself could show
anything other than 4/4. **Simple meters only, always over a "4" denominator** — a preset with
`beatsPerBar: 6` renders/counts as 6/4, not the compound 6/8 a musician might otherwise expect;
this app has no notion of compound meter at all. Picker values: 3, 4, 5, 6, 7, 8, 9, 12 (not the
same list Hookpad itself uses — no 2, and 7/8 are added — picked to cover what a real chart is
likely to need without also promising compound-meter behavior the picker's own "/4" labels don't
deliver).

**Phase 1 (done).** `SongPreset.beatsPerBar?: number` (`data/songPresets.ts`, defaults to 4 for
every preset written before this existed) flows into a `beatsPerBar` prop on `ChordGrid.tsx`,
`BeatGridSheet.tsx`, and `App.tsx`'s own state (round-tripped through save/load, with a new
"Meter" picker in `TopBar.tsx` next to Key). Both grid components split the same fixed page-layout
constant (`BARS_PER_ROW = 4` bars per line, independent of meter — a chart still reads "4 bars per
line" in any time signature) from the *beat* math that actually varies:
`ChordGrid.tsx`'s `beatsPerRowFor`/`totalBeatsFor` and `BeatGridSheet.tsx`'s equivalent local
`beatsPerRow` computation replace what used to be hardcoded `BEATS_PER_ROW`/`TOTAL_BEATS`
constants, threaded through every beat↔pixel conversion, drag/resize/scrub handler, and the
staff's time-signature glyph (no longer hardcoded "4/4"). `MobilePlayer.tsx` reads `beatsPerBar`
straight from whichever preset is loaded (read-only there, like key/tempo display elsewhere in
that playback-only view) for its own `BeatGridSheet` instances and its count-in "(N bars)" label.
Existing chord *placements* aren't retimed by a meter change — they keep whatever `startBeat`/
`lengthBeats` they already had, so switching a loaded song's meter mid-edit just changes how the
same beats are grouped into bars/rows, not what's actually placed where.

**Metronome (done, not really "Phase 2").** `audio/metronome.ts`'s click accent (`scheduleMetronome`)
and count-in clicks (`playCountIn`) both now take a `beatsPerBar` param (threaded from
`PlaybackParams.beatsPerBar` in `audio/engine.ts`'s `play()`, itself passed from `App.tsx`/
`MobilePlayer.tsx`'s own `beatsPerBar` state) instead of hardcoding `% 4` — the downbeat accent
(`C6` vs `C5`) now lands on beat 1 of every bar in the song's actual meter. Small and
self-contained enough to land alongside Phase 1 rather than waiting on the real Phase 2 below —
it's just a click accent pattern, not a pattern generator with real musical content.

**Phase 2 (started, most of it now done; one piece deliberately deferred).** The accompaniment
engines' relationship to `beatsPerBar` splits into exactly two categories, and knowing which one a
given rule/pattern falls into is the actual design decision here — **this is the target pattern for
any future accompaniment work, not just what happened to get done first**:

1. **Pure algorithmic generation, no fixed internal timing** — a rule that only ever asks "what
   chord tone, how far into this placement" and never hardcodes a bar length, so making it read
   `beatsPerBar` is a real math change, genuinely meter-generic, no new musical content. **Fix:
   parameterize the math.**
2. **A real idiomatic figure with fixed sixteenth-note-level (or beat-level) internal timing** — a
   clave pickup, a comping accent tied to "beat 2 and 4," a stride that hardcodes `+= 4` — where the
   figure *is* a specific 4-beat performance, not an abstract shape. Stretching its fixed offsets to
   fit a different beat count was tried once, in spirit, for "My Favorite Things"'s keys rhythm (see
   the non-goals section below — abandoned, didn't sound right), and isn't attempted again anywhere
   below. **Fix: tag it `beatsPerBar: 4` (an optional field now on `DrumStyle`, `BassStyle`, and
   `KeysStyle` alike) and let the style picker (`App.tsx`'s `visibleDrumStyles`/`visibleBassStyles`/
   `visibleKeysStyles`) filter it out of the dropdown outside 4/4** — hidden-and-correct rather than
   offered-and-wrong. A style already selected keeps playing (and keeps sounding wrong) through a
   live meter change on any of the three tracks — no auto-reset, same accepted tradeoff on all of
   them, consistently.

Applying that split:
- **Category 1 — done.** `bass.ts`'s Smart Walking (`smartWalkBarEvents`/`smartWalkPlacementEvents`/
  `smartWalkAllEvents`): root on beat 1, a chromatic approach tone on the last beat, chord tones
  spread evenly across whatever beats fall in between — parameterizing it on `beatsPerBar` was just
  a math change. `beatsPerBar=4` reproduces the original fixed beat-2/beat-3 shape exactly (verified:
  `middleBeats = beatsPerBar - 2` gives the same two fractions, 1/3 and 2/3, landing on the same two
  sixteenth-offsets as before) — existing 4/4 songs are unaffected. `keys.ts`'s `sustained` rhythm
  ("Sustained 7ths" etc.), `comped`, and `arpeggio-up`/`arpeggio-updown` all turned out to already be
  in this category — no `% 4` or `+= 4` stride anywhere in their loops, just iterating the
  placement's own length — so no code change was needed for them at all, just leaving them untagged.
  **One real gap found and fixed after the fact**: being meter-generic isn't the same as being
  time-feel-generic. Half/double time-feel (`bass.ts`'s `withTimeFeel`) scales a placement's own
  beat count by 2x/0.5x, which has no clean meaning for an odd `beatsPerBar` — there's no way to
  evenly halve an odd number of beats into a whole virtual one (`Math.round(3 * 0.5) = 2`, not 1.5).
  Smart Walking's own per-bar cycle silently lost its last beat's content when that rounding came up
  short (confirmed by direct simulation: a single 3-beat placement at half-time in 3/4 drops the
  approach tone and leaves an audible gap on beat 2 — "plays on 1 and 3"). Fixed at the shared
  choke point rather than in Smart Walking specifically: `withTimeFeel` now takes `beatsPerBar` and
  clamps to normal time whenever it's odd, protecting every current and future bass rule that
  routes through it, not just Smart Walking. `App.tsx`'s bass channel strip also hides half/double
  from its own picker under an odd meter (`visibleBassTimeFeelOptions`, same "keep the current
  selection visible" exception the style pickers use) — but the `withTimeFeel` clamp is what
  actually holds the guarantee, since a preset's JSON can set an incompatible combination directly
  (the bundled "My Favorite Things" briefly did: `bassTimeFeel: "half"` in 3/4, since fixed before
  the clamp existed — corrected to `"normal"` once the clamp made the stored value inert but
  misleading). Deliberately **not** applied to drums or keys: drums' time-feel only changes a
  continuous loop's tick rate (no placement-length rounding at all), and keys' meter-generic
  rhythms (`sustained`/`comped`/both arpeggios) have no internal bar-reset logic either — neither
  can actually produce this bug, so gating them too would just hide a legitimately safe option.
- **Category 2 — done.** `bass.ts`'s Tumbao/Root-Fifth Pump/Tunisia Vamp (`tumbaoEvents`/
  `rootFifthPumpEvents`/`tunisiaVampEvents` — the clave pickup, the montuno cell, the vamp's
  ascending/descending arc) and `keys.ts`'s La Pompe, Charleston, Rising Sun, both Bossa Novas, both
  Blues Shuffles, and Virtual Insanity (all hardcode a `+= 4` bar stride, or `+= 8` for bossa nova's
  2-bar cycle, in `scheduleKeys`) are all tagged `beatsPerBar: 4` on their `BassStyle`/`KeysStyle`
  entries in `instrumentStyles.ts` and filtered out of the picker outside 4/4 by `App.tsx`'s
  `visibleBassStyles`/`visibleKeysStyles` — the same mechanism `visibleDrumStyles` already used for
  meter-mismatched drum grooves, below.
- **Drums are a third, structurally different case — not really "category 1 or 2," a style is either
  "None" or a real recorded/imported `.mid` groove (`DrumPattern`), never an algorithmic rule at all,
  so there's no math to parameterize even in principle.** A groove actually written in 4/4
  (kick-on-1-and-3 feel, etc.) just *is* a 4/4 performance; naively changing what `STEPS_PER_BAR`
  rounds its loop length to would either truncate real content or loop it at the wrong length,
  drifting against a non-4/4 chart's bars exactly the way an unconverted groove does today. The fix
  that actually works is a **new recording per meter**, not a formula — see `drumLibrary.ts`'s
  per-meter subfolder convention (`drumPatterns/<beatsPerBar>-4/`, tagging each loaded
  `DrumStyle.beatsPerBar`) and `App.tsx`'s `visibleDrumStyles`. No 3/4 (or other non-4/4) grooves are
  bundled yet — the mechanism is built, content isn't. This is where the `beatsPerBar`-tag-and-filter
  half of the pattern above actually originated, before bass/keys reused it for category 2.

**MIDI importer bar-rounding (done).** `DrumPattern`/`BassPattern` gained their own
`beatsPerBar?: number` (defaults to 4) — a pure bar *count* stays in `.bars`; `beatsPerBar` is the
conversion factor back to real beats/steps, resolved once at import time rather than assumed
globally. `instrumentStyles.ts`'s new `patternStepsPerBar(pattern)` helper (`(pattern.beatsPerBar ??
4) * STEPS_PER_BEAT`) replaces the old flat `STEPS_PER_BAR` constant everywhere a pattern's own
`.bars` gets converted back to steps: `midiDrumImport.ts`/`midiBassImport.ts`'s own bar-rounding math,
`drums.ts`'s `scheduleDrums`, and `bass.ts`'s `patternEvents`/`wholeProgressionEvents`/the
whole-progression-length heuristic in `scheduleBass`. This is a category-1 fix (pure math
parameterization, unlike Tumbao/Charleston above) — nothing here is a fixed idiom, it's just "how
many beats is one bar of this specific file."

Where the resolved `beatsPerBar` actually comes from, in priority order: **the file's own embedded
`timeSignature` meta event** (`midi-file` parses `numerator`/`denominator`; only trusted when
`denominator === 4`, per this app's simple-meters-only constraint — a compound-meter or
unsupported-denominator file falls through to the next option exactly like a file with no time
signature at all) → **a caller-supplied fallback hint** (the song's currently-loaded `beatsPerBar`,
for a live drum upload in `App.tsx`'s `handleMidiUpload`; the containing per-meter subfolder, for a
bundled file in `drumLibrary.ts` — `bassLibrary.ts` has no subfolder convention yet, so it has no
hint to offer and relies on the file's own declared meter or nothing) → **4**. `DrumStyle.beatsPerBar`/
`BassStyle.beatsPerBar` (the picker-filtering tag from the section above) are now *derived* from the
resolved `pattern.beatsPerBar` rather than set independently, so they can't silently disagree with
what the pattern's own step math actually does — and `drumLibrary.ts` `console.warn`s if a file's own
declared meter disagrees with the per-meter subfolder it's sitting in, since that's a real authoring
mistake (misfiled asset or mistagged folder) worth surfacing rather than silently picking one.

**Meter reflow for an existing progression (idea, not scoped, deliberately not attempted above).**
Everything in this section makes a song playable correctly *in whatever meter it's already in* —
it doesn't help retime an *existing* chart into a *different* meter (e.g. taking Autumn Leaves,
written in 4/4, and reworking it into 3/4). That's a genuinely separate, harder feature, and a
deliberate non-goal of the work above, not an oversight: `ChordPlacement.startBeat`/`lengthBeats`
are stored as absolute beats-from-song-start, which is the right model to keep — a chord lasting 2
beats is a fact about the music, independent of how those beats get grouped into bars for display
(that grouping is already correctly derived at render time from `beatsPerBar` — see
`beatsPerRowFor`/`totalBeatsFor` in `ChordGrid.tsx`). Changing the Meter picker today deliberately
leaves every placement's beats untouched, which is exactly right for *starting* a song fresh in a
given meter (how "My Favorite Things" was actually done) — the open problem is only "retime
something already written." And that's genuinely hard, not just unbuilt: there's no canonical
answer for where a chord that started on beat 3 of a 4-beat bar should land once bars are 3 beats
long — preserve total beat count and let barlines fall where they may (today's behavior, if the
picker were ever used this way), preserve bar count and stretch/compress content to fit, pad every
bar up to the new length, or hand-retime chord by chord are all different, equally defensible
answers, the same problem real notation software (Sibelius/Finale-style "reinterpret" tools) punts
to the user rather than solving generically. If ever built, this should be its own explicit,
opt-in transform — not a side effect of touching the Meter dropdown.

## Explicit non-goals (still true)
- No AI/generative anything.
- No user accounts, no server-side anything.
- No editing on mobile — the mobile view (see "Current shape" above) is playback-only by design,
  not a scaled-down editor; building/editing a progression stays desktop-only, since the chord
  grid's drag/resize/select interactions don't translate to touch.
- No real notation engraving (beaming, rhythm-accurate note shapes, key-aware enharmonic
  spelling) — see "How melody notation works" above. **Reconsidered for export specifically** —
  see "VexFlow for printable/exported lead sheets" below.
- **Compound meters (6/8, 9/8, 12/8) — out of scope.** See "Beats per bar" below for what *is*
  supported (simple meters, always over a "4" denominator).
- **Some accompaniment styles are still 4/4-only, and stay that way on purpose — see "Beats per
  bar" below.** Phase 2 turned most of the drums/bass/keys pattern generators meter-generic, but
  every style built around a real fixed idiomatic figure (a drum groove, Tumbao, Charleston, etc.)
  is tagged `beatsPerBar: 4` and hidden from the picker outside 4/4 rather than reparameterized —
  a deliberate, permanent design choice for that category, not a gap waiting to close. A cheap
  fake for a genuinely 3/4 tune ("My Favorite Things") — keep the chart in the 4/4 grid, but cycle
  one rhythm engine's own pattern in 3 beats instead of 4 — was tried and abandoned (didn't work,
  not narrowed down further) before Phase 1 existed, and is exactly the mistake the tag-and-filter
  approach exists to avoid repeating.

## Three desktop views: Edit / Chord Grid / Lead Sheet (both milestones done)
Desktop used to have one always-editable view (the old `ChordGrid.tsx`, a staff with drag/resize/
select chord placements and a click/drag melody editor) plus a little-used `compactGridView`
toggle that swapped it for `BeatGridSheet.tsx` (the same read-only cell chart `MobilePlayer.tsx`
uses). That's now three explicit, purpose-built modes, switched via a segmented control in
`TopBar.tsx` (`App.tsx`'s `viewMode: 'edit' | 'chordGrid' | 'leadSheet'`, persisted the same way
`compactGridView` used to be, with a one-time migration from that old boolean). **Editing chord
placements and melody notes is exclusive to Edit mode** — Chord Grid and Lead Sheet are read-only
views of the same underlying song, but playback (Play/Stop) and the full mixer (`ChannelStrip`
volume/mute/instrument/style pickers, a sibling panel outside whichever view renders — nothing
about it needed to change) work identically in all three.

- **Edit** — `EditGrid.tsx` (Milestone 2's Hookpad-style rebuild; the staff-based `ChordGrid.tsx`
  it replaced no longer exists — see below).
- **Chord Grid** — `BeatGridSheet.tsx`, unchanged since Milestone 1 (confirmed with the user
  directly: "Beat grid is perfect as-is"). Purely a re-gating of the exact JSX `compactGridView`
  used to render.
- **Lead Sheet** — `components/LeadSheet.tsx`, real engraved notation via VexFlow (`vexflow` in
  `package.json`). This is what used to be an unscoped export idea — built as a first-class in-app
  *view* instead, passive-only by the user's explicit choice (a playhead that follows playback, no
  click-to-scrub, no draggable loop range — matching Chord Grid's own restrained, non-interactive
  character rather than reproducing Edit's scrub/loop UI a third time).

## Edit view: the Hookpad-style grid (`EditGrid.tsx`, Milestone 2, done)
Replaced the old `ChordGrid.tsx` (a staff-based drag/resize/select editor, described in past-tense
detail further down this file's edit history) with a column-per-beat grid, per the user's own
description: *"Hookpad has a column for each beat, dividing lines between bars, 3 rows of cells:
top row is used to highlight beats to loop, middle row has 7 rows by default and is where diatonic
melodies can be programmed, bottom row has chord blocks."* Chord Grid and Lead Sheet were untouched
by this — only what renders for `viewMode === 'edit'` changed.

**Layout.** **8 bars per row** (`components/editGrid/gridMath.ts`'s `EDIT_BARS_PER_ROW`) — a fixed
choice for this grid specifically, independent of Chord Grid/Lead Sheet's own `BARS_PER_ROW = 4`
(now in `data/gridLayout.ts`, alongside the shared `GRID_BARS = 48`/`totalBeatsFor`, moved out of
the old `ChordGrid.tsx` so both grids can share the same whole-song beat coordinate space without
one importing the other). Each 8-bar "system" is one real CSS grid (`display: grid`, columns at
half-beat resolution — `COL_UNIT_BEATS = 0.5`, shared by melody and chords/loop alike so nothing
needs two coordinate systems), stacked six per song (`GRID_BARS / EDIT_BARS_PER_ROW`). Three
row-groups share that one grid rather than each owning its own: track 1 is the loop row, tracks
2-8 are the seven melody rows (top = scale degree 6, bottom = degree 0 — pitch-up-is-row-up), track
9 (+10 for a rare second lane) holds chord blocks. Bar lines are a `repeating-linear-gradient`
background on the system div, not per-cell DOM divs.

- **Loop row** (`components/editGrid/LoopRow.tsx`) — click-drag across empty cells to define the
  loop range from scratch; drag the 𝄆/𝄇 handles to adjust an existing range's edges. Also renders
  the (grid-row-spanning) playhead line and the section badges (A/B/C… — same `SectionMarker` CRUD
  as before, reusing `.section-marker-label`/`.section-marker-label-input`/`.section-marker-remove`
  styling from the old view but as real grid items rather than percentage-of-row absolute
  positioning).
- **Melody grid** (`components/editGrid/MelodyGrid.tsx`) — one visible octave, 7 diatonic rows.
  Plain click adds a note at the nearest half-beat on that row; **Alt+click (Option on Mac) nudges
  it +1 semitone** (a small "+" badge marks it chromatic). Only ever `+1`, not a signed nudge in
  either direction — proven sufficient for every `ScaleName` this app has: every mode is a rotation
  of the major scale's whole/half-step pattern, so an off-scale note always has exactly one
  chromatic neighbor, always equidistant from its two diatonic neighbors, and ties resolve toward
  the lower one (see `progressions.ts`'s `midiToScaleDegreePosition`, whose own `semitoneOffset`
  field is still a real signed value — the "always +1" behavior lives in the UI layer, not baked
  into the math, so it won't silently break if the scale vocabulary ever grows an unequal-gap
  mode). A register-shift control (▲/▼ in the section toolbar) moves which octave the 7 rows show;
  notes outside the visible octave don't render, but a small "▲N"/"▼N" hint next to the octave
  label shows how many exist off in each direction (display-only in v1 — not click-to-jump).
- **Chord row** (`components/editGrid/ChordRow.tsx`) — **click-to-place, not drag-and-drop-only**:
  clicking a palette chord (`ChordPalette.tsx`) no longer appends it anywhere by itself — it arms
  `App.tsx`'s `pendingChord` state (`onSelectionChange`, replacing the old `onAddChord`/
  `handleAddChordAtEnd`), and `ChordRow`'s own empty-cell click places it there via the same
  `onDropChord` primitive drag-and-drop already used. Staying armed after a placement (not
  auto-cleared) lets repeated clicks "stamp" the same chord across several cells, matching
  Hookpad's own behavior. Clicking an *occupied* cell instead runs the existing select/
  multi-select/shift-range logic; native drag-and-drop from the palette still works too, just
  reading its drop position off the new column math. Overlapping-in-time placements can't happen
  (unchanged `canPlace` invariant), but a short chord right before another in the same bar gets
  bumped to a second lane purely for label legibility (`laneChordSegments`'s crowd heuristic) — a
  system only grows a second chord-row track when something in it actually used that lane.

**Cross-system pointer math.** Drag gestures (move/resize a chord, move a section, drag a loop
handle, drag an existing melody note) need to resolve a mouse position to a beat/degree regardless
of which system's DOM the pointer is currently over — `EditGrid.tsx` does this via
`document.elementFromPoint` + `closest('.edit-grid-system')`/`closest('.melody-row')` (reading
`data-system-index`/`data-degree` attributes) rather than a single fixed-height wrapperRef the way
the old `ChordGrid.tsx` did — systems can have a variable chord-lane row count, so their heights
aren't uniform/predictable the way the old view's fixed `ROW_HEIGHT` was.

**A real bug this surfaced, now fixed:** entering a section's rename input on `mousedown` (so a
drag can start on the very first pointer-down, same as the old view) raced against the browser's
own default mousedown focus handling — `autoFocus` on the freshly-mounted `<input>` would focus it
during React's commit, then the browser's default mousedown post-processing would immediately blur
it again, firing the input's `onBlur` (`commitEditingSection`) before the input was ever visibly
interactive. Fixed the same way this class of bug is always fixed: `e.preventDefault()` in the
mousedown handler that triggers the focus swap, so the browser's own default focus/selection
handling for that mousedown never runs. Caught by driving the grid with Playwright and holding the
mouse down mid-gesture to inspect the DOM — invisible in every faster, click-only manual test.

**Explicitly cut from v1** (real gaps, not deliberate non-goals): no multi-lane melody chords drawn
diagonally overlapping in a genuinely ambiguous way beyond the crowd heuristic above; no
drag-and-drop-driven register-shift (click only); the register-shift edge hint is display-only, not
click-to-jump; print CSS for `.edit-grid*` (the old view had dedicated `.chord-grid*` print rules —
this is a fast follow-up, not done yet, same "manual check, not required" stance Lead Sheet's own
print behavior got in Milestone 1).

**Why a separate read-only view, not swapping `ChordGrid.tsx`'s own rendering.** Still true, and
is exactly why Lead Sheet is a new *view* rather than a new renderer for the existing one:
`ChordGrid.tsx`'s staff is also the live drag/resize/select/copy-paste surface for chords and the
click/drag melody editor. VexFlow is an engraving library, not an interaction framework — retrofitting
that interactivity onto VexFlow-rendered output would be a substantial, risky rework for a payoff
(nicer *live* editing notation) nothing asked for. Making Lead Sheet a separate, genuinely
non-interactive view sidesteps the whole question: VexFlow only ever has to render a passive chart,
never host a drag gesture.

**What VexFlow actually delivers that the hand-rolled renderer explicitly doesn't** (see "How
melody notation works" above for why each was accepted there as a trade-off, not an oversight):
real beaming, rhythm-accurate note-duration shapes, and real key-signature-aware enharmonic
spelling. Concretely, in `LeadSheet.tsx`:
- **Beats → VexFlow duration mapping** (`beatsToDurations`): a greedy decomposition against a
  fixed duration table (whole down to 16th, including dotted values), tied together via
  `StaveTie` when a note needs more than one token. Deliberately simple, not a full
  rhythm-notation algorithm — `MELODY_SNAP_BEATS` (0.5, the hand-drawn melody editor's own snap
  grid) means hand-drawn notes always decompose in ≤2 tokens; a sub-16th remainder (only
  realistically reachable via an oddly-timed MIDI import) is dropped with a `console.warn` rather
  than represented. Verified against a deliberately irregular test file (a 1.1-beat note, a
  4-beat note crossing a bar line) — the cap/tie/cross-bar-tie paths all render correctly, no
  crash, warnings fire exactly where expected.
- **Key-signature-aware pitch spelling** (`spellMelodyNote`): reuses `progressions.ts`'s own
  `shiftRootForKey` (now exported for this) — the same sharp-in-a-sharp-key/flat-in-a-flat-key
  convention diatonic chord roots already use elsewhere in this app — applied to *every* pitch
  class a melody note might need, not just diatonic ones, so it doesn't need a separate
  diatonic-or-not branch. A per-bar "active accidental per letter" map (reset from the key
  signature at each bar boundary) decides whether an `Accidental` modifier actually needs
  drawing, standard engraving practice (an accidental holds for the rest of the measure). Not
  melodic-contour-aware — purely key-signature-relative, a deliberate v1 simplification.
- **Forced-boundary construction** — the actual mechanism behind the hybrid chord-symbol overlay
  described below: walks the whole song once, splitting tickables at bar lines (always forced —
  each bar needs its own VexFlow `Voice`) and, only when nothing's currently sustaining, at
  chord/section starts too (so a real tickable is guaranteed to begin exactly there). A melody
  note already sustaining across a chord/section boundary is *not* split for it — confirmed via
  the same test file (a note deliberately spanning both a bar line and a chord change) — the
  label falls back to the start of whichever note/rest segment contains that beat instead.

**Hybrid chord symbols, not VexFlow's own text/annotation API — as planned, now built.** This
app's chord-symbol rendering stays the deliberate, already-documented choice it always was —
Architects Daughter, `chordNameParts`, the same `.chord-label-name`/`.chord-ext` classes
`ChordGrid.tsx`'s own chord labels use (see "Fonts / notation rendering" above) — rendered as a
plain-React absolutely-positioned overlay on top of VexFlow's own SVG, not inside it. Because the
forced-boundary construction above guarantees a real tickable starts at (almost) every chord/
section beat, positioning the overlay is just reading that tickable's own `getAbsoluteX()` after
`Formatter.format()` — no interpolation needed, the "coordinates VexFlow's formatter hands back"
this section originally described. Two render layers, kept deliberately separate: the VexFlow SVG
(imperative, only rebuilt when the song's actual content changes) and the overlay (plain React
state, re-rendered every animation frame during playback for the playhead line, touching no
VexFlow API at all) — verified this doesn't reformat/redraw the whole score on every frame.

**Resolved:** the "open question" this section used to end on (export-only vs. eventually
swapping the live view) didn't need resolving after all — Lead Sheet as a genuinely separate,
non-interactive view sidesteps it entirely. `ChordGrid.tsx` was never touched.

## How to run
```
npm install
npm run dev
```

## Notes for whoever's iterating on this (me)
- Adding a drum/bass style: drop a new `.mid` file in `data/drumPatterns/` or
  `data/bassPatterns/` — no code change needed. A leading underscore (`_name.mid`) makes it
  loadable by name (for a song preset to reference) without cluttering the style picker. A drum
  groove genuinely written in a meter other than 4/4 goes in a per-meter subfolder instead, e.g.
  `data/drumPatterns/3-4/` — a real recorded groove doesn't retime itself the way an algorithmic
  bass/keys rule can (see "Beats per bar" below), so it needs its own file rather than a
  beatsPerBar prop threaded through at playback time. The style picker only offers a drum style
  whose own `beatsPerBar` matches the loaded song's meter (or whichever style is already selected,
  so switching meter never shows a picker with a value not actually in its own option list).
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
  bass.ts's `buildSynth()` — the 11 notes with genuinely audible leading silence
  have since had it trimmed (an automated onset-detection pass, not by ear yet).
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

## Chord palette: single row, click-to-add, Chord Finder (done)
`ChordPalette.tsx` used to be a tall sidebar column — five separately-labeled, always-visible
rows (Diatonic, Diatonic 7ths, Borrowed, Secondary Dominants, Chromatic-with-quality-picker),
each only reachable by dragging a chord onto the grid. Redesigned Hookpad-style: one row under
the header, click-to-add as a second way in alongside drag, keyboard-driven duration selection,
and a "Chord Finder" picker replacing four of the five old rows instead of stacking them
permanently.

**Layout.** `ChordPalette` moved out of `App.tsx`'s old `.layout-sidebar` column (removed
entirely — `.layout` went from 3 columns to 2, grid + mixer) and now renders as its own
full-width row between `TopBar` and `.layout`, freeing up real width for the grid as a side
effect. The row itself: the 7 diatonic triads (`diatonicOptions`, unchanged) plus a "🔍 Magic
Chord" button, a duration picker, and the existing "🎵 Audition any scale…" opener.

**Click-to-add.** Every chord button — the diatonic row or anything inside Chord Finder — both
auditions the chord (existing behavior) and appends it to the end of the current progression.
"End of the progression" reuses the exact formula `ChordGrid.tsx`'s paste handler and
`handleAddSectionClick` already computed independently (`placements.length === 0 ? 0 :
Math.max(...placements.map(p => p.startBeat + p.lengthBeats))`) — App.tsx's new
`handleAddChordAtEnd` is the one place that now owns it for chords specifically, bailing out
(no-op) if there's no room left rather than clipping the chord short, same as the section
version. Drag-and-drop is untouched — click-to-add is additive, not a replacement, so placing a
chord at a specific non-append position still works exactly as before.

**Keyboard duration selection.** `j`/`k`/`l`/`;` set the duration a click-to-add chord gets — 1,
2, 4, 8 beats — Hookpad's own bindings, home-row, no modifier. Lives in `ChordPalette.tsx` as
its own `keydown` listener (same input-tag guard `ChordGrid.tsx`'s own handler already uses, so
typing in a text field never steals a keystroke) rather than folding into `ChordGrid.tsx`'s
existing one — different keys, no collision, and the duration state is genuinely the palette's
own concern. A small pill-button row doubles as both the live indicator and a mouse-friendly
alternative to the keys.

**Chord Finder.** Diatonic 7ths, Borrowed, and Secondary Dominants kept their existing generator
functions and roman-numeral labels verbatim — only their location changed, from permanent rows
to groups inside this on-demand picker. The Chromatic quality/`+bass` mini-picker (all 12 roots
at one selected quality, `chromaticOptions`) is preserved the same way, at the top of the modal,
since free-text search alone doesn't cover "build me a specific slash chord." The genuinely new
piece is `progressions.ts`'s `allChordsOptions(key, scale)` — every root × every `ChordQuality`
(28 of them), grouped by the existing `QUALITY_GROUPS` (Triads/Sixths/Sevenths/Extensions/
Altered-Exotic) so it reads as the same familiar clusters rather than one flat 12×28 list — plus
a plain client-side substring search across chord name, roman-numeral/interval label, and
quality label, filtering all the groups (curated and generated alike) at once. Selecting a chord
inside the modal closes it, same "quick lookup and place" feel as a command palette.

**Scope, decided in advance:** v1's "Chord Finder" is a browse/search tool, not real
harmonic-fit suggestion (Hookpad's own version suggests chords based on what's actually in the
progression already) — that's a separate, bigger idea overlapping with the not-yet-built chord
progression analyzer below, deliberately not attempted here.

**Rainbow scale-degree coloring (done, follow-up).** Every diatonic/diatonic-7th chord button
(the top row, and Chord Finder's "Diatonic 7ths" group) gets a colored top edge by scale degree —
1-7 → red-orange-yellow-green-blue-indigo-violet (`ChordPalette.tsx`'s `DEGREE_COLORS`), a plain
rainbow independent of the app's own single accent color, so a chord's degree reads at a glance
regardless of key — same idea as Hookpad's own consistent-per-degree coloring. Deliberately only
a colored top edge (matching each channel strip's own accent-top-border convention) rather than
recoloring the whole button, and deliberately scoped to true diatonic-degree chords only —
borrowed, secondary-dominant, and chromatic selections aren't "the Nth degree of the key" in the
same sense, so they stay uncolored rather than forcing a fit.

**Scale-suggestions panel removed (follow-up).** The auto-popup strip that used to show curated
scale pills whenever a chord was clicked (`SCALE_SUGGESTIONS`-driven, described in "Chord-scale
suggestions and auditioning" below) was removed once the palette became a single row — the
"Audition any scale" modal already covers the same job more generally. `SCALE_SUGGESTIONS` and
`audio/engine.ts`'s `auditionScale` are both untouched, just no longer wired to any UI.

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

**Idea, not scoped: playback that respects the arrangement's own structure.** Right now looping
is just a flat `loopStart`/`loopEnd` beat range over the resolved timeline — playing, say,
"Intro A A B A Coda" always loops whatever beat range you've set, with no awareness that "Intro"
and "Coda" are one-shot sections and "A"/"B" are the part actually meant to vamp/repeat. The
natural extension: let playback loop *by arrangement position* rather than by beat range — play
the head/intro through once, then loop just the "AB"-shaped body indefinitely (or however the
arrangement is actually meant to be played live), rather than requiring the user to hand-compute
the right beat numbers for `loopStart`/`loopEnd` every time. Would need a real UI/data decision
(which arrangement entries are "the loop," and where playback resumes to when it wraps) — not
attempted yet, just worth keeping in mind given how naturally it follows from sections+arrangement
existing at all.

## Chord-scale suggestions and auditioning (done); AI trading-fours (planned)

Three related practice-aid ideas. The first two are done; the third is a much
bigger, and partly non-goal-conflicting, undertaking — see below.

**Suggest scales over chords (data still exists; UI panel removed).**
`data/scaleSuggestions.ts`'s `SCALE_SUGGESTIONS: Record<ChordQuality, ScaleName[]>`
maps each chord quality to the jazz-theory-standard scale(s) that fit it — e.g.
Mixolydian for `dom7`, Dorian for `min7`/`m6`, Lydian for `maj7sharp11`. Real
constraint worth knowing: this app's `ScaleName` only has the 7 diatonic modes of
the major scale (see "Current shape" above) — no melodic/harmonic minor,
whole-tone, or diminished/octatonic scales, which several qualities' actual
textbook answer needs (altered dominants, `aug`, `minMaj7`). Rather than force a
wrong single-mode answer onto those, their entry is an empty array. The
auto-popup panel that used to show these pills whenever a chord was
clicked/dragged (`ChordPalette.tsx`'s `selectedChord`-driven strip) was removed
once the chord palette became a single row (see "Chord palette" above) — the
"Audition any scale" modal covers the same job (any scale over any chord, not
just this table's curated per-quality picks) without needing a second, narrower
panel next to it. `SCALE_SUGGESTIONS` itself is untouched and still a real,
reusable mapping — just not wired into any UI right now.

**Audition different scales over chords (engine function still exists; no longer
wired to any UI).** `audio/engine.ts`'s `auditionScale(chord, scale)`, a sibling
to `auditionChord` — triggers a sustained chord pad (one octave down, via
`Tone.Sampler.triggerAttack`, no release) then runs the scale's own notes (rooted
on the chord's root, not the song's key — `progressions.ts`'s `scaleTones()`,
same interval-table approach as `chordTones`) up and back down over it via
`Tone.now()`-relative one-shot scheduling, independent of Transport/song
playback, same as `auditionChord`. A new scale audition releases whatever pad is
still ringing from a previous one first, so rapid clicking doesn't pile up
sustained pads. Used to be wired to each suggestion pill button in the panel
described above; that panel is gone (see previous entry), and nothing calls
`auditionScale` right now — left in place as a small, self-contained utility
rather than deleted, since `runScaleAudition` (its shared core with
`auditionExoticScale`, which the modal below still uses live) would need
disentangling for no real benefit.

**"Audition any scale" modal (done).** Always covered more ground than the
suggestions panel above — any of 12 roots
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

## Guitar fingering diagrams (CAGED system) (idea, not scoped)
Another practice-aid idea in the same family as chord-scale suggestions/auditioning above:
clicking a chord (in the palette, or once placed on the grid) shows how to actually play it on
guitar, as a set of fretboard diagrams in the CAGED system — the standard way a chord's shape
maps to five movable positions up the neck, each named for the open-position chord shape (C, A,
G, E, D) it's derived from. Same "click a chord, see something useful about it" interaction shape
`ChordPalette.tsx`'s `selectedChord` state already drives for scale suggestions — this would be a
sibling panel/modal, not a new interaction pattern.

Real scoping questions, not yet worked out: fingering-diagram data would need to exist for every
root × quality combination this app supports (`CHORD_QUALITIES` is already a 29-member union) —
either a real fretboard-shape generator (find valid fingerings algorithmically from the chord's
actual tones + CAGED shape rules) or a curated lookup table, and a generator is the only approach
that doesn't need hand-authoring dozens of shapes per quality. Rendering itself is a new visual
component this app doesn't have anything like yet (a small fretboard grid with fret/string dots
and open/muted-string markers) — closer to the in-browser MIDI editor's "new 2D surface" category
than to the chord-scale suggestion panel's plain buttons/text. Not scoped further than this.

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

Both milestones of "Three desktop views" (see above) are now done — the Edit view is the real
Hookpad-style `EditGrid.tsx` rewrite, not a bridge; the old `ChordGrid.tsx` was deleted once the new
grid was verified. "Beats per bar" and the in-browser MIDI editor (v1) that used to top this list
are both fully done too — see their own sections above for what's covered and what's still cut for
scope.
