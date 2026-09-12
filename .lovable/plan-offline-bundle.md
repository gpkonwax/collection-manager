# Offline app bundle — release checklist

A self-contained ZIP of the built manager so people can run it locally if every
hosted URL disappears.

## Automatic (preferred)

The workflow `.github/workflows/offline-bundle.yml` builds the ZIP and uploads
it to the latest release of `bewbzz/gpkonwaxbackup`, replacing any existing
copy.

It runs when:
- a release is published, or
- you trigger it manually: Actions → "Build & publish offline app bundle" → Run workflow.

One-time setup: add a repository secret named `BACKUP_REPO_TOKEN` — a GitHub
token with `contents: write` on `bewbzz/gpkonwaxbackup`. Without it the upload
step fails with a clear message (the ZIP is still attached to the workflow run
as an artifact).

The hosted app's "Run the manager itself offline" button points at
`.../releases/latest/download/gpk-collection-manager-offline.zip`, so no code
change is ever needed — it picks up the new asset automatically, and shows the
file's size and date once it exists.

## Manual fallback

```
npm install
npm run build:offline
```

That runs `vite build` with `VITE_OFFLINE_BUNDLE=1`, drops the offline README,
`open-me.html`, and a `version.txt` build stamp next to the built files, and
zips everything into:

```
dist-offline/gpk-collection-manager-offline.zip
```

Then go to https://github.com/bewbzz/gpkonwaxbackup/releases, edit the latest
release (the same one hosting `gpk-image-mirror.zip` parts), drag the ZIP into
the assets area, and save.

## Smoke-test the ZIP

1. Unzip somewhere.
2. Double-click `open-me.html`.
3. If image-related fetches misbehave under `file://`, run
   `python -m http.server 8080` in the unzipped folder and open
   `http://localhost:8080`.
4. Confirm the yellow offline banner shows the build date.
5. Click "Offline backup", load the `gpk-image-mirror.zip` parts, and confirm
   cards render. Wallet buttons should be visible but non-functional — that
   is expected.
