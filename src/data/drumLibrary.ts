import { parseMidiDrumBytes } from './midiDrumImport';
import type { DrumStyle } from './instrumentStyles';

// Bundled drum patterns live as .mid files here — adding a new one is just dropping
// in a file (program the beat in a DAW or GrooveScribe and export). The display name
// comes from the file's own track-name meta event, so the file is self-describing.
// A leading underscore (e.g. "_ghosts-drums.mid") marks a pattern "private" — still
// loadable by name for a song preset to reference as its default, but hidden from
// the style picker so it doesn't clutter the dropdown for everyone else's songs.
//
// A file directly in this folder is a 4/4 groove (drumLibrary tags it beatsPerBar: 4
// below). A genuinely different-meter groove needs its own recording, not just a
// number changed at playback time — see DrumStyle's own doc comment in
// instrumentStyles.ts — so those live in a per-meter subfolder instead, named
// "<beatsPerBar>-4" (e.g. "3-4/", "5-4/", "7-4/") to match this app's own
// "always over a 4 denominator" meter convention (see CLAUDE.md's "Beats per bar").
// **`**` in the glob below, not `*`** — that's the one line that makes subfolders
// get picked up at all.
const drumMidiUrls = import.meta.glob<string>('./drumPatterns/**/*.mid', {
  eager: true,
  query: '?url',
  import: 'default',
});

function titleCase(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "3-4" -> 3, "12-4" -> 12; undefined for anything that doesn't match (so a
 * mis-named or unexpected subfolder just falls back to being treated as 4/4
 * rather than silently vanishing from every meter's picker). */
function beatsPerBarFromFolderName(folder: string): number | undefined {
  const match = /^(\d+)-4$/.exec(folder);
  return match ? Number(match[1]) : undefined;
}

export async function loadBundledDrumStyles(): Promise<DrumStyle[]> {
  const styles = await Promise.all(
    Object.entries(drumMidiUrls).map(async ([path, url]) => {
      const buffer = await fetch(url).then((res) => res.arrayBuffer());
      const { name, pattern } = parseMidiDrumBytes(buffer);
      const parts = path.split('/');
      const fileBase = parts.pop()!.replace(/\.mid$/, '');
      // parts is now [".", "drumPatterns", ...subfolders] -- a file directly in
      // drumPatterns/ has no subfolder component at all.
      const subfolder = parts[parts.length - 1];
      const beatsPerBar =
        subfolder && subfolder !== 'drumPatterns' ? (beatsPerBarFromFolderName(subfolder) ?? 4) : 4;
      const hidden = fileBase.startsWith('_');
      const fallbackName = titleCase(hidden ? fileBase.slice(1) : fileBase);
      // For a private pattern the filename is the deliberate identity — a track-name
      // meta event is more likely leftover DAW metadata, so filename wins here even
      // when both are present (unlike the public case, where track name wins).
      return { name: hidden ? fallbackName : (name ?? fallbackName), pattern, hidden, beatsPerBar };
    }),
  );
  styles.sort((a, b) => a.name.localeCompare(b.name));
  return styles;
}
