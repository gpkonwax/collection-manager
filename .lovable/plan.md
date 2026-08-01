# Finish the ZIP rebuild from the current staging folder

You are here:

- Staging folder `C:\Users\User\Desktop\gpk-zip-src` exists and holds **2542** image files.
- That is **1030** SimpleAssets + **1512** AtomicAssets.
- The dry run says the AtomicAssets target is **1547** unique images, so **35 images are still missing**.
- `verify-mirror.mjs` currently fails because no `manifest.json` exists yet in `mirror-output`.

## Step 1 — Fetch the 35 missing atomic images

The atomic script skips anything already on disk, so this only pulls the stragglers.

```
cd /d C:\Users\User\Desktop\gpk-app-latest2
```

```
node scripts/build-atomic-mirror.mjs
```

When it finishes, copy the result into the staging folder:

```
cd /d C:\Users\User\Desktop
```

```
robocopy gpk-app-latest2\mirror-output\atomic gpk-zip-src\atomic /E
```

Re-count:

```
dir /s /b gpk-zip-src\*.jpg gpk-zip-src\*.gif | find /c /v ""
```

Target is **2577**. Send me the number. A few short is fine if the script reported those specific images as unavailable on every gateway.

## Step 2 — Build the split ZIPs and generate the manifest

Clear stale parts first. "Could Not Find" is fine:

```
del C:\Users\User\Desktop\gpk-zip-src\gpk-image-mirror-part-*.zip
```

Make sure the ZIP builder points at the staging folder. Open the config:

```
cd /d C:\Users\User\Desktop\gpk-app-latest2\scripts
notepad mirror-config.json
```

The `outDir` line must be:

```
  "outDir": "C:\\Users\\User\\Desktop\\gpk-zip-src",
```

Save and close, then build:

```
cd /d C:\Users\User\Desktop\gpk-app-latest2
node scripts/build-image-mirror.mjs --zip-only --split-zip
```

Watch the output. It must report a file count close to **2577** and produce multiple parts. If it reports ~1000 files or one tiny part, the `outDir` edit did not take — stop and tell me.

Write down the part names and byte sizes.

The build also creates `C:\Users\User\Desktop\gpk-zip-src\manifests\manifest.json`. Keep that path in mind — it is needed for verification and mirror deployment.

## Step 3 — Verify the staged mirror

`verify-mirror.mjs` expects the manifest at `mirror-output\manifest.json`. Because you are using the staging folder, copy the generated manifest into place first:

```
cd /d C:\Users\User\Desktop\gpk-app-latest2
mkdir mirror-output
xcopy /Y /I gpk-zip-src\manifests\manifest.json mirror-output\manifest.json
```

Then run the verifier:

```
node scripts/verify-mirror.mjs
```

It should report the same file count as the ZIP builder. If it lists missing files, those are the 35 stragglers — send me the list only if the count is more than ~40.

## Step 4 — Confirm the `_headers` file exists

Check `C:\Users\User\Desktop\gpkonwaxbackup-repo` for a file named exactly `_headers` (no `.txt`). If it is missing:

```
cd /d C:\Users\User\Desktop\gpkonwaxbackup-repo
notepad _headers
```

Paste:

```
/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Allow-Headers: *
```

Save. If Notepad appends `.txt`, rename it:

```
ren _headers.txt _headers
```

## Step 5 — Upload the new ZIPs to the GitHub Release

1. Go to `https://github.com/bewbzz/gpkonwaxbackup/releases`.
2. Open the latest release and click **Edit**.
3. Delete the old `gpk-image-mirror-part-*.zip` assets.
4. Drag the new parts from `C:\Users\User\Desktop\gpk-zip-src` into the assets box.
5. Wait for every upload to reach 100%, then click **Update release**.

Never `git push` the ZIPs.

## Step 6 — Push the refreshed manifest and images to the mirrors

The build rewrote `gpk-zip-src\manifests\manifest.json` with the new part list, sizes and hashes.

**Netlify (Backup A)** — deploy from the mirror folder:

```
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
netlify deploy --prod --site gpkonwaxbackup --dir . --build-ignore
```

If Netlify still fails, deploy from `gpk-zip-src` instead:

```
cd C:\Users\User\Desktop\gpk-zip-src
netlify deploy --prod --site gpkonwaxbackup --dir . --build-ignore
```

**Cloudflare (Backup B)** — Pages rejects files over 25 MB, so move the ZIPs out first:

```
cd /d C:\Users\User\Desktop\gpk-zip-src
mkdir zip-holding
move gpk-image-mirror-part-001.zip zip-holding
move gpk-image-mirror-part-002.zip zip-holding
move gpk-image-mirror-part-003.zip zip-holding
```

Run your usual Wrangler deploy from the remaining folder, then move them back:

```
move zip-holding\gpk-image-mirror-part-*.zip .
```

**GitHub Pages (Primary)** — copy the updated `manifests\manifest.json` and any newly downloaded image folders into your `gpkonwaxbackup` repo clone under `mirror\`, then commit and push.

## Step 7 — Verify

```
cd C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

You want `COMPLETE` on Primary, Backup A and Backup B.

Then open the app, go to **Offline backup**, and confirm the total download size matches the new combined part size. Download one part and load it to confirm it ingests cleanly.

Finally, send me the part count and byte sizes the build printed so I can update the hardcoded fallback values in `scripts/sync-pinned-manifest.mjs`.
