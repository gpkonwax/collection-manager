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

export interface OfflineBuildInfo {
  /** ISO date (YYYY-MM-DD) the bundle was built. */
  date: string;
  /** Short git commit the bundle was built from, when known. */
  commit: string;
}

/**
 * Build stamp injected by `scripts/build-offline-bundle.mjs`. Returns null in
 * the hosted build (and in any offline bundle produced before stamping).
 */
export function getOfflineBuildInfo(): OfflineBuildInfo | null {
  const date = import.meta.env.VITE_OFFLINE_BUILD_DATE as string | undefined;
  if (!date) return null;
  return {
    date,
    commit: (import.meta.env.VITE_OFFLINE_COMMIT as string | undefined) ?? 'unknown',
  };
}

/** Human-friendly build date, e.g. "12 Sep 2026". Falls back to the raw value. */
export function formatOfflineBuildDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
