# Rebuild the downloadable ZIPs from the full backup folder

The ZIP you built earlier came from `gpk-app-latest2-new`, which only holds a partial tree (1045 files, 1.65 GB, no `atomic` folder). The full backup lives in **`C:\Users\User\Desktop\gpk-app-latest2`**. All the work below happens in that folder.

Nothing published is broken right now. The live mirrors and the ZIPs currently on the GitHub Release are untouched. Do not upload the 1-part ZIP you just made — delete it when convenient.

## Part 1 — Locate the mirror-output folder, then confirm it is complete

In `gpk-app-latest2` the mirror folder is probably **not** inside `scripts` — earlier you were deploying from `C:\Users\User\Desktop\gpk-app-latest2\mirror-output`, i.e. at the top level of the project. Find it for certain:

```
dir /s /b /ad C:\Users\User\Desktop\gpk-app-latest2\mirror-output
```

Note the path it prints. In the commands below, wherever I write `<MIRROR>`, substitute that exact path.

Count the images:

```
dir /s /b <MIRROR>\*.jpg <MIRROR>\*.gif | find /c /v ""
```

Check the atomic folder exists:

```
dir <MIRROR>\atomic
```


You are expecting a large number (roughly 3,600+) and a directory listing rather than "File Not Found". If either looks wrong, stop and tell me before going further.

## Part 2 — Put the updated scripts into that folder

The Series 2 fix lives in two files that must be the new versions. Copy them from the newer folder over the old ones:

```
copy /Y C:\Users\User\Desktop\gpk-app-latest2-new\scripts\mirror-config.json C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-config.json
copy /Y C:\Users\User\Desktop\gpk-app-latest2-new\scripts\build-image-mirror.mjs C:\Users\User\Desktop\gpk-app-latest2\scripts\build-image-mirror.mjs
```

Confirm the config is the new one — this should print matching lines rather than nothing:

```
findstr /C:"returning" /C:"sharedBack" C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-config.json
```

**Important — point the config at your existing mirror folder.** The new config contains a line near the top that reads:

```
"outDir": "./mirror-output",
```

That path is relative to the `scripts` folder, so it means `gpk-app-latest2\scripts\mirror-output`. If Part 1 showed your real folder is at the project top level (`gpk-app-latest2\mirror-output`), open the config in Notepad:

```
notepad C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-config.json
```

and change that line to:

```
"outDir": "../mirror-output",
```

Save and close. Get this wrong and the script will start a brand new empty folder instead of topping up your real one.


## Part 3 — Download the missing Series 2 images into the full tree

Move into the full folder:

```
cd C:\Users\User\Desktop\gpk-app-latest2
```

Then run the top-up. This clears the old "skip these" list and re-attempts every entry, downloading only what is not already on disk:

```
node scripts/build-image-mirror.mjs --retry-all-missing
```

This one does hit the network, so give it time. When it ends it prints a `Done. files=... missing=...` line. A small `missing` count is normal (some card variants genuinely do not exist); a huge one means something went wrong — send me the line if you are unsure.

If some entries fail with timeouts, run this once to retry them slowly:

```
node scripts/build-image-mirror.mjs --retry-errors
```

## Part 4 — Build the ZIP parts

Delete any stale parts in the mirror folder first (a "Could Not Find" message here is fine). Use your `<MIRROR>` path:

```
del <MIRROR>\gpk-image-mirror-part-*.zip
```


Then build:

```
node scripts/build-image-mirror.mjs --zip-only --split-zip
```

**Sanity check before you upload anything:** the output must report **3 or more parts** totalling roughly 4.2 GB or more. If it says 1 part / 1.65 GB again, the tree is not the full one — stop and tell me.

Write down the part names and sizes it prints; I need them at the end.

## Part 5 — Create the `_headers` file if it is missing

Look in `C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-output` for a file named exactly `_headers` (no `.txt`). Without it the mirror reports as unreachable. If it is missing:

```
cd C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-output
notepad _headers
```

Say Yes to creating it, paste this in, save, close:

```
/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Allow-Headers: *
```

## Part 6 — Upload the new ZIPs to the GitHub Release

1. Go to `https://github.com/bewbzz/gpkonwaxbackup/releases`.
2. Open the latest release, click **Edit** (pencil icon).
3. Remove the old `gpk-image-mirror-part-*.zip` assets with the small x next to each.
4. Drag the new parts from `C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-output` into the assets box.
5. Wait for every upload to reach 100%, then click **Update release**.

Never `git push` the ZIPs — they are far too big for the repo.

## Part 7 — Push the refreshed manifest and images to the three mirrors

The build rewrote `mirror-output\manifests\manifest.json` with the new part list, sizes and hashes. Every mirror needs it, otherwise the app will still ask for the old parts.

**Netlify (Backup A)** — from `C:\Users\User\Desktop\gpk-app-latest2\scripts\mirror-output`:

```
netlify deploy --prod --site gpkonwaxbackup --dir . --build-ignore
```

**Cloudflare (Backup B)** — ZIPs must be out of the way first because Pages rejects files over 25 MB:

```
cd C:\Users\User\Desktop\gpk-app-latest2\scripts
mkdir zip-holding
move mirror-output\gpk-image-mirror-part-001.zip zip-holding
move mirror-output\gpk-image-mirror-part-002.zip zip-holding
move mirror-output\gpk-image-mirror-part-003.zip zip-holding
```

Run your usual Wrangler deploy, then move them back:

```
move zip-holding\gpk-image-mirror-part-*.zip mirror-output
```

**GitHub Pages (Primary)** — copy the updated `manifests\manifest.json` (and any new Series 2 image folders) into your `gpkonwaxbackup` repo clone under `mirror\`, then commit and push.

## Part 8 — Verify

```
cd C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

You want `COMPLETE` on Primary, Backup A and Backup B.

Then open the app, go to **Offline backup**, and check the total download size matches the new combined part size. Download one part and load it in to confirm it ingests cleanly.

Finally, send me the part count and byte sizes the build printed so I can update the hardcoded fallback values in `scripts/sync-pinned-manifest.mjs` to match.

## Technical notes

- `--zip-only` packs everything physically present under `mirror-output`, including `atomic/`, so one rebuild covers both the SimpleAssets and AtomicAssets backups.
- `--retry-all-missing` clears the persisted `missing[]` skip list in `manifests/manifest.json` and re-attempts every configured entry; already-downloaded files are left alone.
- The earlier run in `gpk-app-latest2-new` rewrote that folder's `public/gpk-manifest.json` to claim a single ZIP part. Do not deploy that copy; the good build in `gpk-app-latest2` regenerates it correctly.
