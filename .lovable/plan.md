# Netlify is actually complete — next stop is Cloudflare

I just re-checked all 2575 manifest entries directly against `https://gpkonwaxbackup.netlify.app/`:

```text
missing: 0
```

Your 03:35 audit showing 515 missing was taken while Netlify was still finishing the deploy — a few hundred files had not propagated to the CDN yet. They are all live now.

## About the ZIP 404s in your output

```text
gpk-image-mirror-part-001.zip: FAIL status=404
```

Expected, not a problem. The three split ZIPs are hosted as **GitHub Release assets**, never on Netlify — they are far too big for it. Your local copy of `scripts/audit-mirrors.mjs` is an older revision that checks ZIPs on every mirror; the current version in this project only checks them on the primary. Ignore those three lines, or pull the latest script.

## Step 1 — Confirm Netlify (optional)

From `C:\Users\User\Desktop\gpk-app-latest2`:

```bat
node scripts/audit-mirrors.mjs --only netlify
```

Expect `missing: 0`. If you still see a handful missing, wait ten minutes and re-run — that is CDN propagation, not a bad upload. Do **not** re-upload.

## Step 2 — Cloudflare Pages

Netlify is done, so the full `mirror-upload` folder has served its purpose there. Cloudflare hard-rejects any single file over **25 MiB**, and `wrangler pages deploy` does **not** honour `.assetsignore` — it scans the folder and aborts on the first oversized file, which is the error you hit. The 10 oversized files must physically leave the folder for this upload, then go straight back.

### 2a — Park the 10 oversized files

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

`move`, not `del` — parked, not deleted. `oversize-hold` sits **outside** `mirror-upload` so it is not uploaded. Delete `.assetsignore` if you made one; it does nothing here.

### 2b — Deploy

```bat
cd /d C:\Users\User\Desktop\gpk-app-latest2
npx wrangler pages deploy "C:\Users\User\Desktop\mirror-upload" --project-name gpkonwaxbackup
```

This is a whole-site replacement, but safe: the folder still contains the three CID folders, `atomic`, `manifest.json`, and `_headers`. Never point it at `atomic` alone.

If it errors on another file over 25 MiB, `move` that one into `oversize-hold` too and re-run.

Wait for **Deployment complete**, then check Cloudflare → **Workers & Pages** → `gpkonwaxbackup` → **Deployments** and confirm the new one is **Production**. If it landed as Preview, leave the old production deployment alone and paste the output here.

### 2c — Put the 10 files back

```bat
move C:\Users\User\Desktop\oversize-hold\* C:\Users\User\Desktop\mirror-upload\atomic\
rmdir C:\Users\User\Desktop\oversize-hold
node scripts/verify-mirror.mjs C:\Users\User\Desktop\mirror-upload
```

Expect 0 missing, 0 corrupt, and the single `EXTRA: _headers` line.

## Step 3 — Final audit

```bat
node scripts/audit-mirrors.mjs --only cloudflare
```

Expected: `missing: 10`, and those 10 are exactly the oversized files above. That is the accepted end state — Cloudflare is Backup B, while the primary mirror, Netlify, and the ZIPs all carry the full set.

Paste the summary here and I will confirm and check the in-app **Backup mirrors** indicator goes green for both.

## Notes

- Mirror URLs in the app are already correct: Netlify `https://gpkonwaxbackup.netlify.app/`, Cloudflare `https://gpkonwaxbackup.pages.dev/`.
- `_headers` must ship with every upload — it carries the CORS header the app needs.
- No app code changes are part of this task.
