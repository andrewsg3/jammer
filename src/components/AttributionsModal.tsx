type Props = {
  open: boolean;
  onClose: () => void;
};

/** Credits for third-party samples/fonts, plus non-code resources worth citing
 * (e.g. the jazz-standards list used when picking which songs to bundle). Kept
 * in sync with CLAUDE.md's own "Attributions & references" section — that's the
 * canonical copy; this is just its in-app surface. */
export function AttributionsModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="settings-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Attributions"
      onClick={onClose}
    >
      <div className="settings-modal attributions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>Attributions</h2>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <h3 className="settings-modal-subheading">Samples</h3>
        <ul className="attributions-list">
          <li>
            <strong>Acoustic Piano</strong> — Salamander Grand Piano by Alexander Holm, CC-BY 3.0
            (
            <a href="http://freesound.org/people/sarulis/" target="_blank" rel="noopener noreferrer">
              freesound.org/people/sarulis
            </a>
            ), via the pre-trimmed subset Tone.js's own team cuts for{' '}
            <a
              href="https://github.com/Tonejs/audio/tree/master/salamander"
              target="_blank"
              rel="noopener noreferrer"
            >
              @tonejs/piano
            </a>
            .
          </li>
          <li>
            <strong>Upright Bass</strong> (pizzicato) — Freesound, uploaded by "mtg" (Music
            Technology Group, Universitat Pompeu Fabra).
          </li>
          <li>
            <strong>Electric Bass</strong> — recorded directly.
          </li>
          <li>
            <strong>Acoustic drum kit</strong> — Ableton factory content.
          </li>
        </ul>

        <h3 className="settings-modal-subheading">Fonts</h3>
        <ul className="attributions-list">
          <li>Architects Daughter and Noto Music, both via Google Fonts, both OFL-licensed.</li>
        </ul>

        <h3 className="settings-modal-subheading">Reference resources</h3>
        <ul className="attributions-list">
          <li>
            <a
              href="https://standardrepertoire.com/pages/the-top-25-jazz-standards.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              standardrepertoire.com — Top 25 Jazz Standards
            </a>{' '}
            — referenced when picking which jazz standards to bundle as song presets.
          </li>
        </ul>
      </div>
    </div>
  );
}
