import { APP_TITLE } from '../appInfo';

export type MenuTarget = 'compose' | 'playAlong' | 'practice';

type MenuCard = { target: MenuTarget; title: string; subtitle: string; description: string };

const CARDS: MenuCard[] = [
  {
    target: 'compose',
    title: 'Compose',
    subtitle: '(a Hookpad-style editor)',
    description: 'Build a chord progression and melody from scratch, bar by bar.',
  },
  {
    target: 'playAlong',
    title: 'Play Along',
    subtitle: '(an iReal Pro-style chart reader)',
    description: 'Load a chart, hear a full band play it back in any key/tempo/style.',
  },
  {
    target: 'practice',
    title: 'Practice',
    subtitle: '(a jazz guitar exercise bank)',
    description: 'Drill scales, arpeggios, licks, and chord fingerings on the neck.',
  },
];

type Props = {
  onSelect: (target: MenuTarget) => void;
};

/**
 * The app's landing page -- three separate identities living on one site (the
 * user's own framing: "a Hookpad clone, an iReal Pro clone, and a
 * Duolingo-for-jazz-guitar exercise bank"), previously blurred together under
 * one always-visible TopBar with a 4-way view switcher. Picking a card sets
 * App.tsx's appMode (and, for compose/playAlong, nudges viewMode into that
 * mode's own relevant view) -- the underlying song state doesn't reset, so
 * going back to Menu and picking Compose/Play Along again resumes right where
 * you left off. Practice is fully separate on purpose (no song state, no
 * TopBar, no mixer) -- see CLAUDE.md's "App shell: Menu + three modes"
 * section for the full reasoning.
 */
export function MenuView({ onSelect }: Props) {
  return (
    <div className="menu-view">
      <h1 className="menu-view-title">{APP_TITLE}</h1>
      <div className="menu-view-cards">
        {CARDS.map((card) => (
          <button key={card.target} type="button" className="menu-view-card" onClick={() => onSelect(card.target)}>
            <span className="menu-view-card-title">{card.title}</span>
            <span className="menu-view-card-subtitle">{card.subtitle}</span>
            <span className="menu-view-card-description">{card.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
