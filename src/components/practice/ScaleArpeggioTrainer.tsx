import { useEffect, useMemo, useState } from 'react';
import { SCALE_INTERVALS, SCALE_LABELS, QUALITY_INTERVALS, chordName, resolveSelection } from '../../data/progressions';
import type { Chord, ChordPlacement, NotationStyle, ScaleName } from '../../data/progressions';
import type { SectionMarker } from '../../data/sections';
import { SCALE_SUGGESTIONS } from '../../data/scaleSuggestions';
import { SCALE_POSITIONS } from '../../data/scaleFretboard';
import type { ScalePosition } from '../../data/scaleFretboard';
import { ScaleFretboardDiagram } from './ScaleFretboardDiagram';
import { BeatGridSheet } from '../BeatGridSheet';

type Mode = 'scale' | 'arpeggio';
type CagedLetter = 'C' | 'A' | 'G' | 'E' | 'D';

// The full CAGED set, in the acronym's own order -- a picker over all five
// letters, even though only two (E/A) have real curated fretting math yet
// (see data/scaleFretboard.ts). Showing one box at a time (instead of always
// rendering both E and A side by side) and picking C/G/D just surfaces the
// same honest "not curated yet" gap `CAGED_SHAPES` and the chord fingering
// popover already take, rather than a wrong or missing box -- per direct
// user request.
const CAGED_LETTERS: CagedLetter[] = ['C', 'A', 'G', 'E', 'D'];
const CURATED_POSITIONS = new Set<string>(SCALE_POSITIONS);

// The read-only slice of the app's live song state Practice is allowed to see
// -- see CLAUDE.md's "Song-scoped practice mode" section for why this is a
// deliberate, narrow, one-directional exception to Practice otherwise having
// no song state at all (no editing, no mixer). `placements`/`sections` are
// the exact live App.tsx state (ChordPlacement[]/SectionMarker[]), passed
// straight through to BeatGridSheet with no mapping needed.
export type PracticeCurrentSong = {
  title: string;
  placements: ChordPlacement[];
  musicalKey: string;
  scale: ScaleName;
  notationStyle: NotationStyle;
  sections: SectionMarker[];
  beatsPerBar: number;
};

type Props = {
  currentSong: PracticeCurrentSong | null;
  // Playback -- reusing App.tsx's actual song engine (the same Play/Stop
  // TopBar's own button drives) rather than a second, independent one. See
  // CLAUDE.md's "Song-scoped practice mode" section for why Practice never
  // runs its own playback: the whole point is hearing/seeing *the* loaded
  // song, with its real instruments/tempo/styles, not a practice-only stand-in.
  isPlaying: boolean;
  countInActive: boolean;
  playheadBeat: number;
  instrumentsLoading: boolean;
  onTogglePlay: () => void;
  // App.tsx's own loopStart/loopEnd, passed straight through to BeatGridSheet
  // -- see CLAUDE.md's "Loop a section, from Play Along/Practice" section.
  loopStart: number;
  loopEnd: number;
  onLoopRangeChange: (loopStart: number, loopEnd: number) => void;
};

/** The chord actually sounding at a given beat, or null between/before any
 * placement (e.g. during count-in, or a gap). */
function chordAtBeat(song: PracticeCurrentSong, beat: number): Chord | null {
  const wholeBeat = Math.floor(beat);
  const hit = song.placements.find((p) => wholeBeat >= p.startBeat && wholeBeat < p.startBeat + p.lengthBeats);
  return hit ? resolveSelection(song.musicalKey, song.scale, hit.selection) : null;
}

/**
 * Practice tab's first real exercise (see CLAUDE.md's "Practice philosophy"
 * section) -- the currently loaded song's own real chart (BeatGridSheet, the
 * same read-only chord grid Play Along's Chord Grid view renders), click any
 * chord to see the scale(s)/arpeggio it actually calls for
 * (data/scaleSuggestions.ts's SCALE_SUGGESTIONS), shown as one CAGED-position
 * fretboard box at a time, picked from the full C/A/G/E/D set -- only
 * E-shape/A-shape actually have curated fretting math (see
 * data/scaleFretboard.ts for why), so picking any of the other three shows
 * an honest "not curated yet" message instead, same scope the chord
 * fingering popover already has. Pressing
 * Play plays the real song through the app's shared audio engine, the chart
 * highlights the currently-sounding bar exactly like Chord Grid does, and the
 * scale panel automatically tracks whichever chord is currently sounding.
 *
 * Replaced an earlier "Free Explore" mode (any of 12 roots x 19 scales x 28
 * arpeggios, decoupled from any song) per direct user request -- see
 * CLAUDE.md's "Practice direction check-in" section for why that mode was,
 * per real jazz-guitar pedagogy, closer to a named anti-pattern than a
 * strength. This is song-only now: there is no "browse any bundled song
 * without playing it" picker either -- Play needs the real, currently-loaded
 * song's actual instruments/tempo/styles (the same state Compose/Play Along
 * already hold), so "the song" is always whatever's actually loaded, not a
 * separately-chosen one Practice would have no way to actually play back.
 */
export function ScaleArpeggioTrainer({
  currentSong,
  isPlaying,
  countInActive,
  playheadBeat,
  instrumentsLoading,
  onTogglePlay,
  loopStart,
  loopEnd,
  onLoopRangeChange,
}: Props) {
  // Highlighting/scale-tracking stay off during count-in silence -- matches
  // Chord Grid's own `isPlaying && !countInActive` convention exactly (see
  // App.tsx). The Play/Stop button below deliberately uses raw `isPlaying`
  // instead, same as TopBar's own button -- it needs to read "Stop" the
  // instant playback is triggered, not wait out the count-in.
  const chartActive = isPlaying && !countInActive;
  const [mode, setMode] = useState<Mode>('scale');
  const [scaleSuggestionIndex, setScaleSuggestionIndex] = useState(0);
  const [cagedPosition, setCagedPosition] = useState<CagedLetter>('E');

  // Whichever chord was last clicked on the chart -- the initial pick is the
  // song's own first chord, so the scale panel never opens empty. Read once
  // at mount (a lazy initializer): ScaleArpeggioTrainer fully unmounts
  // whenever appMode leaves 'practice' (App.tsx only renders <PracticeView>
  // inside its appMode === 'practice' branch), so a genuinely different song
  // can only ever be seen on a fresh mount --
  // no live-resync effect is needed for a prop that can't change underneath
  // an already-mounted instance. Chord and beat are tracked together (one
  // state, not two) since they're always set from the same click and a Chord
  // alone (root+quality) isn't enough to pick out one specific bar on the
  // chart to highlight -- the same chord can recur several times in a song.
  const [selection, setSelection] = useState<{ chord: Chord; startBeat: number } | null>(() => {
    if (!currentSong || currentSong.placements.length === 0) return null;
    const first = [...currentSong.placements].sort((a, b) => a.startBeat - b.startBeat)[0];
    return { chord: resolveSelection(currentSong.musicalKey, currentSong.scale, first.selection), startBeat: first.startBeat };
  });
  const selectedChord = selection?.chord ?? null;

  // While playing, the scale panel tracks the currently-sounding chord
  // instead of whatever was last clicked -- falls back to the last click
  // (or the song's first chord) the instant nothing is actively sounding
  // (a gap, or playback stopped), rather than flashing blank.
  const playingChord = useMemo(
    () => (currentSong && chartActive ? chordAtBeat(currentSong, playheadBeat) : null),
    [currentSong, chartActive, playheadBeat],
  );
  const displayedChord = playingChord ?? selectedChord;

  const suggestions = displayedChord ? SCALE_SUGGESTIONS[displayedChord.quality] : [];

  // A new chord (by root+quality) always starts back on the first suggested
  // scale rather than keeping whatever index the previous chord happened to
  // be on.
  useEffect(() => {
    setScaleSuggestionIndex(0);
  }, [displayedChord?.root, displayedChord?.quality]);

  let activeIntervals: number[] = [];
  let activeLabel = '';
  let scaleUnavailable = false;
  if (displayedChord) {
    if (mode === 'arpeggio') {
      activeIntervals = QUALITY_INTERVALS[displayedChord.quality];
      // "ARPEGGIO" (and the scale name below) are uppercased here in JS,
      // deliberately not via the label's own CSS text-transform -- a flat
      // root (e.g. "Bb7") is spelled with a plain lowercase "b", and blindly
      // uppercasing the whole label would turn that into "BB7", reading as a
      // capital B standing in for the flat. See ScaleFretboardDiagram.tsx's
      // own label rendering for the other half of this fix.
      activeLabel = `${chordName(displayedChord)} ARPEGGIO`;
    } else {
      const chosenScale = suggestions[scaleSuggestionIndex] ?? suggestions[0];
      if (chosenScale) {
        activeIntervals = SCALE_INTERVALS[chosenScale];
        activeLabel = `${chordName(displayedChord)} · ${SCALE_LABELS[chosenScale].toUpperCase()}`;
      } else {
        scaleUnavailable = true;
      }
    }
  }

  const hasSong = !!currentSong && currentSong.placements.length > 0;
  const playDisabled = !hasSong || (!isPlaying && instrumentsLoading);

  return (
    <div className="practice-song-trainer">
      <div className="practice-song-trainer-grid-col">
        <div className="practice-song-toolbar">
          <span className="practice-song-title">{currentSong?.title ?? 'No song loaded'}</span>
          <button
            type="button"
            className="practice-play-button"
            onClick={onTogglePlay}
            disabled={playDisabled}
            title={!isPlaying && instrumentsLoading ? 'Loading instrument samples…' : undefined}
          >
            {!isPlaying && instrumentsLoading ? 'Loading…' : isPlaying ? '■ Stop' : '▶ Play'}
          </button>
        </div>
        {hasSong && currentSong ? (
          <div className="beat-grid-sheet-page practice-song-grid-page">
            <BeatGridSheet
              placements={currentSong.placements}
              musicalKey={currentSong.musicalKey}
              scale={currentSong.scale}
              notationStyle={currentSong.notationStyle}
              playheadBeat={playheadBeat}
              isPlaying={chartActive}
              sections={currentSong.sections}
              beatsPerBar={currentSong.beatsPerBar}
              onChordClick={(chord, startBeat) => setSelection({ chord, startBeat })}
              selectedBeat={chartActive ? null : selection?.startBeat ?? null}
              loopStart={loopStart}
              loopEnd={loopEnd}
              onLoopRangeChange={onLoopRangeChange}
            />
          </div>
        ) : (
          <p className="chord-grid-hint scale-trainer-hint">
            No song is loaded yet — build or load a progression in Compose first.
          </p>
        )}
      </div>

      <div className="practice-song-trainer-scale-col scale-trainer-panel">
        <div className="scale-trainer-chord-name">
          {displayedChord ? chordName(displayedChord) : 'Click a chord to see scale suggestions'}
        </div>
        {displayedChord && (
          <>
            <div className="scale-trainer-controls scale-trainer-scale-controls">
              <div className="scale-trainer-mode-toggle" role="group" aria-label="Scale or arpeggio">
                <button
                  type="button"
                  className={'scale-trainer-mode-button' + (mode === 'scale' ? ' scale-trainer-mode-button--active' : '')}
                  onClick={() => setMode('scale')}
                >
                  Scale
                </button>
                <button
                  type="button"
                  className={'scale-trainer-mode-button' + (mode === 'arpeggio' ? ' scale-trainer-mode-button--active' : '')}
                  onClick={() => setMode('arpeggio')}
                >
                  Arpeggio
                </button>
              </div>
              {mode === 'scale' && suggestions.length > 1 && (
                <div className="scale-trainer-suggestion-toggle" role="group" aria-label="Which suggested scale">
                  {suggestions.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className={
                        'scale-trainer-mode-button' + (i === scaleSuggestionIndex ? ' scale-trainer-mode-button--active' : '')
                      }
                      onClick={() => setScaleSuggestionIndex(i)}
                    >
                      {SCALE_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {scaleUnavailable ? (
              <p className="chord-grid-hint scale-trainer-hint">
                No honest scale suggestion for this chord's quality in this app's scale set — see CLAUDE.md's
                "Chord-scale suggestions" section. Try Arpeggio instead.
              </p>
            ) : (
              <>
                <div className="scale-trainer-position-toggle" role="group" aria-label="CAGED position">
                  {CAGED_LETTERS.map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      className={
                        'scale-trainer-mode-button' + (cagedPosition === letter ? ' scale-trainer-mode-button--active' : '')
                      }
                      onClick={() => setCagedPosition(letter)}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
                {CURATED_POSITIONS.has(cagedPosition) ? (
                  <div className="fretboard-diagram-row">
                    <ScaleFretboardDiagram
                      root={displayedChord.root}
                      intervals={activeIntervals}
                      position={cagedPosition as ScalePosition}
                      label={activeLabel}
                    />
                  </div>
                ) : (
                  <p className="chord-grid-hint scale-trainer-hint">
                    {cagedPosition}-shape isn't curated yet — only E-shape and A-shape are. See CLAUDE.md's "Guitar
                    fingering diagrams" section for the remaining C/G/D-shape gap.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
