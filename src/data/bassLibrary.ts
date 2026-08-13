import { parseMidiBassBytes } from './midiBassImport';
import type { BassStyle } from './instrumentStyles';

// Bundled bass patterns live as .mid files here, imported the same way as the
// bundled drum patterns — see drumLibrary.ts, including the leading-underscore
// "private" convention (loadable by name for a song preset, hidden from the
// style picker otherwise).
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
      // No per-meter subfolder convention here yet (unlike drumLibrary.ts) — there's
      // nothing to fall back to, so this only picks up a meter when the file itself
      // declares one via an embedded time-signature meta event (see
      // parseMidiBassBytes' own doc comment); otherwise it's assumed 4/4, same as
      // before this field existed.
      const { name, pattern } = parseMidiBassBytes(buffer);
      const beatsPerBar = pattern.beatsPerBar ?? 4;
      const fileBase = path.split('/').pop()!.replace(/\.mid$/, '');
      const hidden = fileBase.startsWith('_');
      const fallbackName = titleCase(hidden ? fileBase.slice(1) : fileBase);
      const resolvedName = hidden ? fallbackName : (name ?? fallbackName);
      const style: BassStyle = { name: resolvedName, rule: null, pattern, hidden, beatsPerBar };
      return style;
    }),
  );
  styles.sort((a, b) => a.name.localeCompare(b.name));
  return styles;
}
