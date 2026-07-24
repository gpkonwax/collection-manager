## Status

Phase 1 (images) is confirmed live — `https://gpkonwaxbackup.netlify.app/manifest.json` returns JSON. You've said the 3 ZIP parts were in `public\` before the deploy, so they likely uploaded in the same pass.

Before I change any app code, we need to **prove the ZIPs are actually on Netlify**. If they aren't, the app will link users to 404s.

## Step 0 — Verify the ZIPs are live (do this first)

Open each URL in your browser. A working file will pop up a download prompt or show the browser's download bar within a second or two. A missing file shows Netlify's 404 page.

- `https://gpkonwaxbackup.netlify.app/gpk-image-mirror-part-001.zip`
- `https://gpkonwaxbackup.netlify.app/gpk-image-mirror-part-002.zip`
- `https://gpkonwaxbackup.netlify.app/gpk-image-mirror-part-003.zip`

Cancel each download as soon as it starts — we're only checking they exist.

**Case A — all 3 start downloading:** skip Phase 2, go straight to Phase 3.
**Case B — any of them 404:** run Phase 2 to upload the missing parts, then Phase 3.

## Phase 2 — Only if any ZIP 404s

**1. Confirm the missing files are actually in `public\`**
```powershell
cd C:\Users\User\Desktop\gpk-gitlab-mirror
dir public\gpk-image-mirror-part-*.zip
```
You should see all 3 with sizes ~1.76 GB, ~1.76 GB, ~465 MB. If any are missing locally, copy them in from wherever you saved them (or re-download from `https://github.com/bewbzz/gpkonwaxbackup/releases/latest`).

**2. Re-deploy**
```powershell
netlify deploy --dir=public --site=2298deaf-0948-42c4-971f-e25c8c1afba6 --prod
```
Only the missing parts upload. Expect a slow byte transfer — 30–60 min depending on your connection.

**3. Re-check the 3 URLs from Step 0.**

## Phase 3 — Wire Netlify ZIPs into the app

One file change: `src/lib/remoteMirror.ts`, function `getZipDownloadUrls`.

Currently it skips Backup A (Cloudflare's 25 MiB cap) and only emits GitHub Release URLs for the primary mirror. **Change:** for `m.key === 'backupB'` (Netlify), emit `${m.url}${part.fileName}` per part — same shape non-primary mirrors already use. Backup A stays skipped.

Result in the Offline Backup panel:
- Existing GitHub Release source (unchanged, stays primary).
- New **Backup mirror B — Netlify** source listing the same 3 parts, each pointing at `https://gpkonwaxbackup.netlify.app/gpk-image-mirror-part-00X.zip`.

The existing "Start download → Start next download" launcher works per source with no other changes.

## Phase 4 — Verify in the app

1. Hard-reload the Collection Manager.
2. Open the Offline Backup panel — two ZIP sources should now be listed, each with 3 parts.
3. Click Part 1 under Netlify and confirm the download begins from `gpkonwaxbackup.netlify.app`.

## What is intentionally NOT changing

- No changes to Primary (GitHub) or Backup A (Cloudflare).
- No changes to hash-verified image fallback — Netlify already flows through `fetchVerifiedMirrorFile` via `BACKUP_MIRROR_B`.
- No manifest regeneration — existing `zipParts` metadata is reused verbatim.
- GitHub Release stays the primary ZIP source; Netlify is added as a peer.
