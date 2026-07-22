# Offline app bundle — release checklist

Once per release, produce a self-contained ZIP of the built manager so people
can run it locally if every hosted URL disappears.

## Build it locally

```
npm install
npm run build:offline
```

That runs `vite build` with `VITE_OFFLINE_BUNDLE=1`, drops the offline README
and `open-me.html` next to the built files, and zips everything into:

```
dist-offline/gpk-collection-manager-offline.zip
```

## Publish it

1. Go to https://github.com/bewbzz/gpkonwaxbackup/releases
2. Edit the latest release (the same one hosting `gpk-image-mirror.zip`).
3. Drag `dist-offline/gpk-collection-manager-offline.zip` into the assets area.
4. Save.

The hosted app's "Run the manager itself offline" button in the Offline backup
panel points at `.../releases/latest/download/gpk-collection-manager-offline.zip`,
so no code change is needed — it just picks up the new asset.

## Smoke-test the ZIP

1. Unzip somewhere.
2. Double-click `open-me.html`.
3. If images-related fetches misbehave under `file://`, run
   `python -m http.server 8080` in the unzipped folder and open
   `http://localhost:8080`.
4. Click "Offline backup", load the `gpk-image-mirror.zip`, and confirm
   cards render. Wallet buttons should be visible but non-functional — that
   is expected.
