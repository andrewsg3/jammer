# Song preset JSON format

Every `.json` file in this folder is loaded automatically (via `import.meta.glob`
in `../songPresets.ts`) and shown in the Song dropdown — no code changes needed,
just drop in a new file. This doc covers the shape of that file, especially the
chord-naming conventions, which aren't obvious from the JSON alone.

If a file fails to parse or doesn't match the schema, it's silently skipped with a
console warning rather than breaking the app — check the browser console if a
preset you added isn't showing up.

## Minimal example

```json
{
  "version": 1,
  "name": "My Song",
  "author": "Someone",
  "key": "C",
  "scale": "major",
  "tempo": 120,
  "metronome": false,
  "loopStart": 0,
  "loopEnd": 16,
  "drumStyle": "Funk",
  "bassStyle": "Walking",
  "keysStyle": "Sustained 7ths",
  "placements": [
    { "selection": { "type": "diatonic", "degree": 0 }, "lengthBeats": 4 },
    { "selection": { "type": "diatonic", "degree": 3 }, "lengthBeats": 4 },
    { "selection": { "type": "diatonic", "degree": 4 }, "lengthBeats": 4 },
    { "selection": { "type": "diatonic", "degree": 0 }, "lengthBeats": 4 }
  ]
}
```

## Top-level fields

| Field                        | Type                | Notes                                                                                     |
| ----------------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `version`                     | `1`                  | Always `1` right now.                                                                       |
| `name`                        | string               | Shown in the Song dropdown and the sheet-music title.                                       |
| `author`                      | string (optional)    | Shown under the title in the sheet-music header.                                            |
| `key`                         | string               | A root note: `C`, `C#`/`Db`, `D`, ... `B`. Either spelling works — use whichever is musically conventional for the key (e.g. `Bb`, not `A#`). |
| `scale`                       | `"major"` \| `"minor"` \| `"dorian"` \| `"phrygian"` \| `"lydian"` \| `"mixolydian"` \| `"locrian"` | `"minor"` means natural minor (aeolian). |
| `tempo`                       | number               | BPM.                                                                                         |
| `metronome`                   | boolean              | Whether the Metronome track starts unmuted.                                                 |
| `loopStart` / `loopEnd`       | number               | Loop range in quarter-note beats. `loopEnd` is exclusive.                                   |
| `drumStyle` / `bassStyle` / `keysStyle` | string     | Must match a style's **name** exactly — see [Styles](#styles-drumstyle-bassstyle-keysstyle) below. |
| `chordsInstrument` / `bassInstrument` / `drumsInstrument` | string (optional) | Timbre variant name — see [Instruments](#instruments). Defaults to the first option if omitted. |
| `customDrumPattern`           | object (optional)    | Only needed if `drumStyle` isn't a bundled/`.mid`-derived name — embeds the raw pattern so the preset stays portable. You won't normally write this by hand. |
| `placements`                  | array                | The chord progression — see below.                                                          |

## Placements

Each entry in `placements` is:

```json
{ "selection": { ... }, "startBeat": 4, "lengthBeats": 4 }
```

- **`lengthBeats`** — how long the chord holds, in quarter-note beats. `4` = one bar of 4/4.
- **`startBeat`** — *optional.* If you omit it, it's computed as the running end of
  the previous placement (starting at `0`) — i.e. chords just play one after another
  in list order. You only need to write `startBeat` explicitly to leave a **gap**
  (silence) between two chords, or to place something out of order. See the minimal
  example above — none of those placements specify `startBeat`.
- **`selection`** — which chord. One of four shapes, below.

## Chord selection types

All five are relative to the preset's `key`/`scale`, so the same preset transposes
correctly if you change the key later.

### `diatonic` — a scale-degree chord

```json
{ "type": "diatonic", "degree": 0 }
```

`degree` is `0`-`6`, mapping to the 7 diatonic chords of the key. Each mode is the
major scale rotated to start on a different degree, so the triad qualities below
come from stacking thirds within that mode's own scale — e.g. dorian's `degree: 0`
is a minor triad because dorian's own 3rd and 5th are a minor third and perfect
fifth above its tonic, not because it's "compared" to major or minor.

| degree | major | minor | dorian | phrygian | lydian | mixolydian | locrian |
| ------ | ----- | ----- | ------ | -------- | ------ | ---------- | ------- |
| 0      | I     | i     | i      | i        | I      | I          | i°      |
| 1      | ii    | ii°   | ii     | II       | II     | ii         | II      |
| 2      | iii   | III   | III    | III      | iii    | iii°       | iii     |
| 3      | IV    | iv    | IV     | iv       | iv°    | IV         | iv      |
| 4      | V     | v     | v      | v°       | V      | v          | V       |
| 5      | vi    | VI    | vi°    | VI       | vi     | vi         | VI      |
| 6      | vii°  | VII   | VII    | vii      | vii    | VII        | vii     |

### `diatonicSeventh` — the diatonic 7th chord on a scale degree

```json
{ "type": "diatonicSeventh", "degree": 0 }
```

Same `degree`/mode table as `diatonic` above, but stacks four scale-thirds
(root/3rd/5th/7th) instead of three — e.g. major's `degree: 0` is `maj7` rather than
a plain `maj` triad. Every mode here only ever produces `maj7`, `dom7`, `min7`, or
`m7b5` (never `dim7` or an augmented 7th — those only arise from harmonic/melodic
minor, not these seven natural modes).

### `secondaryDominant` — V7 of a diatonic degree

```json
{ "type": "secondaryDominant", "degree": 4 }
```

Same `degree` numbering as above; resolves to the dominant 7th chord a fifth above
that degree's diatonic root (e.g. in C major, `degree: 4` = V7/V = D7). Available
degrees: **major** `1`-`5` (not `0`/`6` — V/I would just duplicate the diatonic V,
and vii° is an uncommon target); **minor** `0`-`5` (minor keeps `0`, since V/i is the
harmonic-minor dominant — e.g. E7 in A minor — a genuinely different chord from the
diatonic v, not a duplicate). **Not curated for dorian/phrygian/lydian/mixolydian/
locrian** — see the note at the end of this section.

### `borrowed` — a fixed modal-interchange chord

```json
{ "type": "borrowed", "index": 0 }
```

A small curated list per scale (not exhaustive modal interchange, just the common
ones), indexed `0`-`3`:

| index | major | minor |
| ----- | ----- | ----- |
| 0     | iv    | I     |
| 1     | bIII  | IV    |
| 2     | bVI   | bII   |
| 3     | bVII  | VI7   |

**`borrowed` and `secondaryDominant` are major/minor-only.** The other five modes
don't have an equally obvious "correct" curated list for either (modal interchange
and secondary dominants are ambiguous concepts once your key is already a mode
rather than major/minor), so for now those modes only offer `diatonic` and
`chromatic` — the chord palette simply hides those two sections when the loaded
scale doesn't have a list for them. `chromatic` still reaches every possible chord
regardless of scale, so nothing is actually unreachable, just less pre-labeled.

### `chromatic` — any root, any quality

```json
{ "type": "chromatic", "offset": 7, "quality": "dom7" }
```

The escape hatch — any of the 12 chromatic roots at any quality. `offset` is
semitones above the tonic, `0`-`11`:

| offset | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   | 10  | 11  |
| ------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| degree | 1   | b2  | 2   | b3  | 3   | 4   | b5  | 5   | b6  | 6   | b7  | 7   |

`quality` is one of:

| quality       | symbol   | quality      | symbol  |
| ------------- | -------- | ------------ | ------- |
| `maj`         | (none)   | `sus4`       | sus4    |
| `min`         | m        | `6`          | 6       |
| `dom7`        | 7        | `m6`         | m6      |
| `maj7`        | maj7     | `add9`       | add9    |
| `min7`        | m7       | `dom9`       | 9       |
| `dim`         | dim      | `maj9`       | maj9    |
| `dim7`        | dim7     | `m9`         | m9      |
| `m7b5`        | m7b5     | `dom7sharp9` | 7#9 (Hendrix) |
| `aug`         | aug      | `dom7flat9`  | 7b9     |
| `sus2`        | sus2     | `dom7sharp5` | 7#5     |
|               |          | `dom13`      | 13      |
|               |          | `m11`        | m11     |
|               |          | `maj13`      | maj13   |

## Styles (`drumStyle`, `bassStyle`, `keysStyle`)

These are **names**, matched exactly against the currently-loaded style list — check
`../instrumentStyles.ts` for the built-in algorithmic ones (e.g. `"Funk"`, `"Walking"`,
`"Tumbao"`, `"Sustained 7ths"`), or a `.mid` file's own track-name meta event for
bundled drum/bass patterns (`../drumPatterns/`, `../bassPatterns/`).

If a name doesn't match anything, that track just silently falls back to its first
option (usually "None") — there's no error, so double check spelling if a track
isn't sounding right.

**Private patterns:** a `.mid` file whose name starts with `_` (e.g.
`_ghosts-drums.mid`) is hidden from the style picker dropdown, but still loadable by
name — use this for a pattern that only makes sense for one specific song. Its
resolved name is title-cased from the filename with the underscore stripped
(`_ghosts-drums.mid` → `"Ghosts Drums"`), **ignoring any track-name meta event** —
for a private pattern the filename is the deliberate identity, not whatever your DAW
happened to label the track.

**Bass patterns specifically:** if a bass `.mid` pattern's own length (in beats)
exactly equals the total length of the placements it's applied to, it plays through
once, verbatim, with no transposition — meant for a bassline you've already composed
against the real chords. Otherwise it transposes to each chord's root and resets at
every chord change — meant for a short, reusable lick.

## Instruments

`chordsInstrument`/`bassInstrument`/`drumsInstrument` pick a timbre, independent of
style/pattern. Current options (see `../instrumentStyles.ts`):

- Chords: `"Electric Piano"`, `"Guitar"`
- Bass: `"Electric"`, `"Upright"`
- Drums: `"Acoustic"`, `"Electronic"`
