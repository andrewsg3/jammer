import { useState } from 'react';
import type { NotationStyle } from '../data/progressions';
import { COUNT_IN_OPTIONS, type CountInBeats } from '../audio/engine';
import { AttributionsModal } from './AttributionsModal';

type Props = {
  open: boolean;
  onClose: () => void;
  notationStyle: NotationStyle;
  onNotationStyleChange: (style: NotationStyle) => void;
  compactGridView: boolean;
  onCompactGridViewChange: (compact: boolean) => void;
  countInBeats: CountInBeats;
  onCountInBeatsChange: (beats: CountInBeats) => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  onResetAccent: () => void;
};

/** Desktop's settings modal — same shape/pattern as MobilePlayer.tsx's own
 * (backdrop + panel, an Appearance section of label/control rows), a separate
 * component rather than a shared one since the two hold different settings
 * (mobile also has per-track volume sliders here; desktop's mixer already lives
 * in the channel strips, so there's nothing to duplicate). */
export function SettingsModal({
  open,
  onClose,
  notationStyle,
  onNotationStyleChange,
  compactGridView,
  onCompactGridViewChange,
  countInBeats,
  onCountInBeatsChange,
  accentColor,
  onAccentColorChange,
  onResetAccent,
}: Props) {
  const [attributionsOpen, setAttributionsOpen] = useState(false);

  if (!open) return null;

  return (
    <div
      className="settings-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>Settings</h2>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <h3 className="settings-modal-subheading">Appearance</h3>
        <label className="settings-modal-row">
          <span>Chord Grid</span>
          <select
            className="settings-modal-select"
            value={compactGridView ? 'compact' : 'sheet'}
            onChange={(e) => onCompactGridViewChange(e.target.value === 'compact')}
            aria-label="Chord grid style"
          >
            <option value="sheet">Sheet Music</option>
            <option value="compact">Beat Grid</option>
          </select>
        </label>
        <label className="settings-modal-row">
          <span>Notation</span>
          <select
            className="settings-modal-select"
            value={notationStyle}
            onChange={(e) => onNotationStyleChange(e.target.value as NotationStyle)}
            aria-label="Chord notation style"
          >
            <option value="symbol">Symbol (-, °, ^7)</option>
            <option value="written">Written (m, dim, maj7)</option>
          </select>
        </label>
        <label className="settings-modal-row">
          <span>Accent</span>
          <input
            type="color"
            className="settings-modal-color"
            value={accentColor}
            onChange={(e) => onAccentColorChange(e.target.value)}
            aria-label="Accent color"
          />
          <button className="settings-modal-reset" onClick={onResetAccent} aria-label="Reset accent color to default">
            ↺
          </button>
        </label>

        <h3 className="settings-modal-subheading">Playback</h3>
        <label className="settings-modal-row">
          <span>Count-in</span>
          <select
            className="settings-modal-select"
            value={countInBeats}
            onChange={(e) => onCountInBeatsChange(Number(e.target.value) as CountInBeats)}
            aria-label="Count-in before play starts"
          >
            {COUNT_IN_OPTIONS.map((beats) => (
              <option key={beats} value={beats}>
                {beats === 0 ? 'Off' : `${beats} beats (${beats / 4} bar${beats === 4 ? '' : 's'})`}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="settings-modal-attributions-link"
          onClick={() => setAttributionsOpen(true)}
        >
          Attributions
        </button>
      </div>
      <AttributionsModal open={attributionsOpen} onClose={() => setAttributionsOpen(false)} />
    </div>
  );
}
