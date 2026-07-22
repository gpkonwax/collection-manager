# Plan: Zero-effort manifest sync + ZIP button fix

You don't touch a file. Everything happens automatically when the app builds.

## What I'll change

### 1. Auto-fetch the real manifest at build time
Add a small prebuild script `scripts/sync-pinned-manifest.mjs` that runs **before every `vite build`**:

- Fetches `https://bewbzz.github.io/gpkonwaxbackup/mirror/manifest.json` (your live primary mirror).
- Writes it to `public/gpk-manifest.json`, overwriting the test stub.
- If the fetch fails (network hiccup, mirror briefly down), it keeps whatever `public/gpk-manifest.json` already exists and logs a warning — the build never breaks.

Wire it into `package.json`:
```json
"scripts": {
  "prebuild": "node scripts/sync-pinned-manifest.mjs",
  "build": "vite build"
}
```

Result: every time Lovable (or GitHub Pages, or you locally) builds the app, it pulls the freshest real manifest straight from your live mirror. No copy-paste, no re-upload, no maintenance.

### 2. Fix the primary "Download ZIP" button
In `src/lib/remoteMirror.ts`, change `getZipDownloadUrls()` so the **primary GitHub mirror** entry points to the GitHub Release download URL instead of `${PRIMARY_MIRROR}gpk-image-mirror.zip` (which 404s because `.gitignore` excluded the ZIP from the Pages repo).

Specifically:
- Primary mirror → `https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/gpk-image-mirror.zip` (direct download, no clicks).
- Future GitLab/Cloudflare mirrors → keep using `${baseUrl}gpk-image-mirror.zip` (those platforms accept large files, so the ZIP sits next to the images).
- The "GitHub Release" bonus link stays as-is.

### 3. Update the test
`src/lib/remoteMirror.test.ts` covers `getZipDownloadUrls`; adjust the expected URL for the primary entry.

## What you do
Nothing. After I apply the changes, Lovable rebuilds automatically. Open the Offline Backup dialog and you should see:
- Real ZIP size + SHA-256 from your actual mirror.
- A working "Download from GitHub Pages" button (goes to the Release asset).
- Primary mirror shows **Reachable** (green) because manifest verification now uses real hashes.

## Publishing
Not needed for this to work in preview. Publish whenever you want the fixes to reach visitors.

## Risks / notes
- The prebuild fetch adds ~1–2 seconds to each build. Acceptable.
- If your GitHub mirror is ever offline at build time, the previously synced `public/gpk-manifest.json` is reused — safe fallback.
- The manifest is a few MB. It's a normal static asset served by the app; no bundling penalty.

Say the word and I'll switch to build mode and apply it.