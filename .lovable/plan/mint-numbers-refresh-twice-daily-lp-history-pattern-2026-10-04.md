# Mint numbers: refresh twice daily (lp-history pattern)

## Goal
Run the incremental mint-number refresh twice a day instead of quarterly, copying the reliability pattern from cheesehub's `lp-history.yml`.

## How lp-history does it (and what we copy)
GitHub's shared cron queue often delays ticks by hours or drops them entirely. lp-history works around this by scheduling **4 ticks per 12-hour slot** (00:41, 03:41, 06:41, 09:41 and 12:41, 15:41, 18:41, 21:41 UTC). Extra ticks are cheap no-ops, so at least one tick per slot almost always lands.

## Changes to `.github/workflows/mint-manifest.yml`

1. **Schedule** — replace the quarterly cron with 8 ticks, 4 per 12-hour slot (same times as lp-history, shifted to :47 to avoid colliding with lp-history's :41 if both repos share runners):
   - `47 0,3,6,9,12,15,18,21 * * *`
2. **Scheduled runs always use incremental mode** — the `mode` input only applies to manual runs; a scheduled run has no inputs, so it already defaults to incremental. Make this explicit so a schedule tick can never trigger a full 1–2 h rescan.
3. **Drop the timeout from 150 to 30 minutes** — incremental runs take ~5 min; a lower timeout kills a hung run fast instead of burning 2.5 h.
4. **Skip-when-nothing-new is already built in** — the commit step exits quietly when no new mints were found, so most ticks produce no commit and no release upload churn. Keep as-is.
5. **Concurrency guard stays** (`gpk-manifests` group, no cancel-in-progress) so overlapping ticks queue instead of clashing on push.

## What does NOT change
- The monthly holders workflow (10th of each month) is untouched.
- Full mode remains available as a manual choice in the Actions tab for refreshing circulating/burned counts.
- Records ZIP rebuild + upload still runs after each mint refresh, so the downloadable ZIP picks up new mints the same day.

## Verification
- YAML syntax check on the edited workflow.
- Confirm cron expressions parse (8 ticks, correct hours).
- After merge: first scheduled tick appears in the Actions tab within a day; manual "Run workflow" still offers incremental/full.

## Technical details
- Only file edited: `.github/workflows/mint-manifest.yml`.
- Cron is UTC: ticks at 00:47, 03:47, 06:47, 09:47, 12:47, 15:47, 18:47, 21:47 = two guaranteed windows per day (morning and evening Brisbane time).
- No secrets, permissions, or script changes needed.
