// Acoustic guitar (Freesound user "harri", ids 13699-13711) — Tone.Sampler
// repitches the nearest sampled note for anything not itself sampled, same
// technique the piano/bass use.
const sampleUrls = import.meta.glob<string>('./guitarSamples/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});

// Filenames are "<freesound-id>__harri__<note>.mp3", note as a bare letter plus
// an optional trailing "b" for flat (e.g. "13702__harri__bb.mp3" = "Bb") -- no
// sharp, no octave, and three letters (c, e, f) each appear twice with nothing
// in the name distinguishing the two takes. The filenames turned out not to be
// trustworthy: the first pass at this file assumed a single fixed octave (3)
// and treated "second take of a letter = its sharp." Autocorrelation pitch-
// detection on all 13 files (see PR history) showed that was wrong on two
// counts -- most notes actually sit an octave lower than assumed, and the c/f
// sharp-vs-natural pairing was backwards -- and revealed what the set actually
// is: a single unbroken chromatic run from E2 to E3, one real recording per
// semitone, no gaps or duplicates. Every detected pitch landed within ~25 cents
// of its exact equal-tempered value, consistent enough to treat as verified
// rather than inferred. Hardcoded by Freesound id below rather than re-deriving
// a naming rule, since the naming convention itself doesn't reliably encode
// octave or accidental.
const NOTE_BY_ID: Record<number, string> = {
  13699: 'A2',
  13700: 'Ab2',
  13701: 'B2',
  13702: 'Bb2',
  13703: 'C#3',
  13704: 'C3',
  13705: 'D3',
  13706: 'E3',
  13707: 'E2',
  13708: 'Eb3',
  13709: 'F#2',
  13710: 'F2',
  13711: 'G2',
};

function findGuitarSamples(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [path, url] of Object.entries(sampleUrls)) {
    const fileBase = path.split('/').pop()!.replace(/\.mp3$/, '');
    const match = /^(\d+)__harri__[a-g]b?$/i.exec(fileBase);
    if (!match) continue;
    const id = Number(match[1]);
    const note = NOTE_BY_ID[id];
    if (!note) continue;
    result[note] = url;
  }
  return result;
}

export const GUITAR_SAMPLE_URLS = findGuitarSamples();
