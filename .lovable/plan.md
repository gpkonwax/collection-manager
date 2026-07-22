## Wire up Backup Mirror A (Cloudflare Pages)

Files live at the root of `gpkonwaxbackup.pages.dev` (not under `/mirror/`), so the base URL just needs the trailing slash.

### Changes

**1. `src/lib/ipfsGateways.ts`**
- Set `BACKUP_MIRROR_A = 'https://gpkonwaxbackup.pages.dev/'`

That's the only wiring needed — `fetchVerifiedMirrorFile` concatenates `baseUrl + ipfsPath` (e.g. `Qm.../base/1a.jpg`), which resolves correctly against the Cloudflare root. The pinned manifest at `public/gpk-manifest.json` is already in sync, so hash verification will work against Cloudflare identically to GitHub.

**2. `src/lib/remoteMirror.ts` — ZIP download handling for Backup A**
The current `getZipDownloadUrls()` builds `${baseUrl}gpk-image-mirror.zip` for any non-primary mirror. Cloudflare doesn't have the ZIP (25 MB per-file cap; you deliberately excluded it), so that link would 404.

Fix: skip the ZIP entry for `backupA` entirely — Backup A becomes an image-serving mirror only. The Cloudflare button will still appear in Step 2 (backup mirrors) for image recovery; it just won't appear in the "alternate ZIP sources" row. Backup B (GitLab) can carry the ZIP when it goes live tomorrow.

**3. `src/lib/remoteMirror.test.ts`**
Update the `getZipDownloadUrls` test: now `primary` is present (GitHub Release asset) and `backupA` is intentionally absent. Add an assertion that `backupA` is excluded even when its URL is configured.

### What the user sees after deploy

- **Step 1** — Built-in primary mirror: Reachable (green) — unchanged
- **Step 2** — Backup mirror A — Cloudflare Pages: shows up with a live health check (green when reachable)
- **Recommended ZIP** — still one button: "Download from GitHub Release (1.26 GB)". No alternates yet; the "Backup B will appear here once online" note stays until GitLab is live.

### Verification

- Run `bunx vitest run src/lib/remoteMirror.test.ts` to confirm the updated ZIP-URL and mirror-config tests pass.
- Run `tsgo` (typecheck).
- After deploy: open Offline backup panel and confirm Backup A shows the green "Reachable" pill.

### Not in scope

- Backup B (GitLab) — you'll do that tomorrow; it'll be a one-line addition to `BACKUP_MIRROR_B` plus letting it keep the ZIP entry (GitLab has no 25 MB cap).
- No changes to the mirror build/sync scripts; the pinned manifest already matches Cloudflare's contents byte-for-byte.
