# Fix the mirror audit: wrong Primary URL, plus an atomic-path gap on GitHub Pages

## What I verified live just now

Your Pages site is fine. The audit script was pointed at a URL that never existed.

- `https://bewbzz.github.io/gpkonwaxbackup/mirror/manifest.json` -> 200 (703 KB)
- `https://bewbzz.github.io/gpkonwaxbackup/mirror/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg` -> 200 (198,408 bytes, identical size to Netlify and Cloudflare)
- `https://gpkonwaxbackup.github.io/gpk-backup/mirror/` (the URL the audit used) -> 404 at every level, because that account/repo does not exist.

The app itself is already correct: `src/lib/ipfsGateways.ts` has `PRIMARY_MIRROR = 'https://bewbzz.github.io/gpkonwaxbackup/mirror/'`. Only `scripts/audit-mirrors.mjs` has the stale address.

## Answer to the earlier question about Cloudflare

Cloudflare showed no missing files because its 25 MiB limit only ever blocked the multi-gigabyte ZIP parts, never the individual card images — and the audit intentionally skips ZIP checks on Cloudflare (`checkZips: false`). The 25 sha256 samples matched, so its images are genuine.

## Second, real finding: atomic images are not reachable under the Primary base URL

In the backup repo, `atomic/` sits at the repo root, next to `mirror/` — not inside it. Verified:

- `https://bewbzz.github.io/gpkonwaxbackup/atomic/QmNYP2...jpg` -> 200
- `https://bewbzz.github.io/gpkonwaxbackup/mirror/atomic/QmNYP2...jpg` -> 404

Since the app's Primary base is `.../gpkonwaxbackup/mirror/`, every atomic (Crash Gordon etc.) lookup on the Primary mirror resolves to the 404 path. The same file also 404s on Netlify and Cloudflare at `atomic/<cid>.jpg`, so atomic coverage across mirrors needs its own check.

## Plan

1. **Fix the audit script.** In `scripts/audit-mirrors.mjs`, change the primary entry's `baseUrl` to `https://bewbzz.github.io/gpkonwaxbackup/mirror/`.
2. **Teach the audit about atomic paths.** Manifest entries whose stored path begins with `atomic/` live one level above the `mirror/` base on GitHub. Add an optional `atomicBaseUrl` per mirror (GitHub: `https://bewbzz.github.io/gpkonwaxbackup/`; Netlify and Cloudflare: same as their base) and route those entries there, so the audit reports atomic coverage truthfully instead of silently passing or failing them all.
3. **Re-run the audit** locally (`node scripts/audit-mirrors.mjs`) to get an accurate three-mirror picture including the atomic series.
4. **Depending on step 3**, either align the atomic folder placement on the mirrors (simplest: put a copy of `atomic/` inside `mirror/` on GitHub so one base URL serves everything, and upload `atomic/` to Netlify and Cloudflare), or teach `src/lib/remoteMirror.ts` a per-mirror atomic base. I recommend the first — one base URL per mirror keeps the client logic simple and matches how Netlify and Cloudflare are already laid out.

## Technical notes

- Files to change: `scripts/audit-mirrors.mjs` (URL + atomic routing). No app-code change needed if we go with the folder-placement fix in step 4.
- No change to `src/lib/ipfsGateways.ts` — its URLs are already right.
- The audit's HEAD-then-sample-sha approach stays as is; bogus paths correctly return 404 on all three hosts, so a 200 in the audit really means the file is there.
