# Add the missing `atomic/` images to Netlify and Cloudflare

Both backup mirrors are missing the same **1545 files** — the whole `atomic/` folder. The 1030 files they already serve (the three SimpleAssets CID folders + `manifest.json`) are fine.

## The mistake to avoid

Netlify drag-and-drop and Cloudflare Pages direct upload are **whole-site replacements**, not merges. Dropping a folder containing only `atomic/` deletes everything else on the site. That is what erased the mirror last time.

**Rule: always upload one complete folder that contains everything the mirror should serve — never a partial folder.**

## Step 1 — Build one complete upload folder on your PC

Make a fresh folder, e.g. `C:\Users\User\Desktop\mirror-upload`, and put inside it:

```text
mirror-upload\
  manifest.json
  _headers
  .assetsignore              (Cloudflare only — see Step 3)
  QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p\
  QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25\
  QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ\
  atomic\
```

The easiest source is the repo you already pushed. In a Command Prompt:

```bat
cd /d C:\Users\User\Desktop
mkdir mirror-upload
xcopy /E /I /Y gpkonwaxbackup-repo\atomic mirror-upload\atomic
xcopy /E /I /Y gpkonwaxbackup-repo\QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p mirror-upload\QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p
xcopy /E /I /Y gpkonwaxbackup-repo\QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25 mirror-upload\QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25
xcopy /E /I /Y gpkonwaxbackup-repo\QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ mirror-upload\QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ
copy /Y gpkonwaxbackup-repo\manifest.json mirror-upload\
copy /Y gpkonwaxbackup-repo\_headers mirror-upload\
```

Do **not** copy any `.zip`, the `.git` folder, or a `mirror\` subfolder.

Sanity check before uploading anything:

```bat
node scripts/verify-mirror.mjs C:\Users\User\Desktop\mirror-upload
```

Run that from `C:\Users\User\Desktop\gpk-app-latest2`. It must report 0 missing. If it reports missing files, stop — uploading now would publish an incomplete mirror.

## Step 2 — Netlify

1. Go to <https://app.netlify.com> and open the `gpkonwaxbackup` site.
2. Click **Deploys** in the left menu.
3. Scroll to the bottom of the Deploys page to the **"Drag and drop your project output folder here"** box.
4. Drag the whole **`mirror-upload`** folder (the folder itself, not its contents) into that box.
5. Wait for the deploy to show **Published**. This is a few GB, so expect a long upload — leave the tab open.

Netlify has no per-file size cap that matters here, so the `atomic` `.gif` files (largest ~52 MB) are fine.

If anything goes wrong, Netlify keeps every past deploy: Deploys → pick the previous good one → **Publish deploy** restores it instantly. Nothing is ever permanently lost.

## Step 3 — Cloudflare Pages

Cloudflare rejects any single file over **25 MB**, so a handful of large GIFs must be excluded, otherwise the whole upload fails.

1. Create a file named `.assetsignore` inside `mirror-upload` containing the oversized files. Simplest safe rule — exclude nothing by default and let the upload tell you: first try the plain upload, and only if it fails on size add lines like:

   ```text
   atomic/QmeAzkDYBR3yFcDjY7rYhSLkTzrLD2ERtJXATUXc47kYgN.gif
   ```

2. Go to <https://dash.cloudflare.com> → **Workers & Pages** → your `gpkonwaxbackup` project.
3. Click **Create deployment** (or **Upload assets**) on the Deployments tab.
4. Drag the whole **`mirror-upload`** folder in — again, the complete folder, never just `atomic`.
5. Wait for **Success**.

Cloudflare also keeps history: Deployments → previous deployment → **Rollback**.

Cloudflare will always be slightly incomplete (the >25 MB files). That is expected and acceptable — it is Backup B, and the primary mirror plus the ZIPs carry those files.

## Step 4 — Verify

From `C:\Users\User\Desktop\gpk-app-latest2`:

```bat
node scripts/audit-mirrors.mjs --only netlify
node scripts/audit-mirrors.mjs --only cloudflare
```

Expected: Netlify `missing: 0` → verdict COMPLETE. Cloudflare missing only the oversized GIFs you excluded.

Paste the summary here and I will confirm, and check the in-app **Backup mirrors** indicator turns green for both.

## Notes

- Mirror URLs in the app are already correct and need no change: Netlify `https://gpkonwaxbackup.netlify.app/`, Cloudflare `https://gpkonwaxbackup.pages.dev/`.
- The `_headers` file must ship with every upload — it carries the CORS header the app needs. Leaving it out is what previously made Netlify show as failed.
- No app code changes are part of this task.
