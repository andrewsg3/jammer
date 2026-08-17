import * as Tone from 'tone';

const output = new Tone.Volume(0).toDestination();
let synth: Tone.MembraneSynth | null = null;
let clock: Tone.Clock | null = null;

const CLICK_SYNTH_OPTIONS = {
  pitchDecay: 0.008,
  octaves: 2,
  envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
} as const;

function ensureSynth() {
  if (!synth) synth = new Tone.MembraneSynth(CLICK_SYNTH_OPTIONS).connect(output);
}

// A plain module-level counter, not React state -- PracticeView polls this via
// requestAnimationFrame (same pattern App.tsx's own playhead uses for
// getCurrentBeat() during song playback) rather than calling setState directly
// from this Tone-thread callback.
let beatCount = 0;

export function getPracticeBeatCount(): number {
  return beatCount;
}

/**
 * A standalone metronome click, deliberately independent of the shared
 * Tone.Transport that song playback/the real metronome (audio/metronome.ts)
 * both use. Practice mode needs to be startable/stoppable on its own beat --
 * playback already works the same in every desktop view (see CLAUDE.md's
 * "Four desktop views"), so a song could genuinely be playing in the
 * background while this runs, and this shouldn't touch that Transport's
 * position or state at all. Tone.Clock is Tone.js's own primitive for
 * exactly this: a free-running clock with its own frequency, entirely
 * separate from Transport.
 */
export function startPracticeMetronome(bpm: number, beatsPerBar: number): void {
  stopPracticeMetronome();
  ensureSynth();
  beatCount = 0;
  clock = new Tone.Clock((time) => {
    const isDownbeat = beatCount % beatsPerBar === 0;
    synth!.triggerAttackRelease(isDownbeat ? 'C6' : 'C5', '32n', time, isDownbeat ? 1 : 0.6);
    beatCount++;
  }, bpm / 60);
  clock.start();
}

export function stopPracticeMetronome(): void {
  clock?.stop();
  clock?.dispose();
  clock = null;
  beatCount = 0;
}
