## Goal

Add a small, always-visible status indicator in the header (next to the Info button) that tells users which image source is currently healthy, in priority order:

1. **IPFS live** (any public gateway responding) — green
2. **Primary mirror live** (GitHub Pages) — yellow
3. **Backup A live** (Cloudflare Pages) — yellow
4. **Offline ZIP loaded** — blue
5. **All sources down** — red

The pill reflects the highest-priority source that is currently reachable, not the source used for the last individual image.

## UX

Compact pill: colored dot + short label, e.g. `● IPFS live`, `● Primary mirror`, `● Backup A`, `● Offline ZIP`, `● All sources down`.

- Hover/tap shows a tooltip with per-source status (checking / ok / failed) and a "Recheck now" action.
- Clicking the pill opens the existing Offline backup dialog so users can act if things degrade.
- Positioned to the left of the Info button in the header, on both desktop and mobile (icon-only fallback on very narrow widths).

## How it works

New hook `useImageSourceStatus` runs a lightweight canary check on mount and every 60s:

- **IPFS check** — HEAD/GET a known-small pinned CID through the top 2 public gateways with a ~4s timeout. First success = "IPFS live".
- **Primary mirror check** — fetch `${PRIMARY_MIRROR}manifest.json` with a ~4s timeout.
- **Backup A check** — fetch `${BACKUP_MIRROR_A}manifest.json` with a ~4s timeout.
- **Local ZIP** — read existing `localMirror` state (already in memory).

Checks run in parallel; the pill shows the highest-priority source that returned OK. Re-runs on `visibilitychange` (tab becomes visible) and when the user clicks Recheck.

Results are cached in module state and exposed via a tiny subscribe API, so the pill re-renders without prop drilling.

## Technical details

- **New:** `src/hooks/useImageSourceStatus.ts` — canary logic, 60s polling, subscribe/emit pattern (mirrors the style of `remoteMirror.ts`).
- **New:** `src/components/ImageSourceIndicator.tsx` — the pill + tooltip + click-through to open Offline backup dialog.
- **Edit:** `src/pages/Index.tsx` — mount `<ImageSourceIndicator />` immediately before the existing Info button in the header (around line 1902–1911). Reuse the existing state that opens the Offline backup dialog so the click hand-off works with no new plumbing.
- No changes to `useIpfsMedia.ts`, gateway rotation, or the actual image loading path — the indicator is purely observational.

## Out of scope

- No changes to how images are fetched or which source is preferred.
- No new persistent storage.
- No telemetry.
