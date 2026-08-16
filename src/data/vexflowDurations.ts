// Greedy decomposition of an arbitrary beat length into VexFlow duration tokens —
// deliberately simple, not a full rhythm-notation algorithm. MELODY_SNAP_BEATS
// (0.5, see EditGrid.tsx) means hand-drawn notes always decompose in <=2
// tokens; imported MIDI notes (or hand-typed lick lengths) with arbitrary
// float lengths are what exercises the cap/remainder path below. Shared by
// LeadSheet.tsx (melody notes) and LickTabView.tsx (lick notes) rather than
// duplicated -- the beats->duration math doesn't care whether the resulting
// tickable ends up a StaveNote or a TabNote.
const EPS = 1e-6;

const DURATION_TABLE: { beats: number; token: string }[] = [
  { beats: 4, token: 'w' },
  { beats: 3, token: 'hd' },
  { beats: 2, token: 'h' },
  { beats: 1.5, token: 'qd' },
  { beats: 1, token: 'q' },
  { beats: 0.75, token: '8d' },
  { beats: 0.5, token: '8' },
  { beats: 0.25, token: '16' },
];
const MAX_TOKENS_PER_SEGMENT = 8;

export function beatsToDurations(beats: number): string[] {
  const tokens: string[] = [];
  let remaining = beats;
  while (remaining > EPS && tokens.length < MAX_TOKENS_PER_SEGMENT) {
    const fit = DURATION_TABLE.find((d) => d.beats <= remaining + EPS);
    if (!fit) break; // smaller than a 16th — drop the remainder
    tokens.push(fit.token);
    remaining -= fit.beats;
  }
  if (remaining > EPS) {
    console.warn(`beatsToDurations: dropped a ${remaining.toFixed(3)}-beat remainder too short to notate`);
  }
  return tokens;
}
