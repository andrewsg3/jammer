import * as Tone from 'tone';

const output = new Tone.Volume(0).toDestination();

let synth: Tone.MembraneSynth | null = null;
let loop: Tone.Loop | null = null;
let beatCount = 0;

function ensureSynth() {
  if (!synth) {
    synth = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
    }).connect(output);
  }
}

export function setVolume(db: number): void {
  output.volume.value = db;
}

export function setMuted(muted: boolean): void {
  output.mute = muted;
}

export function scheduleMetronome(): void {
  disposeMetronome();
  ensureSynth();
  beatCount = 0;

  loop = new Tone.Loop((time) => {
    const isDownbeat = beatCount % 4 === 0;
    synth!.triggerAttackRelease(isDownbeat ? 'C6' : 'C5', '32n', time, isDownbeat ? 1 : 0.6);
    beatCount++;
  }, '4n').start(0);
}

export function disposeMetronome(): void {
  loop?.dispose();
  loop = null;
}
