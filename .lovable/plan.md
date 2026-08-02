# Nothing is missing — your local audit script is out of date

Both mirrors are fine. The 515 "missing" entries are a bug in the copy of `audit-mirrors.mjs` sitting in your local `gpk-app-latest2` folder, not a gap in the uploads.

## Proof

I took three paths straight from your `missing-cloudflare.txt` and requested them two ways:

```text
404  https://gpkonwaxbackup.pages.dev/QmTS7dmxag.../4a.gif
200  https://gpkonwaxbackup.pages.dev/atomic/QmTS7dmxag.../4a.gif

404  https://gpkonwaxbackup.netlify.app/QmcAky.../error/49b.jpg
200  https://gpkonwaxbackup.netlify.app/atomic/QmcAky.../error/49b.jpg
```

The files are there. Your script asked for them at the wrong URL.

## Why exactly 515

The manifest has 1545 atomic entries. 1030 of them use a key that already starts with `atomic/`; the other **515** have a bare key and carry the real location in a separate `path` field. The current script honours that `path` field. Your older local copy does not, so it requests those 515 without the `atomic/` prefix and gets a genuine 404 — identically on both CDNs, which is why the two audits matched to the file.

The Netlify ZIP 404s are the same story: your old copy checks ZIP parts on every mirror, but the split ZIPs only ever live as GitHub Release assets. The current script checks them on the primary only.

## Actual state, verified from here against all 2575 entries

| Mirror | Coverage | Status |
| --- | --- | --- |
| Primary (GitHub Pages) | 2575 / 2575 + 3 ZIP parts | Complete |
| Backup A (Netlify) | 2575 / 2575 | Complete |
| Backup B (Cloudflare) | 2565 / 2575 | Complete minus 10 oversized files |

The 10 Cloudflare gaps are the files over its hard 25 MiB per-file limit. They are on the primary, on Netlify, and in the ZIPs, so nothing is at risk. **No re-uploads needed — do not deploy anything again.**

## Step 1 — Refresh your local script

Copy the current `scripts/audit-mirrors.mjs` from this project over the one in `C:\Users\User\Desktop\gpk-app-latest2\scripts\`, replacing it. Same for `scripts/verify-mirror.mjs` while you are there.

## Step 2 — Re-run

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

Expected: Primary `COMPLETE`, Netlify `missing: 0`, Cloudflare `missing: 10` (all `atomic/Qm*.gif|webp`, each over 25 MiB).

## Step 3 — Make the audit self-explanatory (code change, needs build mode)

So this never causes a false alarm again:

- In `scripts/audit-mirrors.mjs`, add a `KNOWN_OVERSIZE` list of the 10 Cloudflare-excluded paths. Report them as `expected exclusions` rather than `missing`, so Cloudflare's verdict reads `COMPLETE (10 expected exclusions)`.
- Print the resolved URL alongside each missing entry in `missing-<mirror>.txt`, so a path-resolution bug is obvious at a glance instead of looking like a gap.
- Print the script's own version/date in the header so a stale local copy is visible immediately.

Say the word and I will make those three changes.
