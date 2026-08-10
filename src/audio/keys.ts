import * as Tone from 'tone';
import {
  chordTones,
  resolveSelection,
  bassRootNote,
  type ChordPlacement,
  type Chord,
  type ScaleName,
} from '../data/progressions';
import { timeFeelFactor } from '../data/instrumentStyles';
import type { KeysRule, TimeFeel } from '../data/instrumentStyles';
import { PIANO_SAMPLE_URLS } from '../data/pianoSamples';
import { GUITAR_SAMPLE_URLS } from '../data/guitarSamples';

// A relative beat offset (e.g. 1.5 beats after this placement's start) as a
// Bars:Beats:Sixteenths string — fractional sixteenths are fine, Tone parses them.
function offsetTime(beatOffset: number): string {
  const wholeBeat = Math.floor(beatOffset);
  return `0:${wholeBeat}:${(beatOffset - wholeBeat) * 4}`;
}

const KEYS_OCTAVE = 3;

// Classic bossa nova comping: left-hand root (bass note) and right-hand chord
// (the voicing's own upper tones, root dropped — a rootless jazz-piano voicing)
// sometimes struck together, sometimes independently, over a 2-bar (8-beat)
// syncopated cycle. Offsets are 0-indexed beats within the cycle (0 = beat 1).
type BossaHit = { offset: number; type: 'root' | 'chord' | 'both' };
const BOSSA_NOVA_HITS: BossaHit[] = [
  { offset: 0, type: 'both' }, // bar 1, beat 1
  { offset: 1, type: 'chord' }, // bar 1, beat 2
  { offset: 2, type: 'root' }, // bar 1, beat 3
  { offset: 2.5, type: 'chord' }, // bar 1, beat 3&
  { offset: 3.5, type: 'chord' }, // bar 1, beat 4&
  { offset: 4, type: 'root' }, // bar 2, beat 1
  { offset: 4.5, type: 'chord' }, // bar 2, beat 1&
  { offset: 6, type: 'both' }, // bar 2, beat 3
  { offset: 7, type: 'chord' }, // bar 2, beat 4
];
// "Bossa Nova 2" — the same cycle with the two bars swapped, i.e. rotated by
// half a cycle rather than a second hand-authored pattern. Re-sorted after the
// rotation — the scheduler below relies on chronological order to know which
// hit is "the previous one" to choke, and mod-8 rotation alone leaves the array
// starting mid-cycle (e.g. 4, 5, 6, ... 0, 0.5, ...), not sorted by offset.
const BOSSA_NOVA_2_HITS: BossaHit[] = BOSSA_NOVA_HITS.map((h) => ({ ...h, offset: (h.offset + 4) % 8 })).sort(
  (a, b) => a.offset - b.offset,
);

function bossaNotes(notes: string[], type: BossaHit['type']): string[] {
  if (type === 'root') return [notes[0]];
  if (type === 'chord') return notes.slice(1);
  return notes;
}

// A toggleable room reverb, in series after `output` — the one point every
// instrument's signal passes through regardless of routing (the synth patches go
// through `chorus` first; the piano below connects straight to `output`,
// bypassing chorus on purpose, but still lands here). Silent (wet=0) until
// enabled, same toggle-is-just-a-wet-flip pattern as chorus below.
const reverb = new Tone.Freeverb({ roomSize: 0.3, dampening: 3000, wet: 0 }).toDestination();
const output = new Tone.Volume(0).connect(reverb);
// A toggleable test effect — always in the chain, silent (wet=0) until enabled, so
// toggling is just a wet-level flip rather than rewiring the audio graph live.
const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 }).connect(output).start();

let synth: Tone.PolySynth<Tone.FMSynth> | Tone.PolySynth<Tone.Synth> | Tone.Sampler | null = null;
let currentInstrument = 'Acoustic Piano';
type KeysEvent = {
  time: string;
  notes: string[];
  powerFive: string[];
  powerSix: string[];
  // Only used by rising-sun — root one octave up, for its root/3rd/5th/octave
  // broken-chord shape (see KeysRule).
  octaveRoot: string;
  lengthBeats: number;
  rhythm: KeysRule['rhythm'];
};
let part: Tone.Part<KeysEvent> | null = null;

function buildSynth() {
  if (currentInstrument === 'Acoustic Piano') {
    // Real samples (Salamander Grand Piano) rather than a synth patch — see
    // data/pianoSamples.ts. Tone.Sampler repitches the nearest sampled note for
    // anything in between, so it doesn't need one file per key. Not connected
    // through `chorus` like the synth patches below — a real piano recording
    // doesn't want a chorus effect smearing its own natural sound.
    return new Tone.Sampler({ urls: PIANO_SAMPLE_URLS, release: 1 }).connect(output);
  }
  if (currentInstrument === 'Acoustic Guitar') {
    // Real samples (see data/guitarSamples.ts) rather than a synth patch, same
    // idea as Acoustic Piano above — a single sampled octave repitched by
    // Tone.Sampler rather than one file per key. Also not routed through
    // `chorus`, for the same reason the piano isn't.
    return new Tone.Sampler({ urls: GUITAR_SAMPLE_URLS, release: 0.5 }).connect(output);
  }
  if (currentInstrument === 'Electric Cello') {
    // A plain oscillator with a fast decay/low sustain approximates a picked/strummed
    // sound well enough without physical modeling — a synth-patch alternative to the
    // real guitar samples above, not a stand-in for them.
    return new Tone.PolySynth(Tone.FMSynth, {
      "harmonicity": 3.01,
      "modulationIndex": 14,
      "oscillator": {
          "type": "triangle"
      },
      "envelope": {
          "attack": 0.2,
          "decay": 0.3,
          "sustain": 0.1,
          "release": 1.2
      },
      "modulation" : {
          "type": "square"
      },
      "modulationEnvelope" : {
          "attack": 0.01,
          "decay": 0.5,
          "sustain": 0.2,
          "release": 0.1
      }
  }).connect(chorus);
  }
  if (currentInstrument === 'Kalimba') {
    return new Tone.PolySynth(Tone.FMSynth, {
      "harmonicity":8,
      "modulationIndex": 2,
      "oscillator" : {
          "type": "sine"
      },
      "envelope": {
          "attack": 0.001,
          "decay": 2,
          "sustain": 0.1,
          "release": 2
      },
      "modulation" : {
          "type" : "square"
      },
      "modulationEnvelope" : {
          "attack": 0.002,
          "decay": 0.2,
          "sustain": 0,
          "release": 0.2
    }
    }).connect(chorus);
  }
  if (currentInstrument === 'Steel Pan') {
    return new Tone.PolySynth(Tone.Synth, {
        "oscillator": {
            "type": "fatcustom",
            "partials" : [0.2, 1, 0, 0.5, 0.1],
            "spread" : 40,
            "count" : 3
        },
        "envelope": {
            "attack": 0.001,
            "decay": 1.6,
            "sustain": 0,
            "release": 1.6
        }
    }).connect(chorus);
  }
  // FM synthesis gets closer to an electric-piano character than a plain oscillator.
  return new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3,
    modulationIndex: 2,
    oscillator: { type: 'sine' },
    modulation: { type: 'square' },
    envelope: { attack: 0.005, decay: 1.2, sustain: 0.2, release: 1.2 },
    modulationEnvelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.5 },
  }).connect(chorus);
}

function ensureSynth() {
  if (!synth) synth = buildSynth();
}

export function setVolume(db: number): void {
  output.volume.value = db;
}

export function setMuted(muted: boolean): void {
  output.mute = muted;
}

// Two separate toggles now, not one shared one — both are always-connected
// nodes whose wet level just flips on/off, so there's no live rewiring either
// way. Chorus only ever audibly does anything for the synth patches (the piano
// bypasses it on purpose); reverb applies to whichever instrument is active.
export function setChorusEnabled(enabled: boolean): void {
  chorus.wet.value = enabled ? 0.6 : 0;
}

export function setReverbEnabled(enabled: boolean): void {
  reverb.wet.value = enabled ? 0.3 : 0;
}

export function setInstrument(name: string): void {
  if (name !== currentInstrument) {
    currentInstrument = name;
    synth?.dispose();
    synth = null;
  }
  // Eagerly (not lazily at first Play) so a sample-based instrument's buffers
  // start loading as soon as it's selected — see isInstrumentLoaded, which lets
  // App.tsx gate the Play button on this instead of a click landing silently
  // mid-load.
  ensureSynth();
}

/** False only while the current instrument is sample-based (Tone.Sampler) and
 * still loading its buffers — always true for the synth patches, which have
 * nothing to wait on. */
export function isInstrumentLoaded(): boolean {
  if (!synth) return false;
  return synth instanceof Tone.Sampler ? synth.loaded : true;
}

function voicingNotes(chord: Chord, voicing: KeysRule['voicing']): string[] {
  const tones = chordTones(chord, KEYS_OCTAVE);
  switch (voicing) {
    case 'power-chord':
      return [tones[0], tones[2] ?? tones[0]];
    case 'triad':
      return tones.slice(0, 3);
    case 'seventh':
      return tones;
  }
}

export function scheduleKeys(
  placements: ChordPlacement[],
  key: string,
  scale: ScaleName,
  rule: KeysRule,
  timeFeel: TimeFeel = 'normal',
): void {
  ensureSynth();
  const factor = timeFeelFactor(timeFeel);

  const events = placements.map((placement) => {
    const chord = resolveSelection(key, scale, placement.selection);
    // The bass note the LH plays for a slash chord (see bassRootNote) — the
    // bossa-nova 'root' hit type and blues-shuffle's power chords are built off
    // this, same as bass.ts's rootTones; the RH voicing (voicingNotes below)
    // still comes straight from the chord's real quality, unaffected.
    const root = `${bassRootNote(chord)}${KEYS_OCTAVE}`;
    const rootMidi = Tone.Frequency(root).toMidi();
    return {
      time: `0:${placement.startBeat}:0`,
      notes: voicingNotes(chord, rule.voicing),
      // Only used by blues-shuffle(-swing) — root+5th and root+6th, computed
      // straight from the root rather than the chord's own tones (see KeysRule).
      powerFive: [root, Tone.Frequency(rootMidi + 7, 'midi').toNote()],
      powerSix: [root, Tone.Frequency(rootMidi + 9, 'midi').toNote()],
      octaveRoot: chordTones(chord, KEYS_OCTAVE + 1)[0],
      lengthBeats: placement.lengthBeats,
      rhythm: rule.rhythm,
    };
  });

  part = new Tone.Part<KeysEvent>((time, event) => {
    if (event.rhythm === 'sustained') {
      // A held chord doesn't have a strike rate for time-feel to change.
      synth!.triggerAttackRelease(event.notes, `0:${event.lengthBeats}:0`, time, 0.5);
    } else if (event.rhythm === 'la-pompe') {
      // Gypsy-jazz rhythm-guitar chunk: a short, percussive stab on every beat,
      // driven harder on 2 and 4 like the downstroke accent of "la pompe." Iterates
      // over a virtual (scaled) length so beat%4's accent lines up on clean integers,
      // then rescales the real offset back into the placement's real-time span.
      // Explicitly releases the previous stab before each new one (same reasoning
      // as bossa-nova above) — without it, a long placement racks up one
      // still-ringing voice per beat against the shared synth's long pad-style
      // release, and stopping mid-placement force-releases a pile of them at
      // once instead of just whatever's currently sounding.
      const virtualLength = Math.max(1, Math.round(event.lengthBeats * factor));
      for (let beat = 0; beat < virtualLength; beat++) {
        const accent = beat % 4 === 1 || beat % 4 === 3;
        const hitTime = time + Tone.Time(offsetTime(beat / factor)).toSeconds();
        if (beat > 0) synth!.triggerRelease(event.notes, hitTime);
        synth!.triggerAttackRelease(event.notes, '16n', hitTime, accent ? 0.75 : 0.45);
      }
    } else if (event.rhythm === 'charleston') {
      // The "Charleston" comp: just two stabs per bar — the downbeat (beat 1) and
      // the "and" of beat 2 — then nothing on 3 or 4. Cycles every 4 beats, not 2.
      // Floor of 1, not 4 — flooring to a full bar here would let the pattern's
      // tail run past a chord shorter than 4 beats and into the next placement's
      // own notes, which is a real (not just cosmetic) audible chord-bleed bug,
      // not just an early cutoff.
      const virtualLength = Math.max(1, Math.round(event.lengthBeats * factor));
      // Explicitly releases the previous stab before each new one — same
      // reasoning as la-pompe/bossa-nova above.
      let hasPlayed = false;
      for (let barStart = 0; barStart < virtualLength; barStart += 4) {
        const hitTime1 = time + Tone.Time(offsetTime(barStart / factor)).toSeconds();
        if (hasPlayed) synth!.triggerRelease(event.notes, hitTime1);
        synth!.triggerAttackRelease(event.notes, '16n', hitTime1, 0.7);
        hasPlayed = true;
        if (barStart + 1.5 < virtualLength) {
          const hitTime2 = time + Tone.Time(offsetTime((barStart + 1.5) / factor)).toSeconds();
          synth!.triggerRelease(event.notes, hitTime2);
          synth!.triggerAttackRelease(event.notes, '16n', hitTime2, 0.55);
        }
      }
    } else if (event.rhythm === 'arpeggio-up' || event.rhythm === 'arpeggio-updown') {
      // 'up' just cycles the voicing tones; 'updown' bounces back down before
      // repeating (root-3rd-5th-7th-5th-3rd-...), a classic broken-chord roll.
      const pattern =
        event.rhythm === 'arpeggio-updown'
          ? [...event.notes, ...event.notes.slice(1, -1).reverse()]
          : event.notes;
      const stepSixteenths = 2; // 8th-note steps, in virtual (pre-time-feel) space
      const virtualTotalSixteenths = Math.max(stepSixteenths, Math.round(event.lengthBeats * 4 * factor));
      // Explicitly releases the previous note before each new one — an arpeggio
      // wants crisp separate notes, not each one blurring into the next via the
      // shared synth patches' long release tail.
      let prevNote: string | null = null;
      for (let s = 0; s < virtualTotalSixteenths; s += stepSixteenths) {
        const note = pattern[(s / stepSixteenths) % pattern.length];
        const hitTime = time + Tone.Time(offsetTime(s / 4 / factor)).toSeconds();
        if (prevNote) synth!.triggerRelease(prevNote, hitTime);
        synth!.triggerAttackRelease(note, '8n', hitTime, 0.5);
        prevNote = note;
      }
    } else if (event.rhythm === 'rising-sun') {
      // "House of the Rising Sun"-style broken-chord arpeggio, fingerpicking-style:
      // beat 1 of every bar is a standalone root hit (the thumb replaying the bass
      // note), then the arpeggio proper — root-3rd-5th-octave-5th-3rd — kicks back
      // in from the "&" of beat 1, spaced in eighth-note triplets (3 notes per
      // beat) rather than straight 8ths, for the 6/8-feel lilt the straight-8th
      // version was missing. The cycle restarts from the root again at 1&, so
      // beats 1 and 1& are both the root — a deliberate doubled root, not a
      // repeat/off-by-one.
      const pattern = [event.notes[0], event.notes[1], event.notes[2], event.octaveRoot, event.notes[2], event.notes[1]];
      // Floor of 1, not 4 — see charleston's comment above on why a full-bar
      // floor causes real cross-placement note bleed for shorter chords.
      const virtualLength = Math.max(1, Math.round(event.lengthBeats * factor));
      const tripletStep = 1 / 3;
      // Explicitly releases whatever's still ringing before each new note — same
      // reasoning as the other arpeggiated/stabbed rhythms above.
      let prevNote: string | null = null;
      for (let barStart = 0; barStart < virtualLength; barStart += 4) {
        const rootTime = time + Tone.Time(offsetTime(barStart / factor)).toSeconds();
        if (prevNote) synth!.triggerRelease(prevNote, rootTime);
        synth!.triggerAttackRelease(event.notes[0], '8n', rootTime, 0.7);
        prevNote = event.notes[0];
        let i = 0;
        for (let b = barStart + 0.5; b < barStart + 4 && b < virtualLength; b += tripletStep) {
          const note = pattern[i % pattern.length];
          const hitTime = time + Tone.Time(offsetTime(b / factor)).toSeconds();
          if (prevNote) synth!.triggerRelease(prevNote, hitTime);
          synth!.triggerAttackRelease(note, '8t', hitTime, 0.5);
          prevNote = note;
          i++;
        }
      }
    } else if (event.rhythm === 'bossa-nova' || event.rhythm === 'bossa-nova-2') {
      const hits = event.rhythm === 'bossa-nova-2' ? BOSSA_NOVA_2_HITS : BOSSA_NOVA_HITS;
      // Floor of 1, not 8 (the full 2-bar cycle) — flooring to the cycle length
      // was the actual bug behind "the previous chord keeps playing over the
      // current one": for any chord shorter than 2 bars, it forced the pattern to
      // keep generating hits past the placement's real end, landing on top of
      // whatever the *next* placement's own chord was already playing there.
      const virtualLength = Math.max(1, Math.round(event.lengthBeats * factor));
      // The shared synth patches' envelopes have a long decay/release (tuned for
      // slow pad-style rhythms like 'sustained') — much longer than the gaps
      // between hits here (as tight as half a beat), so without an explicit
      // choke the previous hit's notes are still audibly decaying/releasing when
      // the next, differently-pitched hit starts, and the two bleed together.
      // Releasing the still-ringing notes right as the new ones attack is what a
      // real comping player's hand would do anyway.
      let prevNotes: string[] = [];
      for (let cycleStart = 0; cycleStart < virtualLength; cycleStart += 8) {
        for (const hit of hits) {
          const beatOffset = cycleStart + hit.offset;
          if (beatOffset >= virtualLength) continue;
          const notes = bossaNotes(event.notes, hit.type);
          const hitTime = time + Tone.Time(offsetTime(beatOffset / factor)).toSeconds();
          if (prevNotes.length > 0) synth!.triggerRelease(prevNotes, hitTime);
          synth!.triggerAttackRelease(notes, '8n', hitTime, hit.type === 'both' ? 0.75 : hit.type === 'root' ? 0.6 : 0.5);
          prevNotes = notes;
        }
      }
    } else if (event.rhythm === 'blues-shuffle' || event.rhythm === 'blues-shuffle-swing') {
      // Classic boogie/blues rhythm-guitar figure, continuous 8th notes over a 4-beat
      // (1-bar) cycle: power chord on 1 & 1+, root-and-6th on 2 & 2+, power chord on
      // 3 & 3+, root-and-6th on 4 & 4+ — the shape alternates every full beat, not
      // every 8th note. Swing delays each "+" from the exact midpoint (0.5) to 2/3 of
      // the way through the beat, the same long-short ratio as an 8th-note triplet.
      const offbeat = event.rhythm === 'blues-shuffle-swing' ? 2 / 3 : 0.5;
      const virtualLength = Math.max(1, Math.round(event.lengthBeats * factor));
      // Explicitly releases the previous power-chord shape before each new hit —
      // same reasoning as the other closely-spaced rhythms above.
      let prevNotes: string[] = [];
      const pushShuffleHit = (beatOffset: number, notes: string[]) => {
        if (beatOffset >= virtualLength) return;
        const hitTime = time + Tone.Time(offsetTime(beatOffset / factor)).toSeconds();
        if (prevNotes.length > 0) synth!.triggerRelease(prevNotes, hitTime);
        synth!.triggerAttackRelease(notes, '8n', hitTime, 0.7);
        prevNotes = notes;
      };
      for (let cellStart = 0; cellStart < virtualLength; cellStart += 4) {
        for (let beatInCell = 0; beatInCell < 4; beatInCell++) {
          const notes = beatInCell % 2 === 0 ? event.powerFive : event.powerSix;
          pushShuffleHit(cellStart + beatInCell, notes);
          pushShuffleHit(cellStart + beatInCell + offbeat, notes);
        }
      }
    } else {
      const virtualLength = Math.max(2, Math.round(event.lengthBeats * factor));
      // Explicitly releases the previous hit before each new one — same
      // reasoning as the other rhythms above.
      let hasPlayed = false;
      for (let beat = 0; beat < virtualLength; beat += 2) {
        const hitTime = time + Tone.Time(offsetTime(beat / factor)).toSeconds();
        if (hasPlayed) synth!.triggerRelease(event.notes, hitTime);
        synth!.triggerAttackRelease(event.notes, '4n', hitTime, 0.6);
        hasPlayed = true;
      }
    }
  }, events).start(0);
}

export function disposeKeys(): void {
  part?.dispose();
  part = null;
  // triggerAttackRelease bakes an absolute release time into the Web Audio graph at
  // call time — stopping Transport or disposing the Part doesn't retroactively cancel
  // an already-scheduled long sustain, so an in-flight chord keeps ringing after stop
  // unless every active voice is force-released here too.
  if (synth) {
    // releaseAll() alone still fades out over the patch's own configured release
    // time — up to 1-2s depending on instrument, tuned for a sustained pad tail,
    // not for an instant stop — so Stop would still audibly ring for a beat or
    // two. Force a short release just for this call, then restore the patch's
    // real one immediately after; the release time that matters for an
    // already-triggered ramp is the one in effect at the moment it's triggered,
    // not whatever it's set to afterward, so this doesn't affect normal playback.
    if (synth instanceof Tone.Sampler) {
      // Sampler's release is a flat property, unlike the PolySynth patches
      // below whose release lives nested under `envelope`.
      const originalRelease = synth.release;
      synth.release = 0.05;
      synth.releaseAll();
      synth.release = originalRelease;
    } else {
      const originalRelease = synth.get().envelope.release;
      synth.set({ envelope: { release: 0.05 } });
      synth.releaseAll();
      synth.set({ envelope: { release: originalRelease } });
    }
  }
}
