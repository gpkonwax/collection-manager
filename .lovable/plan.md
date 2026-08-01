# Refresh the downloadable offline ZIPs

Short answer: yes. The three ZIP parts on the GitHub Release were built before the Series 2 refresh (side "c", "raw", "returning" and the shared backs). Anyone who downloads them today gets a backup that is missing those images, and the offline app will fall back to IPFS for them. The individual images on Netlify, Cloudflare and GitHub Pages are already up to date — only the ZIPs are stale.

## What you will do

1. Rebuild the ZIP parts from your already-refreshed `mirror-output` folder.
2. Replace the three files on the GitHub Release.
3. Push the updated `manifests/manifest.json` (new sizes and hashes) to all three mirrors.
4. Confirm the app's Offline backup panel shows the new sizes.

## Part 1 — Rebuild the ZIPs (on your PC)

Open Command Prompt and go into your project folder (use the folder that has the fresh `mirror-output` inside `scripts`):

```
cd C:\Users\User\Desktop\gpk-app-latest2-new
```

Delete any old ZIP parts so they cannot be mixed up with the new ones. Run both lines:

```
del scripts\mirror-output\gpk-image-mirror-part-*.zip
del scripts\zip-holding\gpk-image-mirror-part-*.zip
```

If either line says **"Could Not Find ..."**, that is completely fine and expected — it just means there were no old ZIPs sitting in that folder (they were moved out during the Cloudflare upload, or they live in your other project folder). Nothing is broken. Carry on to the next step.

If you want to be sure no stray old parts are left anywhere on the desktop, run this and check the results:

```
dir /s /b C:\Users\User\Desktop\gpk-image-mirror-part-*.zip
```

Delete anything it lists before continuing.


Now rebuild. This only re-zips what is already on disk — it does not re-download any images:

```
node scripts/build-image-mirror.mjs --zip-only --split-zip
```

It will take several minutes and finish by printing the part names and sizes. You should end up with three files again (possibly slightly larger than before):

```
scripts\mirror-output\gpk-image-mirror-part-001.zip
scripts\mirror-output\gpk-image-mirror-part-002.zip
scripts\mirror-output\gpk-image-mirror-part-003.zip
```

Note: if the total has grown past the split point you may get a fourth part. That is fine — the app reads the part list from the manifest, so it adapts automatically.

## Part 2 — Replace the files on the GitHub Release

1. Go to `https://github.com/bewbzz/gpkonwaxbackup/releases`.
2. Open the latest release and click **Edit** (pencil icon).
3. Delete the old `gpk-image-mirror-part-001/002/003.zip` assets (small x next to each).
4. Drag the new ZIP parts from `scripts\mirror-output` into the assets box.
5. Wait for all uploads to reach 100%, then click **Update release**.

Do not `git push` the ZIPs — they are far too large for the repo.

## Part 3 — Update the manifest on all three mirrors

The rebuild rewrote `scripts\mirror-output\manifests\manifest.json` with the new part sizes and hashes. The app reads that file to know what to download, so every mirror needs the new copy.

- **Netlify (Backup A):** from `scripts\mirror-output`, run
  `netlify deploy --prod --site gpkonwaxbackup --dir . --build-ignore`
  (move the ZIP parts into `zip-holding` first if the upload complains about size, then move them back).
- **Cloudflare (Backup B):** same as before — move the ZIP parts out to `zip-holding`, run your Wrangler deploy, then move them back.
- **GitHub Pages (Primary):** copy the updated `mirror/manifests/manifest.json` into your `gpkonwaxbackup` repo checkout and push it.

## Part 4 — Verify

Run the audit:

```
node scripts/audit-mirrors.mjs
```

You want `COMPLETE` on all three, with the ZIP-part check passing on Primary.

Then open the app, go to **Offline backup**, and confirm the total download size matches the new combined size of your three parts. Download one part and load it in to confirm it ingests cleanly.

## Technical notes

- `--zip-only --split-zip` re-packs the existing `mirror-output` tree only; no network fetching of images occurs.
- `scripts/sync-pinned-manifest.mjs` holds hardcoded fallback part sizes; after the rebuild those constants will be out of date and should be refreshed from the new `manifest.json` so the app's built-in defaults match reality. I can do that in the app code once you tell me the new sizes the build prints.
- The atomic (Crash Gordon and other AA series) images live under `mirror-output/atomic/` and are included in the same ZIP tree, so this one rebuild covers both SA and AA backups.
