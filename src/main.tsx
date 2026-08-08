import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MobilePlayer } from './components/MobilePlayer.tsx'

// No router — just two views. ?view=mobile/desktop forces one for testing on a
// desktop browser; otherwise a narrow/touch viewport gets the playback-only
// mobile view, since the chord grid's drag/resize/select editing doesn't
// translate to touch (see CLAUDE.md's "Direction" notes).
function resolveIsMobile(): boolean {
  const forced = new URLSearchParams(window.location.search).get('view');
  if (forced === 'mobile') return true;
  if (forced === 'desktop') return false;
  return window.matchMedia('(max-width: 820px)').matches || window.matchMedia('(pointer: coarse)').matches;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {resolveIsMobile() ? <MobilePlayer /> : <App />}
  </StrictMode>,
)
