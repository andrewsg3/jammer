// Structural labels (A section, B section, Intro, Head, ...) drawn as a bracket
// spanning the bars they cover — jazz lead sheets mark these constantly, but
// they're purely a visual/organizational aid: nothing in playback reads this array
// at all (unlike placements/melody, which the audio engine schedules directly).
export type SectionMarker = {
  id: string;
  label: string;
  startBeat: number; // absolute, same coordinate space as ChordPlacement.startBeat
  lengthBeats: number;
  // Per-section playstyle overrides -- a style name (matching DrumStyle/BassStyle/
  // KeysStyle.name), same string identity the song-level drumStyle/bassStyle/keysStyle
  // fields already use. Undefined means "use the song's own default style" for that
  // track; unlike the song-level style state (a resolved object), this stays a plain
  // name here since a SectionMarker is a lightweight, serializable UI/data structure,
  // not something that owns audio-engine resolution -- resolving these names to
  // actual style objects happens once, at the App.tsx/engine.ts boundary right before
  // play(), same place the song-level styles are already resolved.
  drumStyle?: string;
  bassStyle?: string;
  keysStyle?: string;
};
