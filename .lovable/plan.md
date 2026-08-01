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

## Part 1 — Result: the repo clone is the source, and the layout is now clear

Your counts from `gpkonwaxbackup-repo`:

- `atomic\` — **1512** files
- `mirror\` — **1030** files (the three CID folders live inside it)
- whole folder — **3572** files

1512 + 1030 = 2542, so the remaining 1030 are the three CID folders sitting at the repo root — a second copy of what is already inside `mirror\`. That is fine for the website, but it means we must **not** point the ZIP builder at the repo root: it zips every file it finds, so it would pack `.git`, `.wrangler`, and 1,030 duplicate images.

The SimpleAssets side (1030) is complete.

## Part 2 — Result: the atomic set is nearly complete

The dry run reports **1547 unique images** across 12 schemas (series1 299, series2 737, exotic 171, crashgordon 31, bernventures 51, mittens 43, gamestonk 47, foodfightb 113, originalart 45, promo 2, bonus 2, packs 6).

You have **1512** on disk, so the gap is only **35 images** — not the ~1,100 I had feared. The earlier "~2,600" figure was wrong; 1547 is the real target. Part 3b is a short run, and the full backup is 1030 + 1547 = **2577 files**, not 3,600.

## Part 3 — Point the scripts at a clean staging folder

Make a fresh folder that contains only what belongs in the ZIP:

```
cd /d C:\Users\User\Desktop
```

```
robocopy gpkonwaxbackup-repo\mirror gpk-zip-src\mirror /E
```

```
robocopy gpkonwaxbackup-repo\atomic gpk-zip-src\atomic /E
```

Robocopy prints a summary table and exits with a code of 1 on success — that is normal, not an error.

Confirm the staging folder holds 2542 files:

```
dir /s /b gpk-zip-src\*.jpg gpk-zip-src\*.gif | find /c /v ""
```

Then put the updated scripts in place:

```
cd /d C:\Users\User\Desktop\gpk-app-latest2\scripts
```

```
copy /Y ..\..\gpk-app-latest2-new\scripts\mirror-config.json .
```

```
copy /Y ..\..\gpk-app-latest2-new\scripts\build-image-mirror.mjs .
```

Each should say `1 file(s) copied.` Confirm the config is the new Series 2 version — this should print matching lines rather than nothing:

```
findstr /C:"returning" /C:"sharedBack" mirror-config.json
```

Now open it:

```
notepad mirror-config.json
```

Change the `outDir` line near the top to the staging folder, with doubled backslashes because it is JSON:

```
  "outDir": "C:\\Users\\User\\Desktop\\gpk-zip-src",
```

Save and close.

The `mirror\` prefix inside the ZIP is expected — the offline loader strips it automatically, and it reads atomic files from `atomic\`, so this layout is exactly what the app wants.

## Part 3b — Top up the AtomicAssets series

Only if the Part 2 dry run showed a number well above 1512:

```
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```
node scripts/build-atomic-mirror.mjs
```

It skips anything already on disk. Note it writes into its own configured output folder, so once it finishes we copy the new files across:

```
cd /d C:\Users\User\Desktop
```

```
robocopy gpk-app-latest2\mirror-output\atomic gpk-zip-src\atomic /E
```

Then re-count:

```
dir /s /b gpk-zip-src\*.jpg gpk-zip-src\*.gif | find /c /v ""
```

Send me the number before we zip.

## Part 4 — Build the ZIP parts

Clear out any stale parts first. "Could Not Find" here is fine:

```
del C:\Users\User\Desktop\gpk-zip-src\gpk-image-mirror-part-*.zip
```

Then build:

```
cd /d C:\Users\User\Desktop\gpk-app-latest2
node scripts/build-image-mirror.mjs --zip-only --split-zip
```

**Sanity check before uploading anything:** the file count in the output must match the staging-folder count from Part 3 (2542, or higher after Part 3b). If it reports ~1,000 files, or a single small part, the `outDir` edit in Part 3 did not take — stop and tell me. Expect roughly 3 GB or more spread across multiple parts.

Write down the part names and byte sizes it prints; I need them at the end.

## Part 5 — Make sure the `_headers` file exists

This one belongs to the deployed mirror folders, not the ZIP staging folder. Check `C:\Users\User\Desktop\gpkonwaxbackup-repo` for a file named exactly `_headers`, with no `.txt`. Without it the mirror reports as unreachable in the app. If it is missing:

```
cd /d C:\Users\User\Desktop\gpkonwaxbackup-repo
```

```
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
4. Drag the new parts from `C:\Users\User\Desktop\gpk-zip-src` into the assets box.
5. Wait for every upload to reach 100%, then click **Update release**.
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
