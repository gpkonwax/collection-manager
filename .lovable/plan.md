# Rebuild the downloadable ZIPs from the full backup folder

Your full backup is confirmed at:

```
C:\Users\User\Desktop\gpk-app-latest2\mirror-output
```

It contains the `atomic` folder (Crash Gordon and the other AtomicAssets series) plus the SimpleAssets CID folders, so this is the real tree. Note it sits at the **top level** of the project, not inside `scripts` — that matters in Part 2.

The ZIP you built earlier came from `gpk-app-latest2-new`, which is only a partial tree (1045 files, 1.65 GB, no atomic folder). Do not upload it. Nothing published is broken — the live mirrors and the current Release ZIPs are untouched.

## Part 0 — Fix the wrapping problem first

Your Command Prompt window is cutting long commands in half at the line break, so the second half runs as its own broken command. That is why you saw "The system cannot find the path specified" and why two files were copied into `C:\Users\User` instead of the project.

Two fixes:

1. Make the window wider — right-click the Command Prompt title bar, choose **Properties**, then the **Layout** tab, and set **Window Size Width** to `120`. Click OK.
2. From here on, every command below is short because we `cd` into the folder first. Copy and run them **one line at a time**, pressing Enter after each.

Clean up the two files that landed in the wrong place:

```
del C:\Users\User\mirror-config.json
del C:\Users\User\build-image-mirror.mjs
```

If it says it cannot find them, that is fine — nothing to clean.

## Part 1 — Result: the repo clone is the fullest copy

Your counts:

- `gpk-app-latest2\mirror-output` — **2344** files (1512 atomic + ~830 SimpleAssets)
- `gpkonwaxbackup-repo` — **3572** files

The repo clone wins by over 1,200 files, and it is also the exact tree that already feeds the live Primary mirror, so it is the source we build the ZIPs from. From here on this is the **build folder**:

```
C:\Users\User\Desktop\gpkonwaxbackup-repo
```

One thing to settle before zipping: that folder has both a `mirror` subfolder *and* the three CID folders at its root, so I need to know whether those are two copies of the same images or two different halves. Run these four, one line at a time:

```
cd /d C:\Users\User\Desktop\gpkonwaxbackup-repo
```

```
dir /s /b atomic\*.jpg atomic\*.gif | find /c /v ""
```

```
dir /s /b mirror\*.jpg mirror\*.gif | find /c /v ""
```

```
dir /b /ad mirror
```

Send me those three results. They tell me which folder the ZIP should be built from — if `mirror` contains its own copy of the CID folders, we zip `mirror` plus `atomic`; if it is a thin wrapper, we zip the root.

Also check whether the download manifest travelled with the clone:

```
dir /s /b manifest*.json
```

If nothing comes back, the ZIP builder cannot use its file list and we will regenerate it in Part 2.

## Part 2 — Point the scripts at the build folder

The scripts live in your app project; the images live in the repo clone. Rather than moving 3,572 files, we point the config at the clone.

```
cd /d C:\Users\User\Desktop\gpk-app-latest2\scripts
```

```
copy /Y ..\..\gpk-app-latest2-new\scripts\mirror-config.json .
```

```
copy /Y ..\..\gpk-app-latest2-new\scripts\build-image-mirror.mjs .
```

Each should say `1 file(s) copied.`

Confirm the config is the new Series 2 version — this should print matching lines rather than nothing:

```
findstr /C:"returning" /C:"sharedBack" mirror-config.json
```

Now open it:

```
notepad mirror-config.json
```

Change the `outDir` line near the top from `"./mirror-output"` to the absolute path of the build folder (or the subfolder Part 1 identifies), using double backslashes because it is JSON:

```
  "outDir": "C:\\Users\\User\\Desktop\\gpkonwaxbackup-repo",
```

Save and close. I will confirm the exact value once I see your Part 1 results — if `mirror` holds the CID folders, this becomes `...\\gpkonwaxbackup-repo\\mirror` and we handle `atomic` separately.

## Part 3 — Top up anything still missing

```
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```
node scripts/build-image-mirror.mjs --retry-all-missing
```

This clears the old "skip these" list and re-attempts every configured entry. Files already on disk are left alone, so only genuinely absent images get fetched — with 3,572 already present this should be a short run. It prints `Done. files=... missing=...` at the end; send me that line.

If entries fail with timeouts, run this once to retry them slowly:

```
node scripts/build-image-mirror.mjs --retry-errors
```

## Part 3b — Top up the AtomicAssets series

Only needed if Part 1 shows the atomic count below ~2,600:

```
node scripts/build-atomic-mirror.mjs
```

It skips what is already on disk. Afterwards re-count from the build folder:

```
cd /d C:\Users\User\Desktop\gpkonwaxbackup-repo
```

```
dir /s /b *.jpg *.gif | find /c /v ""
```


## Part 4 — Build the ZIP parts

Clear out any stale parts first. "Could Not Find" here is fine:

```
del C:\Users\User\Desktop\gpk-app-latest2\mirror-output\gpk-image-mirror-part-*.zip
```

Then build:

```
cd C:\Users\User\Desktop\gpk-app-latest2
node scripts/build-image-mirror.mjs --zip-only --split-zip
```

**Sanity check before uploading anything:** the output must report **3 or more parts** totalling roughly 4.2 GB or more. If it says 1 part / 1.65 GB, the `outDir` edit in Part 2 did not take — stop and tell me.

Write down the part names and byte sizes it prints; I need them at the end.

## Part 5 — Make sure the `_headers` file exists

Look in `C:\Users\User\Desktop\gpk-app-latest2\mirror-output` for a file named exactly `_headers`, with no `.txt`. Without it the mirror reports as unreachable in the app. If it is missing:

```
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
notepad _headers
```

Say Yes to creating it, paste this in, save, close:

```
/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Allow-Headers: *
```

If Notepad saved it as `_headers.txt`, fix it with:

```
ren _headers.txt _headers
```

## Part 6 — Upload the new ZIPs to the GitHub Release

1. Go to `https://github.com/bewbzz/gpkonwaxbackup/releases`.
2. Open the latest release and click **Edit** (the pencil icon).
3. Remove the old `gpk-image-mirror-part-*.zip` assets using the small x next to each.
4. Drag the new parts from `C:\Users\User\Desktop\gpk-app-latest2\mirror-output` into the assets box.
5. Wait for every upload to reach 100%, then click **Update release**.

Never `git push` the ZIPs — they are far too large for a repo.

## Part 7 — Push the refreshed manifest and images to the three mirrors

The build rewrote `mirror-output\manifests\manifest.json` with the new part list, sizes and hashes. Every mirror needs that file, otherwise the app will keep asking for the old parts.

**Netlify (Backup A)** — from the mirror folder:

```
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
netlify deploy --prod --site gpkonwaxbackup --dir . --build-ignore
```

**Cloudflare (Backup B)** — Pages rejects anything over 25 MB, so move the ZIPs out first:

```
cd C:\Users\User\Desktop\gpk-app-latest2
mkdir zip-holding
move mirror-output\gpk-image-mirror-part-001.zip zip-holding
move mirror-output\gpk-image-mirror-part-002.zip zip-holding
move mirror-output\gpk-image-mirror-part-003.zip zip-holding
```

Run your usual Wrangler deploy, then put them back:

```
move zip-holding\gpk-image-mirror-part-*.zip mirror-output
```

**GitHub Pages (Primary)** — copy the updated `manifests\manifest.json` and any newly downloaded Series 2 image folders into your `gpkonwaxbackup` repo clone under `mirror\`, then commit and push.

## Part 8 — Verify

```
cd C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

You want `COMPLETE` on Primary, Backup A and Backup B.

Then open the app, go to **Offline backup**, and confirm the total download size matches the new combined part size. Download one part and load it in to confirm it ingests cleanly.

Finally, send me the part count and byte sizes the build printed so I can update the hardcoded fallback values in `scripts/sync-pinned-manifest.mjs` to match.

## Technical notes

- `--zip-only` packs everything physically present under the configured `outDir`, including `atomic/`, so one rebuild covers both the SimpleAssets and AtomicAssets backups.
- `--retry-all-missing` clears the persisted `missing[]` skip list in `manifests/manifest.json` and re-attempts every configured entry; existing files are untouched.
- The earlier run in `gpk-app-latest2-new` rewrote that folder's `public/gpk-manifest.json` to claim a single ZIP part. Do not deploy that copy; the good build in `gpk-app-latest2` regenerates it correctly.
