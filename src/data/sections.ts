// Structural labels (A section, B section, Intro, Head, ...) drawn as a bracket
// spanning the bars they cover — jazz lead sheets mark these constantly, but
// they're purely a visual/organizational aid: nothing in playback reads this array
// at all (unlike placements/melody, which the audio engine schedules directly).
export type SectionMarker = {
  id: string;
  label: string;
  startBeat: number; // absolute, same coordinate space as ChordPlacement.startBeat
  lengthBeats: number;
};
