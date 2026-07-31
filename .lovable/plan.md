# Fix the Netlify mirror — the drag-and-drop wiped it

## What actually happened

Dragging the `manifests` folder onto Netlify did two unintended things:

1. **It flattened the path.** Netlify treats the dropped folder as the *site root*, so the file landed at
   `https://gpkonwaxbackup.netlify.app/gpk-topps-holders.json` (confirmed live, 1.3 MB, HTTP 200)
   instead of `/manifests/gpk-topps-holders.json`, which is where the app looks.
2. **It replaced the whole site.** A manual deploy is a full snapshot, not an add-on. Everything that was there before is gone:
   - `/manifests/pinned.json` → 404
   - `/_headers` (the CORS file) → 404
   - all mirrored images → 404

So Netlify is currently a one-file site. Backup A is offline as an image mirror until this is redeployed. My earlier advice to drag the `manifests` folder was wrong — sorry about that.

---

## The fix: redeploy the full mirror folder in one go

The rule is simple: **whatever you drop must be the complete site**, with `manifests` as a subfolder inside it.

### Step 1 — Assemble the complete folder locally

You need one folder that contains everything Netlify should serve:

```text
mirror-output\
  _headers                 <- the CORS file
  manifests\
    gpk-topps-holders.json <- the new snapshot
    pinned.json            <- existing manifest(s)
  ipfs\ (or however the images are laid out)
```

Check `C:\Users\User\Desktop\gpk-app-latest2\mirror-output` and confirm:
- `manifests\gpk-topps-holders.json` is there (it is — that's what the script wrote)
- the `_headers` file is at the top level
- the image folders are present

If `_headers` is missing, create a plain text file named exactly `_headers` (no extension) at the top level containing:

```text
/*
  Access-Control-Allow-Origin: *
```

If the images are *not* in this folder locally, tell me before deploying — we need to find the folder you originally uploaded, otherwise the redeploy will still be missing them.

### Step 2 — Deploy the whole folder

Drag the **`mirror-output` folder itself** (not its contents, not a subfolder) onto
`https://app.netlify.com/sites/gpkonwaxbackup/deploys`.

Netlify only re-uploads files whose contents changed, so this is fast even for a large folder.

### Step 3 — Verify

Open each of these in the browser:

- `https://gpkonwaxbackup.netlify.app/manifests/gpk-topps-holders.json` — should show JSON
- `https://gpkonwaxbackup.netlify.app/manifests/pinned.json` — should show JSON
- one image URL you know exists — should show the picture

If all three load, Backup A is healthy again.

### Step 4 — Confirm in the app

Hard-refresh the Collection Manager (Ctrl+F5), open **View Wallet → Show List**. You should get the ranked holders table with a snapshot date.

---

## Remaining mirrors (after Netlify is healthy)

**GitHub Pages (Primary)** — copy `gpk-topps-holders.json` into `mirror\manifests\` in the backup repo, then:

```bash
git add mirror/manifests/gpk-topps-holders.json
git commit -m "Add gpk.topps holders snapshot"
git push
```

**Cloudflare Pages (Backup B)** — place the file at `manifests\gpk-topps-holders.json` in your upload folder and redeploy with Wrangler. Wrangler uploads incrementally and does not wipe the site the way a manual drag does.

Both of these are additive — they won't destroy anything.

---

## Notes

- **No app code changes are needed.** The client already races all three mirrors and shows a calm "not published yet" note when the file is missing. This is entirely a hosting/upload fix.
- **Only one mirror needs the file** for the feature to work. The other two are redundancy.
- **Rule of thumb for Netlify manual deploys:** never drag a subfolder. Always drag the complete site root.
