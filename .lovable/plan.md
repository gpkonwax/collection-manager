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

The dashboard upload stops at 1,000 files. Our verified folder has 2,576, so **do not split it into dashboard uploads**: each deployment replaces the previous one. Wrangler is the right tool — it accepts up to 20,000 files in one complete folder.

Cloudflare also hard-rejects any single file over **25 MiB**, and `pages deploy` does **not** honour `.assetsignore` — it scans the folder and aborts on the first oversized file, which is exactly the error you hit. So the 10 oversized files must physically leave the folder for the Cloudflare upload, then go straight back.

Do Netlify (Step 2) **first**, with the complete folder including all 10 files. Only then do this.

### 3a — Move the 10 oversized files aside

```bat
cd /d C:\Users\User\Desktop\mirror-upload
mkdir ..\oversize-hold
move atomic\QmNnPE4aQddNZ362KR1tVGSE7deZKm3LLw584e6xmJeBwX.gif ..\oversize-hold\
move atomic\QmeAzkDYBR3yFcDjY7rYhSLkTzrLD2ERtJXATUXc47kYgN.gif ..\oversize-hold\
move atomic\QmZj8pwn1Jefc2wYJXLfrtaRUD7qhxQmJKqUqmik1fqeqs.gif ..\oversize-hold\
move atomic\QmVFEJb46EhAucik6AZyXZS4JiuZhcFo9FZzccueCAAK38.gif ..\oversize-hold\
move atomic\QmRyoAs48RqwyD3WzYvgCuKi6zWZikqRSwehU4mWvWbvd1.webp ..\oversize-hold\
move atomic\QmRXEgM1GkXXCvPnJs9GsYNtqgv8ij8hH5GLksDuscmsNA.webp ..\oversize-hold\
move atomic\QmcDXep1Yn6gE6DYDywZsxbNZujgrgSUwWtBD7tNrYevWD.webp ..\oversize-hold\
move atomic\QmfDdhpwoxRq8HrtsQLGLUy9xVzxPoC3VoGkyGV4eM8sVC.webp ..\oversize-hold\
move atomic\QmcHh1ZasZYycVcKEGtkHfDyYK5LEeiMkzytpqC8RwEweB.gif ..\oversize-hold\
move atomic\QmQiggvyH63Szm45MRwB7LFWd7pSxcoCmKqasvghmjf3Pd.gif ..\oversize-hold\
```

`move`, not `del` — the files are parked, not deleted. `..\oversize-hold` sits **outside** `mirror-upload`, so nothing extra gets uploaded.

You can delete the `.assetsignore` file if you created it; it does nothing for `pages deploy`.

### 3b — Deploy

1. Sign in (opens a browser; approve the account that owns the existing Pages project):

   ```bat
   npx wrangler login
   ```

   Do not run `pages project create` — the project already exists.

2. Confirm Wrangler sees it and copy the exact name:

   ```bat
   npx wrangler pages project list
   ```

   It should list `gpkonwaxbackup`. If it is not listed, **stop** and paste the output here rather than creating a second project.

3. Upload the complete folder:

   ```bat
   npx wrangler pages deploy "C:\Users\User\Desktop\mirror-upload" --project-name gpkonwaxbackup
   ```

   Still a whole-site replacement, but safe: the folder holds the three CID folders, `atomic`, `manifest.json`, and `_headers`. Never point this at `atomic` alone.

   If it errors on another file over 25 MiB, `move` that one into `oversize-hold` too and re-run — do not delete it.

4. Wait for **Deployment complete**. Then Cloudflare → **Workers & Pages** → `gpkonwaxbackup` → **Deployments**, and confirm the new deployment is **Production**. If it landed as Preview, leave the old production deployment alone and paste the output here.

### 3c — Put the files back

```bat
move C:\Users\User\Desktop\oversize-hold\* C:\Users\User\Desktop\mirror-upload\atomic\
rmdir C:\Users\User\Desktop\oversize-hold
```

Then re-verify the folder is whole again:

```bat
node scripts/verify-mirror.mjs C:\Users\User\Desktop\mirror-upload
```

Run that from `C:\Users\User\Desktop\gpk-app-latest2`. Expect **0 missing, 0 corrupt** and the single `EXTRA: _headers` line, same as before.


Cloudflare also keeps history: Deployments → previous deployment → **Rollback**.

Cloudflare will always be missing those 10 files because of its per-file limit. That is expected and acceptable — it is Backup B, while the primary mirror, Netlify, and ZIPs carry them.

## Step 4 — Verify

From `C:\Users\User\Desktop\gpk-app-latest2`:

```bat
node scripts/audit-mirrors.mjs --only netlify
node scripts/audit-mirrors.mjs --only cloudflare
```

Expected: Netlify `missing: 0` → verdict COMPLETE. Cloudflare `missing: 10`, consisting only of the exact oversized files listed in `.assetsignore`.

Paste the summary here and I will confirm, and check the in-app **Backup mirrors** indicator turns green for both.

## Notes

- Mirror URLs in the app are already correct and need no change: Netlify `https://gpkonwaxbackup.netlify.app/`, Cloudflare `https://gpkonwaxbackup.pages.dev/`.
- The `_headers` file must ship with every upload — it carries the CORS header the app needs. Leaving it out is what previously made Netlify show as failed.
- No app code changes are part of this task.
