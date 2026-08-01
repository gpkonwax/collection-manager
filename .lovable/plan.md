# Stop — the ZIP you just built is incomplete

Do not upload it anywhere yet.

## What the output is telling us

Your rebuild produced **one** part at **1.65 GB with 1045 files**. The ZIPs currently on the GitHub Release are **three parts totalling roughly 4.2 GB**. That difference is not a rounding error — the folder you zipped from is missing most of the backup.

Two things in the output confirm it:

- `Done. files=1030 missing=879` — 879 entries the SimpleAssets config expects were never downloaded into this folder.
- Only 1045 files were zipped. The Atomic GPK series (Crash Gordon and the rest, roughly 2,600 images under `mirror-output\atomic\`) are not in this folder at all — if they were, they would have been swept into the ZIP automatically.

So `gpk-app-latest2-new\scripts\mirror-output` is a partial tree. Your complete tree is most likely the older project folder, `gpk-app-latest1`.

Also note: that run rewrote `public\gpk-manifest.json` locally to say "1 ZIP part". Do not push or deploy that file — it would tell every user there is only one part to download.

## Where you should do this work

You can run the mirror build from **any** project folder on your PC — it does not have to be a git clone. The mirror scripts only care about the `scripts\mirror-output` folder next to them.

Right now you have at least two project folders on the desktop:

- `gpk-app-latest1` — probably the one with the full 4.2 GB backup.
- `gpk-app-latest2-new` — the one you just ran, which is incomplete.

The app code in Lovable is synced to GitHub, but the **mirror data** is not in the repo (it is too large). So the GitHub clone is for the app code only. For the backup ZIPs, use whichever local folder has the complete `scripts\mirror-output`.

## Part 1 — Find out which folder actually holds the full backup

Open Command Prompt and run these commands. Each one prints how many image files that folder holds.

```
dir /s /b C:\Users\User\Desktop\gpk-app-latest2-new\scripts\mirror-output\*.jpg C:\Users\User\Desktop\gpk-app-latest2-new\scripts\mirror-output\*.gif | find /c /v ""
```

```
dir /s /b C:\Users\User\Desktop\gpk-app-latest1\scripts\mirror-output\*.jpg C:\Users\User\Desktop\gpk-app-latest1\scripts\mirror-output\*.gif | find /c /v ""
```

And check whether each one has the atomic folder:

```
dir C:\Users\User\Desktop\gpk-app-latest2-new\scripts\mirror-output\atomic
dir C:\Users\User\Desktop\gpk-app-latest1\scripts\mirror-output\atomic
```

Paste the four results back to me. The folder with roughly 3,600+ images **and** an `atomic` folder is the real backup.

## Part 2 — What happens next (depends on Part 1)

**If `gpk-app-latest1` is the complete one** (most likely): we work from there instead. You copy the two refreshed Series 2 files into it, top it up, and zip from there:

1. Copy the new `scripts\mirror-config.json` and `scripts\build-image-mirror.mjs` from `gpk-app-latest2-new` into `gpk-app-latest1\scripts` (overwrite).
2. From `gpk-app-latest1`, run `node scripts/build-image-mirror.mjs --retry-all-missing` to pull down the Series 2 side-c / raw / returning images into that complete tree.
3. Copy the freshly downloaded Series 2 images from `gpk-app-latest2-new\scripts\mirror-output` in as well if the retry misses any.
4. Only then run `node scripts/build-image-mirror.mjs --zip-only --split-zip` from `gpk-app-latest1`.
5. Sanity check before uploading: the run must report **3 or more parts** and a total near 4.2 GB. One part means the tree is still incomplete — stop and tell me.

**If neither folder is complete:** we rebuild the full backup in one place by running `build-image-mirror.mjs` and then `build-atomic-mirror.mjs` into the same `mirror-output`, which takes several hours of downloading. I would only do this as a last resort.

## Part 3 — After a correct ZIP build (do not start this yet)

1. Replace the ZIP assets on the GitHub Release with the new parts.
2. Deploy the updated `mirror-output` (with its new `manifests\manifest.json`) to Netlify and Cloudflare, keeping ZIPs out of Cloudflare.
3. Push the updated `manifests\manifest.json` to the `bewbzz/gpkonwaxbackup` repo.
4. Run `node scripts/audit-mirrors.mjs` and confirm all three say COMPLETE.
5. Give me the final part count and sizes so I can update the hardcoded fallback values in `scripts/sync-pinned-manifest.mjs` to match.

## Technical notes

- `--zip-only` packs whatever is physically on disk under `mirror-output`, including `atomic/`. The small output proves the atomic tree is absent from `gpk-app-latest2-new`.
- `missing=879` is persisted in that folder's `manifests/manifest.json` from earlier partial runs; `--retry-all-missing` clears that skip list and re-attempts every entry.
- Nothing published is broken right now — the live mirrors and the current Release ZIPs are untouched. The only local damage is the rewritten `public/gpk-manifest.json`, which will be regenerated correctly on the next good build.
