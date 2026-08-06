import { parseMidiBassBytes } from './midiBassImport';
import type { BassStyle } from './instrumentStyles';

// Bundled bass patterns live as .mid files here, imported the same way as the
// bundled drum patterns — see drumLibrary.ts. Adding a new one is just dropping
// in a file; the display name comes from the file's own track-name meta event.
const bassMidiUrls = import.meta.glob<string>('./bassPatterns/*.mid', {
  eager: true,
  query: '?url',
  import: 'default',
});

function titleCase(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function loadBundledBassStyles(): Promise<BassStyle[]> {
  const styles = await Promise.all(
    Object.entries(bassMidiUrls).map(async ([path, url]) => {
      const buffer = await fetch(url).then((res) => res.arrayBuffer());
      const { name, pattern } = parseMidiBassBytes(buffer);
      const fileBase = path.split('/').pop()!.replace(/\.mid$/, '');
      const style: BassStyle = { name: name ?? titleCase(fileBase), rule: null, pattern };
      return style;
    }),
  );
  styles.sort((a, b) => a.name.localeCompare(b.name));
  return styles;
}
