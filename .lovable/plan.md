# Plan: Idiot-proof offline image backup with 3 mirrors

## What we're building

1. Move the **Offline backup** trigger from the footer into the sticky header so it is always visible and the footer is less crowded.
2. Redesign the backup dialog as a clear, ordered fallback checklist:
   - **Step 1 — Built-in primary mirror** (automatic, no action needed).
   - **Step 2 — Backup mirrors A & B** (preseeded URLs you will host on Cloudflare Pages / GitLab Pages; one-click activate if Step 1 fails).
   - **Step 3 — Load ZIP** (ultimate offline fallback; local file, persists optionally in IndexedDB).
3. Add **hash verification** for every file fetched from any mirror, using a pinned `manifest.json`, so any mirror can be used without trust language.
4. Remove the old free-text "community mirror URL" input and the confusing "trusted member" wording.

## Technical changes

### 1. Header trigger
- In `src/pages/Index.tsx`, remove `<BackupPanel />` from the footer.
- Add a header-left trigger using the existing `HardDrive` icon + "Image backup" label.
- Keep the existing `BackupPanel` component but update its default trigger styling so it works in both places if needed.

### 2. Mirror configuration
- Replace `TRUSTED_MIRRORS` with three explicit constants in `src/lib/ipfsGateways.ts`:
  - `PRIMARY_MIRROR`
  - `BACKUP_MIRROR_A`
  - `BACKUP_MIRROR_B`
- The list will initially contain placeholder URLs (e.g. your existing GitHub Pages URL as primary, plus two `https://` placeholders). You will update the placeholders after creating the Cloudflare Pages and GitLab Pages mirrors.
- Remove `getCommunityMirrorUrl` / `setCommunityMirrorUrl` and the community localStorage key.

### 3. Pinned manifest + hash verification
- Ship a pinned `manifest.json` with the app build. The existing `scripts/build-image-mirror.mjs` already emits this file; we will copy it into `public/gpk-manifest.json` at build time and import/fetch it in the app.
- Create `src/lib/remoteMirror.ts`:
  - Load the pinned manifest on app boot.
  - Provide `fetchVerifiedMirrorFile(hash: string, baseUrl: string): Promise<Blob | null>`:
    - Fetch `${baseUrl}${hash}` with a timeout.
    - Compute SHA-256 via `crypto.subtle.digest`.
    - Compare against the manifest entry for that path.
    - Return the `Blob` only if the hash matches; otherwise log a clear warning and return `null`.
  - Cache successful verified blobs per hash so repeated renders are instant.
  - Track which mirror is currently active (primary / A / B / none) and expose `setActiveMirror`, `getActiveMirror`, and a subscription for reactive UI.

### 4. Integrate verified mirrors into image loading
- In `src/hooks/useIpfsMedia.ts`:
  - Subscribe to the active mirror.
  - If an active mirror is set and the hash exists in the pinned manifest, call `fetchVerifiedMirrorFile` and use the resulting blob URL.
  - If verification fails or the file is missing, fall back to the normal public-gateway rotation.
  - If the user clicks "Reset to primary", clear the active mirror and let the automatic fallback list (public gateways → primary mirror) resume.

### 5. Backup panel UI rewrite (`src/components/BackupPanel.tsx`)
Order the dialog content top-to-bottom as the user should try it:

```text
Step 1 — Built-in primary mirror
  Status: active / not needed
  "Used automatically when public IPFS gateways fail. No action needed."
  Show the primary URL.

Step 2 — Backup mirrors
  "If the primary mirror is down, try one of these:"
  [Try Backup Mirror A]  [Try Backup Mirror B]  [Reset to primary]
  Each button shows the mirror URL and a status badge:
    - "Ready" (URL configured)
    - "Checking…" while the first file is fetched/verified
    - "Working" once a verified file succeeds
    - "Failed" if verification fails or the URL is still a placeholder

Step 3 — Load backup ZIP
  [Load backup ZIP]   [Download latest ZIP]
  Show currently loaded ZIP file count / bytes and a Clear button.
  Keep the "Remember on this device" IndexedDB toggle.
```

- Add a short explainer at the top of the dialog:
  > "If card images stop loading, work through these steps in order. The app checks every mirror file against a published list of hashes, so you don't have to trust the host — only the math."

### 6. Build / release workflow
- Update `scripts/build-image-mirror.mjs` to also copy `outDir/manifest.json` to `public/gpk-manifest.json` after each build, so the pinned manifest stays in sync with the ZIP.
- Add a note in the plan for you to run the mirror builder once after the plan is implemented, then deploy the same `mirror/` folder to:
  1. Primary: existing GitHub Pages (`gpkonwaxbackup.github.io/gpk-backup/mirror/`)
  2. Backup A: Cloudflare Pages
  3. Backup B: GitLab Pages

## Files to touch

- `src/pages/Index.tsx` — move trigger, add header button.
- `src/components/BackupPanel.tsx` — rewrite dialog content and order.
- `src/lib/ipfsGateways.ts` — replace mirror constants, remove community URL helpers.
- `src/lib/remoteMirror.ts` — new module for verified mirror fetches.
- `src/hooks/useIpfsMedia.ts` — wire verified mirror fetch into image source selection.
- `scripts/build-image-mirror.mjs` — copy manifest to `public/gpk-manifest.json`.
- `src/lib/localMirror.test.ts` — update if community-mirror tests exist; add basic remoteMirror tests if time permits.

## Out of scope / not changing

- Public IPFS gateway race logic stays the same.
- Local ZIP ingestion logic stays the same; only the surrounding UI order changes.
- No backend or Lovable Cloud changes — this remains a client-side feature.

## Acceptance criteria

- Backup trigger is in the header, not the footer.
- Dialog shows three numbered steps in the exact fallback order above.
- Clicking "Try Backup Mirror A/B" fetches and verifies a sample file, then switches image loading to that mirror.
- A failed verification shows a clear error and does not use the bad file.
- "Load ZIP" still ingests the ZIP and makes images available offline.
- No "trusted member" or free-text community URL remains in the UI.
- Build script keeps `public/gpk-manifest.json` up to date.

---

**Note:** The actual URLs for Backup A and Backup B are placeholders until you create the Cloudflare Pages / GitLab Pages mirrors. After you provide the real URLs, I will update the constants in one small follow-up change.