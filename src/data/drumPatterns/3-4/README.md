# 3/4 drum patterns

Same convention as the parent `drumPatterns/` folder — drop a `.mid` file in here and
it shows up in the drum Style picker automatically, no code change needed. The only
difference is this folder's name: everything in it is tagged `beatsPerBar: 3`
(`drumLibrary.ts` reads that from the folder name itself), so it only appears in the
picker when the loaded song's own Meter is set to 3/4 — a groove recorded here should
actually be a 3-beat-bar performance (e.g. a real jazz-waltz feel), not a 4/4 groove
just dropped in the wrong folder, since nothing retimes the actual note content for
you (see CLAUDE.md's "Beats per bar" section for why that's true of drums
specifically, unlike the algorithmic bass/keys rules).

A leading underscore on the filename (e.g. `_my-favorite-things-drums.mid`) still
works the same way it does in the parent folder — loadable by name for a song preset
to reference, hidden from the style picker's dropdown list.

To add another meter, make a sibling folder named `<beatsPerBar>-4` (e.g. `5-4/`,
`7-4/`) — same mechanism, just a different number.
