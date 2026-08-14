// Shared page-layout constants for the whole-song beat coordinate space — independent
// of any one view's own bars-per-row choice (Edit's 48-bar/8-bars-per-row grid, Chord
// Grid's/Lead Sheet's 4-bars-per-row page). GRID_BARS is the fixed total length every
// view lays the same underlying placements out against.
export const GRID_BARS = 48;

/** Total beats the whole GRID_BARS-bar song holds at a given time signature. */
export function totalBeatsFor(beatsPerBar: number): number {
  return GRID_BARS * beatsPerBar;
}
