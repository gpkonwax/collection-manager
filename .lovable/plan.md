## Diagnosis

The bug is not in the current code — it's that the live site at `gpkonwax.github.io/collection-manager/` is still running the pre-fix build.

Confirmed with two probes:

- `GET https://gpkonwax.github.io/collection-manager/gpk-manifest.json` returns the old manifest: `fileCount: 832`, no `zipParts`, only legacy `zipBytes: 1349536047` (≈ **1.26 GB** — exactly what the button label shows). The single button reads `zipUrl` from that manifest, which is missing/null on the old shape, so the click resolves to `undefined` and opens a blank tab.
- `GET https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/gpk-image-mirror-part-00{1,2,3}.zip` all `302 → v1.0.0/…` — the release assets are healthy.

Last turn's edits already fix both symptoms in the repo:

- `public/gpk-manifest.json` now includes the three real `zipParts` entries (sizes sum to ≈ 3.97 GB).
- `src/components/BackupPanel.tsx` now renders a primary **"Download all 3 parts"** button that iterates over `zipParts` with a 400 ms stagger, plus individual per-part links.
- `src/lib/remoteMirror.ts` hardened `getZipDownloadUrls` so an empty/missing manifest falls back to the release *page* URL instead of a broken asset URL.

## Fix

Publish the app. No further code change is needed for this issue.

After publishing, re-verify by:

1. Hard-refreshing `gpkonwax.github.io/collection-manager/` (Ctrl+Shift+R) to bust the cached bundle + manifest.
2. Opening the Offline backup panel and confirming the primary button reads **"Download all 3 parts (3.97 GB)"** and that clicking it starts three sequential `.zip` downloads from `.../releases/download/v1.0.0/gpk-image-mirror-part-001.zip` etc.
3. Confirming the three individual per-part links each 200/302 to the release asset.

## Out of scope

- Any change to the mirror content, the release assets, or the `v1.0.0` tag name.
- The separate "verify all images are backed up" tooling — still pending your A/B/C choice from the previous plan.

## Follow-up

If after republishing + hard refresh the button still says 1.26 GB, the CDN in front of GitHub Pages is serving a stale `gpk-manifest.json`; wait a minute and hard-refresh again, or append `?v=2` to the URL once to force a bypass.
