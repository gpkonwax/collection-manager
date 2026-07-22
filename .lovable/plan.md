## Goal

Give users a "Collection Manager offline bundle" ZIP they can download, unzip, and open locally. Combined with the existing image backup ZIP, the whole viewer keeps working even if GitHub, Lovable, and every mirror disappear.

## What actually works offline vs what doesn't

Be upfront in the UI so expectations match reality:

- **Works fully offline** once the image ZIP is loaded: browsing the collection, filtering, puzzle builder, binder view, card detail, animations, everything image-driven. The collection is frozen, so a static snapshot of card metadata is enough.
- **Needs internet** (and will just fail gracefully offline): live WAX wallet connect / login, live NFT ownership queries, transfers/burns, banner ads, price alerts, donation flow. These all hit WAX RPC / AtomicAssets / external APIs — no way around that without a blockchain node.

So the offline bundle is a **read-only viewer** of the frozen collection plus whatever the user has in their loaded image ZIP. That's genuinely useful as a "the internet ate GitHub" fallback.

## Build output — one bundle, two ways to open it

Produce a single `gpk-collection-manager-offline.zip` containing:

```
index.html
assets/…            (hashed JS/CSS/fonts from Vite)
gpk-manifest.json   (pinned hash list — same file we already sync)
open-me.html        (tiny landing that explains the two ways to open)
README.txt          (plain-text version of the same instructions)
```

Two supported open methods, documented in `open-me.html`:

1. **Double-click `index.html`** — works in Chrome/Edge/Firefox for the viewer parts. Some browsers restrict `file://` for certain fetches, so we ship a fallback:
2. **Run the included one-liner static server** — `README.txt` gives the exact command for Windows / Mac / Linux using either `python -m http.server 8080` or `npx serve .`. This is the reliable path.

We won't ship a `.exe` — that pulls us into code-signing hell. A folder + "run this one command" is enough.

## Code changes required to make the built app file://-friendly

1. **Vite `base` config** — currently hardcoded to `/collection-manager/` on GitHub Pages. Add a third mode for the offline bundle build (env flag like `VITE_OFFLINE_BUNDLE=1` → `base: './'`) so every asset URL in the built `index.html` is relative.
2. **Manifest fetch** — already fixed to use `import.meta.env.BASE_URL`, so `./gpk-manifest.json` will resolve correctly.
3. **Router** — if `BrowserRouter` is in use, deep-linking under `file://` will fail on refresh. Switch to `HashRouter` **only when `VITE_OFFLINE_BUNDLE=1`** so the hosted version keeps its clean URLs.
4. **Feature detection for offline mode** — a small `isOfflineBundle()` helper (checks `import.meta.env.VITE_OFFLINE_BUNDLE` at build time) used to:
   - Hide / disable "Connect Wallet", "Recover Stuck Cards", banner ads, price alerts, donate.
   - Show a persistent banner: *"Offline viewer mode — wallet features disabled. Load the image backup ZIP to view all cards."*
   - Skip any network calls that would just spinner forever.
5. **Auto-suggest loading the image ZIP** — on first launch of the offline bundle, if no local ZIP is loaded, pop the Offline Backup panel straight to Step 3.

## Build & release plumbing

1. **New npm script** `build:offline` in `package.json`:
   ```
   VITE_OFFLINE_BUNDLE=1 vite build --outDir dist-offline
   ```
   Followed by a small Node step that:
   - Copies `public/gpk-manifest.json` into `dist-offline/` (already handled by Vite's public dir, verify).
   - Writes `open-me.html` and `README.txt` from templates.
   - Zips `dist-offline/` into `dist-offline/gpk-collection-manager-offline.zip`.
2. **New script** `scripts/build-offline-bundle.mjs` to do the copy + template + zip step. Uses `fflate` (already in deps) so no new dependency.
3. **Manual release step** (documented in `.lovable/plan-offline-bundle.md`): run `npm run build:offline` locally, upload `gpk-collection-manager-offline.zip` as a second asset on the same GitHub Release that already hosts `gpk-image-mirror.zip`.

## UI on the hosted app — surface the download

Add a small section to `BackupPanel.tsx`, above the image-ZIP recommendation:

- Card titled **"Run the manager itself offline"**.
- One button: **"Download the offline app (≈X MB)"** → GitHub Release asset URL.
- Two-line explanation: "Unzip, open `open-me.html`, and follow the instructions. Combined with the image backup ZIP below, the viewer keeps working even if every mirror goes down."
- Keep it visually secondary to the image ZIP (that's still the more important download for most users).

Same pattern as the current primary-mirror ZIP: add `OFFLINE_APP_RELEASE_ASSET_URL` constant next to the existing `ZIP_GITHUB_RELEASE_ASSET_URL` in `src/lib/remoteMirror.ts`.

## Testability

- Unit test the `isOfflineBundle()` helper toggling by env.
- Vitest for `build-offline-bundle.mjs`: given a fake dist folder, produces a zip containing `index.html`, `README.txt`, `open-me.html`, `gpk-manifest.json`.
- Manual smoke test after first real build: unzip, run `python -m http.server`, load an image ZIP, confirm cards render and wallet features are hidden.

## Files touched

- `vite.config.ts` — offline-bundle base + env plumbing.
- `src/App.tsx` (or wherever the router lives) — conditional `HashRouter`.
- `src/lib/offlineBundle.ts` (new) — `isOfflineBundle()` helper + constants.
- `src/lib/remoteMirror.ts` — add offline-app release URL constant.
- `src/components/BackupPanel.tsx` — new "Run the manager itself offline" section, auto-open Step 3 when in offline mode.
- Various feature entry points (`ViewWalletControl`, `BannerAd`, `AlertsManagerPopover`, donate, recover-stuck) — no-op when `isOfflineBundle()`.
- `package.json` — `build:offline` script.
- `scripts/build-offline-bundle.mjs` (new) — assemble + zip.
- `public/offline/open-me.html` and `public/offline/README.txt` (new) — templates copied at build time.
- `.lovable/plan-offline-bundle.md` (new) — human-run release checklist, same style as the primary-mirror plan.

## Out of scope

- Any attempt to make wallet / RPC work offline (would need a bundled blockchain node — not realistic).
- Electron / Tauri / native installer.
- Auto-download of the image ZIP inside the offline bundle (user still fetches that separately from Releases).
- Backup A / Backup B deployment (separate track).