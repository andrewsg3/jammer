// Single-note bass samples, one anchor per instrument, repitched the rest of the
// way by Tone.Sampler (same technique as the piano, just with only one sample
// instead of many — see keys.ts's Acoustic Piano). The upright pizzicato is
// Freesound #354312 (uploaded by "mtg" — Music Technology Group, Universitat
// Pompeu Fabra); the electric bass sample was added directly. One anchor note is
// a real constraint, not a placeholder choice: the further a played note sits
// from it, the more the pitch-shifting itself is audible (a "chipmunked"/slowed
// character) — more pronounced here than the piano's minor-third spacing, since
// there's only one sample to repitch from.
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

export const UPRIGHT_SAMPLE_URLS = findSample('upright-pizzicato');
export const ELECTRIC_SAMPLE_URLS = findSample('electric-bass');
