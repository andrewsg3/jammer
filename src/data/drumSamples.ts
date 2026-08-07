import type { DrumVoice } from './instrumentStyles';

// Bundled one-shot drum samples — see CLAUDE.md's "Planned: sample-based drum
// playback" section for the full naming/format/licensing plan this follows. Empty
// (or only partially filled) is expected and fine: this glob just finds whatever's
// actually here. Any DrumVoice/instrument combination with no matching file falls
// back to its synth in audio/drums.ts — sample playback is additive, not something
// that requires full coverage before it does anything.
const sampleUrls = import.meta.glob<string>('./drumSamples/*.wav', {
  eager: true,
  query: '?url',
  import: 'default',
});

// camelCase DrumVoice -> the kebab-case filename segment the naming convention uses
// (e.g. "hihatOpen" -> "hihat-open-acoustic.wav").
const VOICE_SLUG: Record<DrumVoice, string> = {
  kick: 'kick',
  snare: 'snare',
  rim: 'rim',
  hihat: 'hihat',
  hihatOpen: 'hihat-open',
  hihatFoot: 'hihat-foot',
  ride: 'ride',
  rideBell: 'ride-bell',
  crash: 'crash',
  tomHigh: 'tom-high',
  tomMid: 'tom-mid',
  tomLow: 'tom-low',
};

const sampleUrlByKey = new Map<string, string>(
  Object.entries(sampleUrls).map(([path, url]) => [path.split('/').pop()!.replace(/\.wav$/, ''), url]),
);

/** e.g. getSampleUrl('hihatOpen', 'Electronic') looks up "hihat-open-electronic.wav". */
export function getSampleUrl(voice: DrumVoice, instrument: string): string | undefined {
  return sampleUrlByKey.get(`${VOICE_SLUG[voice]}-${instrument.toLowerCase()}`);
}
