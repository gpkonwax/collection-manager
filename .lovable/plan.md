# Re-snapshot the image mirror and redeploy

Goal: download the newly-enumerated Series 2 images (side "c", `raw`, `returning`, `collector`, `originalart`, and the corrected exotic variant names) into your local `mirror-output` folder, then push that folder to all three mirror hosts so the app stops showing blank tiles for those cards.

Nothing in the app code changes here. This is purely a data refresh you run on your own PC.

---

## Before you start

- You need the same PC/folder you used last time: `C:\Users\User\Desktop\gpk-app-latest2`
- Keep the existing `mirror-output` folder. Do NOT delete it. The build script is resumable — it skips every file already on disk with a valid hash, so this run only downloads the new ones.
- Have Node.js installed (you already do — you ran the holders script with it).
- Expect this run to take a while (roughly 30–90 minutes depending on IPFS gateway speed). You can stop it with Ctrl+C and re-run at any time; it picks up where it left off.

---

## Step 1 — Get the updated scripts onto your PC

The two files that changed are `scripts/mirror-config.json` and `scripts/build-image-mirror.mjs`. Pull them down the same way you normally sync the project (GitHub push from Lovable, then `git pull` in your local folder). If you copy files manually, make sure BOTH of those two files are the new versions — the config alone will not work, because the new variant options need the new script.

Quick check that you have the new config: open `scripts/mirror-config.json` in Notepad and confirm you can see the word `returning` and the word `sharedBack`. If they are not there, you have the old file.

---

## Step 2 — Run the snapshot build

Open Command Prompt and run:

```
cd C:\Users\User\Desktop\gpk-app-latest2
node scripts/build-image-mirror.mjs
```

What you will see: a running log of files being fetched, and a count of skipped (already-present) versus downloaded files. The already-mirrored ~1500 files should skip almost instantly; the new ones will download one after another.

If some files fail with timeouts (normal for IPFS), re-run once more with the retry flag when it finishes:

```
node scripts/build-image-mirror.mjs --retry-errors
```

Repeat that until the "errors" count at the end is zero, or until repeated runs stop improving it.

---

## Step 3 — Verify the local folder is intact

```
node scripts/verify-mirror.mjs
```

You want to see `OK` at the end. If it lists MISSING files, run the `--retry-errors` command from Step 2 again. If it lists CORRUPT files, delete just those files and re-run the build.

---

## Step 4 — Redeploy Backup A (Netlify)

This is the most important mirror — the app races it first.

1. Go to <https://app.netlify.com> and open the `gpkonwaxbackup` site.
2. Click the **Deploys** tab.
3. Drag the **whole `mirror-output` folder** (not any folder inside it) onto the drag-and-drop area.
4. Wait for "Published".

Important: always drag the entire `mirror-output` folder. Dragging a subfolder replaces the whole site with just that subfolder, which is what wiped your images last time.

Check afterwards that these three URLs return an image, not a 404 page:

- `https://gpkonwaxbackup.netlify.app/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/base/58c.jpg`
- `https://gpkonwaxbackup.netlify.app/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/raw/65.jpg`
- `https://gpkonwaxbackup.netlify.app/QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ/returning/6b.gif`

Also confirm `_headers` (no `.txt`) is still at the root of `mirror-output` before dragging — without it, CORS breaks and the app marks Netlify unreachable.

---

## Step 5 — Redeploy Backup B (Cloudflare Pages)

From the project folder:

```
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
npx wrangler pages deploy . --project-name gpkonwaxbackup
```

Cloudflare rejects individual files over 25MB and the ZIP parts, so keep the `.assetsignore` file in `mirror-output` that excludes `*.zip` and the oversized images. Cloudflare being partially incomplete is expected and fine — it is the third choice in the race.

---

## Step 6 — Refresh the Primary mirror (GitHub Pages)

Push the new files into the `mirror/` folder of the `gpkonwaxbackup` repo in batches (GitHub rejects very large single pushes). The new Series 2 files are a small addition, so one batch should be enough:

```
cd <your local clone of gpkonwaxbackup>
git add mirror
git commit -m "Add Series 2 side-c, raw, returning variants"
git push
```

---

## Step 7 — Confirm everything landed

```
cd C:\Users\User\Desktop\gpk-app-latest2
node scripts/audit-mirrors.mjs
```

This HEAD-checks every manifest entry against all three hosts and prints which files are missing where. Netlify and GitHub should be complete; Cloudflare will legitimately be missing the oversized files.

Then open the app, click the **IPFS Live** indicator in the header, and press **Check again**. All three mirrors should read reachable. Open a Series 2 card that uses a `raw` or `returning` variant and confirm the artwork now loads instantly instead of falling through to IPFS.

---

## Technical notes

- The new `scripts/mirror-config.json` enumerates, for Series 2 (`QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ`): `base` with sides a/b/c, `raw` as a sideless `.jpg` with a shared `raw/back.jpg`, `returning` as ids 1–13 `.gif` with a shared back, plus `collector` and `originalart`. Exotic uses the on-chain names `tigerscratch` and `tigerborder`.
- `build-image-mirror.mjs` now honours per-variant `sides`, `cardIdRange`, `sharedBack`, and `backPattern` overrides, which is what makes those non-standard paths enumerable.
- `manifest.json` is rewritten each run with a sha256 per file, so the audit and verify scripts stay accurate after this refresh.
- No app code needs redeploying for this — the client resolves paths at runtime from the same mirror base URLs already wired in `src/lib/ipfsGateways.ts`.
