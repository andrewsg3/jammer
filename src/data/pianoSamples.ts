// Salamander Grand Piano (Alexander Holm, CC-BY 3.0 — http://freesound.org/people/sarulis/) —
// specifically the pre-trimmed, web-ready subset Tone.js's own team cuts from the original
// 394MB+ multi-velocity release for their examples/@tonejs/piano: single velocity layer, MP3,
// sampled every minor third (not every note) rather than the full 88-key/16-velocity-layer set —
// small enough (~2MB total) to bundle directly, the same way the drum one-shots are. Source:
// https://github.com/Tonejs/audio/tree/master/salamander. Tone.Sampler repitches (via
// playback-rate shifting) whichever of these is closest to a requested note that isn't itself
// sampled — the minor-third gaps are a deliberate size/quality tradeoff, not a bug.
const sampleUrls = import.meta.glob<string>('./pianoSamples/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});

// Filenames spell sharps as "s" (e.g. "Ds4.mp3" for D#4) — a filesystem/URL-safe convention from
// the source repo, not something Tone.Sampler understands. Its `urls` map keys are real note
// names it parses as pitches (Tone.js only recognizes "#", not "s", as a sharp) — the filename
// stays as-is (it's just a URL), only the *key* gets converted to "D#4"/"F#4" here.
export const PIANO_SAMPLE_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(sampleUrls).map(([path, url]) => {
    const note = path.split('/').pop()!.replace(/\.mp3$/, '').replace(/^Ds/, 'D#').replace(/^Fs/, 'F#');
    return [note, url];
  }),
);
