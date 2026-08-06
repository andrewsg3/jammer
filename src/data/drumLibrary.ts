import { parseMidiDrumBytes } from './midiDrumImport';
import type { DrumStyle } from './instrumentStyles';

// Bundled drum patterns live as .mid files here — adding a new one is just dropping
// in a file (program the beat in a DAW or GrooveScribe and export). The display name
// comes from the file's own track-name meta event, so the file is self-describing.
// A leading underscore (e.g. "_ghosts-drums.mid") marks a pattern "private" — still
// loadable by name for a song preset to reference as its default, but hidden from
// the style picker so it doesn't clutter the dropdown for everyone else's songs.
const drumMidiUrls = import.meta.glob<string>('./drumPatterns/*.mid', {
  eager: true,
  query: '?url',
  import: 'default',
});

function titleCase(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function loadBundledDrumStyles(): Promise<DrumStyle[]> {
  const styles = await Promise.all(
    Object.entries(drumMidiUrls).map(async ([path, url]) => {
      const buffer = await fetch(url).then((res) => res.arrayBuffer());
      const { name, pattern } = parseMidiDrumBytes(buffer);
      const fileBase = path.split('/').pop()!.replace(/\.mid$/, '');
      const hidden = fileBase.startsWith('_');
      const fallbackName = titleCase(hidden ? fileBase.slice(1) : fileBase);
      // For a private pattern the filename is the deliberate identity — a track-name
      // meta event is more likely leftover DAW metadata, so filename wins here even
      // when both are present (unlike the public case, where track name wins).
      return { name: hidden ? fallbackName : (name ?? fallbackName), pattern, hidden };
    }),
  );
  styles.sort((a, b) => a.name.localeCompare(b.name));
  return styles;
}
