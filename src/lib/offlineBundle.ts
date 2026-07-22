/**
 * Detect whether this build is the "offline bundle" — a ZIP of the built app
 * users can unzip and open locally when every hosted mirror is gone.
 *
 * Toggled at build time by `VITE_OFFLINE_BUNDLE=1` (see `npm run build:offline`).
 * Vite inlines `import.meta.env.VITE_OFFLINE_BUNDLE` as a string constant, so
 * this check is dead-code-eliminated in the hosted build.
 */
export function isOfflineBundle(): boolean {
  return import.meta.env.VITE_OFFLINE_BUNDLE === '1';
}
