## Problem

Two bugs on the offline-backup card in the Backup Panel:

1. The big "Download from GitHub Release" button links to `…/releases/latest/download/gpk-image-mirror.zip`, which does not exist — the release only holds the three split parts (`gpk-image-mirror-part-001/002/003.zip`). Clicking it 404s ("leads to nowhere").
2. The size text ("~1.26 GB") comes from stale `zipBytes` in the deployed `public/gpk-manifest.json`. That manifest is missing the `zipParts` array entirely, so `getZipDownloadUrls()` falls back to a single fake `gpk-image-mirror.zip` entry — which is exactly why the multi-part UI never renders and the single broken button shows instead.

The expected behavior (per this request): one primary action that fires all three part downloads.

## Root cause

`public/gpk-manifest.json` is stale. It has `zipParts: []`, `zipFileName: null`, `zipBytes: null` (older builds wrote a single-zip shape; the current build script writes `zipParts`, but that output was never copied over top of `public/gpk-manifest.json`). Deployed prod likely still has the old single-zip shape with `zipBytes ≈ 1.26 GB`, which explains the size text the user sees.

`getZipDownloadUrls()` in `src/lib/remoteMirror.ts` compensates for a missing `zipParts` by synthesizing one entry pointing at `gpk-image-mirror.zip`, which doesn't exist on the release. That's the dead link.

## Fix

### 1. Refresh `public/gpk-manifest.json` with real `zipParts`

Rewrite the three top-level ZIP fields so runtime sees the split parts:

```json
"zipFileName": null,
"zipBytes": <sum of the three parts>,
"zipSha256": null,
"zipPartCount": 3,
"zipParts": [
  { "index": 1, "fileName": "gpk-image-mirror-part-001.zip", "bytes": <b1>, "sha256": "" },
  { "index": 2, "fileName": "gpk-image-mirror-part-002.zip", "bytes": <b2>, "sha256": "" },
  { "index": 3, "fileName": "gpk-image-mirror-part-003.zip", "bytes": <b3>, "sha256": "" }
]
```

Byte sizes will be fetched with `HEAD` requests against
`https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/gpk-image-mirror-part-00N.zip`
so the numbers match reality and the UI totals are correct. `sha256` is left empty (informational only — Load-ZIP verifies file-level hashes from `files`, not the outer ZIP).

Only `public/gpk-manifest.json` is touched; `files{}` and everything else stays as-is.

### 2. Make the primary CTA download all three parts

In `src/components/BackupPanel.tsx` `RecommendedZipCard`, when `primaryOption.parts.length > 1`:

- Render one large primary button "Download all 3 parts (~<total>)" that triggers each part URL sequentially with hidden `<a download>` anchors + a short 400 ms stagger (best-effort — some browsers throttle bulk downloads and show a permission prompt; that's expected and unavoidable).
- Keep the per-part buttons below it as a manual fallback, relabeled "Or download individually" so users always have a way if the bulk action is blocked.
- Show total size (sum of `part.bytes`) instead of the per-part sizes in the header line.

### 3. Harden the no-parts fallback

In `getZipDownloadUrls()` in `src/lib/remoteMirror.ts`, when `zipInfo.parts` is empty AND `zipFileName` is null, point the synthesized primary option at `ZIP_GITHUB_RELEASE_URL` (the release landing page) instead of a fabricated `.zip` filename. This way, even if a future deployed manifest goes stale again, the button always lands on a real page — never a 404.

## Verification

- `bunx tsc --noEmit` passes.
- Manifest HEADs return 200 for all three parts; recorded `bytes` match `Content-Length`.
- Playwright: open Offline backup panel → confirm the card shows "Download all 3 parts (~<total>)" and three per-part buttons, and that the main button triggers three navigations (checked via `page.on('download')`).

## Out of scope

- Regenerating `files{}` or re-mirroring images.
- Republishing / re-uploading the release ZIP parts (they're already live and verified).
- Any change to Backup A / Backup B download surfaces (still image-only per the 25 MB Cloudflare cap).
