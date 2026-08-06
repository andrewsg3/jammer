import { parseMidiDrumBytes } from './midiDrumImport';
import type { DrumStyle } from './instrumentStyles';

// Bundled drum patterns live as .mid files here — adding a new one is just dropping
// in a file (program the beat in a DAW or GrooveScribe and export). The display name
// comes from the file's own track-name meta event, so the file is self-describing.
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
      return { name: name ?? titleCase(fileBase), pattern };
    }),
  );
  styles.sort((a, b) => a.name.localeCompare(b.name));
  return styles;
}
