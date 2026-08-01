# Mirror audit follow-up: Cloudflare is fine, GitHub Pages is offline

## What I verified just now (live checks)

Real file tested on all three mirrors: `QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg`

- Netlify: 200, 198,408 bytes, `image/jpeg`
- Cloudflare: 200, 198,408 bytes, `image/jpeg` (byte-identical size)
- GitHub Pages: 404
- A deliberately fake filename returns 404 on Netlify and Cloudflare, so those 200s are real files, not a catch-all page.
- `https://gpkonwaxbackup.github.io/gpk-backup/` and `https://gpkonwaxbackup.github.io/` both return 404 — the whole Pages site is down, not just the mirror folder.

## Answer: why Cloudflare shows no missing files

The 25 MiB Cloudflare Pages limit only ever blocked the **split ZIP parts** (1.65 GiB each) — not the images. Individual card images are all well under 25 MiB, so every one of the 1,030 manifest entries uploaded fine.

Also, the audit script deliberately skips ZIP checking on Cloudflare (`checkZips: false` in `scripts/audit-mirrors.mjs`), because the ZIPs are intentionally not hosted there. So "COMPLETE" for Cloudflare means "every image is present and correct" — which is true — and says nothing about the ZIPs, which correctly live on GitHub Releases and Netlify only.

The 25 sha256 samples also matched on both Netlify and Cloudflare, so the content is genuine, not placeholder responses.

## The real problem: Primary (GitHub Pages) is serving nothing

All 1,030 files reported missing because the site itself 404s at every level. That is a Pages configuration issue, not a missing-files issue. Likely one of:

1. GitHub Pages was never enabled (or got disabled) on `gpkonwaxbackup/gpk-backup`.
2. Pages is enabled but pointed at the wrong branch or wrong folder (must be `main` + `/` root with a `mirror/` folder inside, or `main` + `/docs`).
3. The repository is private — Pages on private repos requires a paid plan and serves 404 otherwise.
4. The push of the `mirror/` folder never completed (large-file/HTTPS failures you hit earlier).

## Plan

1. Open `https://github.com/gpkonwaxbackup/gpk-backup/settings/pages` and record: is Pages enabled, which branch, which folder, and is the repo public.
2. Confirm the repo actually contains `mirror/` with the CID folders inside by browsing the repo's file list on github.com.
3. Fix whichever of those is wrong: make the repo public, enable Pages on `main` with folder `/ (root)`, and re-push `mirror/` if the folder is absent.
4. Wait for the Pages deploy to go green, then re-check with `curl` (or just open the URL) on:
   `https://gpkonwaxbackup.github.io/gpk-backup/mirror/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg`
5. Re-run `node scripts/audit-mirrors.mjs --only primary` to confirm 0 missing.

No app code changes are needed — Netlify (Backup A) and Cloudflare (Backup B) are both fully healthy, so the app's fallback chain still works today.

## Note on the audit output

Your run reported 1,030 manifest entries, which means your local copy has both `public/gpk-manifest.json` (832 entries) and `public/atomic-manifest.json` loaded. This project checkout only has the 832-entry GPK manifest, so run audits from your local folder to keep covering the Atomic series too.
