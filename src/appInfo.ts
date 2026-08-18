// The one place the app's display name/version live -- TopBar.tsx (desktop) and
// MobilePlayer.tsx (mobile) both render this exact string in their own header,
// and previously each hardcoded it separately, which is exactly the kind of
// thing that quietly drifts out of sync (one gets renamed, the other doesn't).
// Not wired into package.json's "name" or index.html's <title> -- neither can
// import a TS constant, so those stay independently maintained; this only
// covers in-app UI text.
export const APP_NAME = 'JazzMate';
export const APP_VERSION = 'v0.4';
export const APP_TITLE = `${APP_NAME} ${APP_VERSION}`;
