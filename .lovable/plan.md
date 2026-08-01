# Fix: Netlify mirror reports "failed"

## Cause (confirmed)

The files are on Netlify and load fine in a browser tab, but the app reads them with `fetch` and hash-verifies the bytes. That requires a CORS header, and Netlify is currently sending none.

Checked live:

- `https://gpkonwaxbackup.netlify.app/manifests/manifest.json` — 200, **no `access-control-allow-origin` header**
- `https://gpkonwaxbackup.pages.dev/...` — sends `access-control-allow-origin: *` (Cloudflare is fine)

Opening the URL directly in a tab works because tabs don't enforce CORS; the app does. So the health check fails even though the data is there. Your `_headers` file did not take effect on the last deploy.

## What you need to do (local, ~2 minutes)

1. Open `C:\Users\User\Desktop\gpk-app-latest2\mirror-output\_headers` in Notepad.
   Make sure the file is named exactly `_headers` (no `.txt` — turn on "File name extensions" in Explorer's View tab to check), sits at the **top level** of `mirror-output`, and contains exactly:

```text
/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Allow-Headers: *
```

Indentation matters: the header lines must start with two spaces, and `/*` must be flush left.

2. Redeploy the whole folder (not just `manifests`):

```powershell
cd C:\Users\User\Desktop\gpk-app-latest2\mirror-output
netlify deploy --prod --dir .
```

If it asks about a build command, pick nothing / cancel out of it — this folder is static files only. If it prompts to link, link to the existing `gpkonwaxbackup` project.

3. Verify the header is now live:

```powershell
curl.exe -I https://gpkonwaxbackup.netlify.app/manifests/manifest.json
```

You should see a line `access-control-allow-origin: *` in the output.

4. Hard-refresh the Collection Manager (Ctrl+F5) and open Offline backup. Backup A should flip from failed to OK.

## Note on the primary (GitHub Pages) mirror

`https://gpkonwaxbackup.github.io/gpk-backup/mirror/manifests/manifest.json` currently returns 404, so the primary mirror has no manifest published yet either. That's a separate upload job — worth doing after Netlify is green.

## Code changes

None. This is purely a hosting-header/deploy issue on your side; the app logic is already correct.
