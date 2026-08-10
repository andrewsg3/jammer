// Acoustic guitar, single-octave chromatic set (Freesound user "harri", ids
// 13699-13711) — Tone.Sampler repitches the nearest sampled note for anything
// not itself sampled, same technique the piano/bass use.
const sampleUrls = import.meta.glob<string>('./guitarSamples/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});

// Chords are voiced starting at KEYS_OCTAVE (audio/keys.ts) — placing the one
// sampled octave there keeps every voicing's repitch distance as small as
// possible, same reasoning bass.ts's anchor placement uses.
const GUITAR_OCTAVE = 3;

// Filenames are "<freesound-id>__harri__<note>.mp3", note as a bare letter plus
// an optional trailing "b" for flat (e.g. "13702__harri__bb.mp3" = Bb) — no
// sharps spelled directly, no octave. 13 files for a 12-note chromatic octave:
// three letters (c, e, f) each appear twice. Inferring what the second take of
// each actually is (by process of elimination against which chromatic pitch
// classes are otherwise missing, in ascending Freesound-id order, same
// approach bassSamples.ts's findUprightMultisample uses for its own duplicate
// letters): the set already covers A/Ab/B/Bb/C/D/Eb/E/F/G directly, leaving
// exactly two gaps -- C#/Db and F#/Gb -- so the second "c" file is taken as
// C#, and the second "f" file as F#. The second "e" file doesn't fill a gap
// (E# would just be F, already covered by "f") -- almost certainly a spare/
// alternate take, so it's simply not mapped to anything. This is inferred, not
// verified by ear -- worth a listen if a chord sounds off on exactly one of
// those three pitch classes.
function findGuitarSamples(): Record<string, string> {
  const entries = Object.entries(sampleUrls)
    .map(([path, url]) => {
      const fileBase = path.split('/').pop()!.replace(/\.mp3$/, '');
      const match = /^(\d+)__harri__([a-g]b?)$/i.exec(fileBase);
      if (!match) return null;
      return { id: Number(match[1]), token: match[2].toLowerCase(), url };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.id - b.id);

  const result: Record<string, string> = {};
  const seen = new Set<string>();
  for (const { token, url } of entries) {
    if (!seen.has(token)) {
      seen.add(token);
      const letter = token[0].toUpperCase();
      const accidental = token.slice(1); // '' or 'b'
      result[`${letter}${accidental}${GUITAR_OCTAVE}`] = url;
      continue;
    }
    if (token === 'c') result[`C#${GUITAR_OCTAVE}`] = url;
    else if (token === 'f') result[`F#${GUITAR_OCTAVE}`] = url;
    // else: a second take of a letter that doesn't need a sharp neighbor here
    // (e.g. the spare "e") -- left unmapped.
  }
  return result;
}

export const GUITAR_SAMPLE_URLS = findGuitarSamples();
