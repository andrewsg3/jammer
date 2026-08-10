// Electric bass is still a single anchor sample, repitched the rest of the way by
// Tone.Sampler (same technique as the piano's own minor-third spacing — see
// keys.ts's Acoustic Piano) — the further a played note sits from that one
// sample, the more the pitch-shifting itself is audible (a "chipmunked"/slowed
// character). Upright bass used to work the same way off a single anchor
// (Freesound #354312) before the real multisample below replaced it — see
// UPRIGHT_MULTISAMPLE_URLS' own comment.
const sampleUrls = import.meta.glob<string>('./bassSamples/*.wav', {
  eager: true,
  query: '?url',
  import: 'default',
});

// Filenames are "<instrument>-<note>.wav", note spelled with sharps as "s" and
// flats as "b" (e.g. "electric-bass-gs2.wav" = G#2, "electric-bass-ab2.wav" =
// Ab2) — filesystem-safe, sharp convention matches pianoSamples.ts; flat is a
// plain "b" since it's already filesystem-safe as-is. Returns a
// Tone.Sampler-ready { "Ab2": url } map with whichever single file's name
// starts with the given prefix.
function findSample(instrumentPrefix: string): Record<string, string> {
  for (const [path, url] of Object.entries(sampleUrls)) {
    const fileBase = path.split('/').pop()!.replace(/\.wav$/, '');
    if (!fileBase.startsWith(`${instrumentPrefix}-`)) continue;
    const noteToken = fileBase.slice(instrumentPrefix.length + 1);
    const match = /^([a-g])(s|b)?(\d+)$/i.exec(noteToken);
    if (!match) continue;
    const accidental = match[2] === 's' ? '#' : match[2] === 'b' ? 'b' : '';
    const note = `${match[1].toUpperCase()}${accidental}${match[3]}`;
    return { [note]: url };
  }
  return {};
}

export const ELECTRIC_SAMPLE_URLS = findSample('electric-bass');

// Single-anchor upright pizzicato (Freesound #354312), repitched the rest of the
// way by Tone.Sampler — the same technique the electric bass above uses.
// Temporarily back in use instead of UPRIGHT_MULTISAMPLE_URLS below: the
// multisample's per-file pre-transient silence needs a real by-ear (or properly
// tuned onset-detection) trim before it sounds right, and that isn't done yet —
// see CLAUDE.md/bass.ts's buildSynth() comment. Swap the Upright branch in
// buildSynth() back to UPRIGHT_MULTISAMPLE_URLS once that's sorted.
export const UPRIGHT_SAMPLE_URLS = findSample('upright-pizzicato');

// The real multisample: every note from a Freesound chromatic recording session
// (uploaded by "mtg" — Music Technology Group, Universitat Pompeu Fabra — see
// CLAUDE.md's "Attributions & references"), superseding the single-anchor
// upright-pizzicato-c2.wav above (same underlying take, Freesound #354312, is
// actually one of the files in this set too). Filenames are
// "<freesound-id>__mtg__double-bass-<note><octave>-pizzicato.wav" — note text
// never carries an accidental, and there are two independent recording passes
// covering the same E1-G4 range back to back (ascending Freesound id), so the
// note this file actually is has to be inferred rather than read off the name:
// when two files in a row share the same note+octave, the SECOND is that
// note's sharp, not a duplicate — e.g. two consecutive "f1" files are F1 then
// F#1. A note that's only recorded once (E and B never get a sharp pair,
// following normal chromatic spacing, but a handful of others are simply
// missing their second take) has no ambiguity either way. Where both recording
// passes happen to cover the same note, the later file (by id) wins — no
// principled reason to prefer one pass over the other, and this needs no
// special-casing beyond "process in id order, last write wins."
function findUprightMultisample(): Record<string, string> {
  const entries = Object.entries(sampleUrls)
    .map(([path, url]) => {
      const fileBase = path.split('/').pop()!;
      const match = /^(\d+)__mtg__double-bass-([a-g])(\d+)-pizzicato\.wav$/i.exec(fileBase);
      if (!match) return null;
      return { id: Number(match[1]), letter: match[2].toUpperCase(), octave: match[3], url };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.id - b.id);

  const result: Record<string, string> = {};
  let previousLabel: string | null = null;
  for (const { letter, octave, url } of entries) {
    const label = `${letter}${octave}`;
    const note = label === previousLabel ? `${letter}#${octave}` : label;
    result[note] = url;
    previousLabel = label;
  }
  return result;
}

export const UPRIGHT_MULTISAMPLE_URLS = findUprightMultisample();
