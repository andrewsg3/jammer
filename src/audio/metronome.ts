import * as Tone from 'tone';

const output = new Tone.Volume(0).toDestination();
// Count-in clicks get their own always-on output, deliberately not routed through
// `output` above — a count-in is only useful if it's actually audible, so it can't
// be silenced by the Metronome channel strip's own mute/volume the way the regular
// click loop can.
const countInOutput = new Tone.Volume(0).toDestination();

let synth: Tone.MembraneSynth | null = null;
let countInSynth: Tone.MembraneSynth | null = null;
let loop: Tone.Loop | null = null;
let beatCount = 0;

const CLICK_SYNTH_OPTIONS = {
  pitchDecay: 0.008,
  octaves: 2,
  envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
} as const;

function ensureSynth() {
  if (!synth) {
    synth = new Tone.MembraneSynth(CLICK_SYNTH_OPTIONS).connect(output);
  }
}

function ensureCountInSynth() {
  if (!countInSynth) {
    countInSynth = new Tone.MembraneSynth(CLICK_SYNTH_OPTIONS).connect(countInOutput);
  }
}

export function setVolume(db: number): void {
  output.volume.value = db;
}

export function setMuted(muted: boolean): void {
  output.mute = muted;
}

export function scheduleMetronome(beatsPerBar: number = 4): void {
  disposeMetronome();
  ensureSynth();
  beatCount = 0;

  loop = new Tone.Loop((time) => {
    const isDownbeat = beatCount % beatsPerBar === 0;
    synth!.triggerAttackRelease(isDownbeat ? 'C6' : 'C5', '32n', time, isDownbeat ? 1 : 0.6);
    beatCount++;
  }, '4n').start(0);
}

export function disposeMetronome(): void {
  loop?.dispose();
  loop = null;
}

/** Clicks leading into the downbeat, before the Transport itself has actually
 * started — scheduled via Tone.now()-relative one-shots (same technique
 * engine.ts's chord/scale auditions use), since the Transport-driven loop above
 * has nothing to schedule against yet. Accents every beatsPerBar-th click the
 * same way the real loop does, so a count-in still reads as whole bars in the
 * song's own meter, not just N undifferentiated clicks. Always audible (see
 * countInOutput above) regardless of the Metronome track's own mute/volume —
 * those only govern the click loop that runs during playback. */
export function playCountIn(beats: number, bpm: number, beatsPerBar: number = 4): void {
  ensureCountInSynth();
  const secondsPerBeat = 60 / bpm;
  const now = Tone.now();
  for (let i = 0; i < beats; i++) {
    const isDownbeat = i % beatsPerBar === 0;
    countInSynth!.triggerAttackRelease(isDownbeat ? 'C6' : 'C5', '32n', now + i * secondsPerBeat, isDownbeat ? 1 : 0.6);
  }
}
