// Screen Wake Lock API — keeps the display from sleeping while a song is
// actively playing. Mobile's short auto-lock timeouts are the main target
// (see engine.ts's play()/stop()), but nothing here is mobile-only; desktop
// gets the same protection against a screensaver/display-sleep kicking in
// mid-song, for free.
//
// Feature-detected, not polyfilled: iOS Safari only gained support in 16.4,
// and this is a nice-to-have, not something worth a fallback for on older
// browsers — playback works exactly as before there, just without the screen
// staying on. This does NOT address the separate "audio dies on backgrounding"
// failure mode engine.ts's visibilitychange handler already covers — a wake
// lock only stops the OS's own idle-timeout sleep; it can't prevent (and
// isn't meant to prevent) the AudioContext suspension the OS triggers on an
// actual backgrounding event (screen lock, app switch, notification shade).
let sentinel: WakeLockSentinel | null = null;

export async function acquireWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
  } catch {
    // Can reject if the document isn't visible/focused at request time, or
    // the platform declines (e.g. some OSes' low-power mode) — playback is
    // unaffected either way, just without the screen-stays-on behavior.
    sentinel = null;
  }
}

export function releaseWakeLock(): void {
  sentinel?.release().catch(() => {});
  sentinel = null;
}
