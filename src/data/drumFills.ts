import { parseMidiDrumBytes } from './midiDrumImport';
import { STEPS_PER_BEAT } from './instrumentStyles';
import type { DrumPattern } from './instrumentStyles';

export type DrumFill = { name: string; pattern: DrumPattern; lengthBeats: number };

// Bundled fills live as .mid files here — same "drop a file, no code change"
// convention as data/drumPatterns/ (see drumLibrary.ts). Each should be a short
// one or half-bar fill (a bar-long groove pattern would work but defeats the
// point — the whole idea is a brief break from the main pattern, not a
// replacement for it).
const fillMidiUrls = import.meta.glob<string>('./drumFills/*.mid', {
  eager: true,
  query: '?url',
  import: 'default',
});

function titleCase(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Loads every bundled fill, each with the exact number of beats it actually
 * needs (not drumPatterns' usual "rounded up to a full bar" — that's right for
 * a looping groove but would silently pad a genuinely half-bar fill out to a
 * full bar of dead space). */
export async function loadBundledDrumFills(): Promise<DrumFill[]> {
  return Promise.all(
    Object.entries(fillMidiUrls).map(async ([path, url]) => {
      const buffer = await fetch(url).then((res) => res.arrayBuffer());
      const { name, pattern } = parseMidiDrumBytes(buffer);
      const fileBase = path.split('/').pop()!.replace(/\.mid$/, '');
      const maxStep = pattern.steps.reduce((max, s) => Math.max(max, s.time), 0);
      const lengthBeats = Math.max(1, Math.ceil((maxStep + 1) / STEPS_PER_BEAT));
      return { name: name ?? titleCase(fileBase), pattern, lengthBeats };
    }),
  );
}
