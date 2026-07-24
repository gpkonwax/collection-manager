
## Decision

Skip persistent offline storage. The ~4 GB backup is too big for reliable IndexedDB persistence across browsers, and it's only a last-resort fallback. Users can re-load the ZIPs on the rare occasion they need offline mode.

## Plan

### 1. Remove the "Remember" toggle
- `src/components/BackupPanel.tsx`:
  - Delete the Switch, its label, help text, `onPersistChange`, `persistState`, and the "Could not save backup on this device" toast path.
  - Under the ZIP loader, add a short line: "ZIPs stay loaded for this browser session. Reload the page to clear them."

### 2. Stop trying to persist on ingest
- `src/lib/localMirror.ts`:
  - In `ingestMirrorZip`, remove the `if (getPersistPreference()) persistLocalMirrorToIdb()` block.
  - Keep `persistLocalMirrorToIdb` / `restoreLocalMirrorFromIdb` / `getPersistPreference` exported for now (harmless, and tests reference them) but they're unused by the UI.

### 3. One-time cleanup of any existing IDB payload
- On app boot (`src/main.tsx`):
  - Replace the `restoreLocalMirrorFromIdb()` call with a fire-and-forget `idbDel('gpk-local-mirror-v1')` so users who previously saved a partial ~4 GB blob reclaim that disk space automatically.
  - Also clear `localStorage['gpk-local-mirror-persist']`.

### 4. Update the header pill and info copy
- `src/hooks/useImageSourceStatus.ts`: no logic change — the "Offline ZIP" dot will simply be grey until the user loads ZIPs this session, which is the correct signal.
- `src/pages/Index.tsx` "Built-in Resistance" section: reword the offline bullet to "Load the offline ZIP backup on demand for a fully local session — no reliance on IPFS or mirrors."

### 5. No changes to
- Mirror URLs, download launcher, ZIP part split, health probes, or any script under `scripts/`.

## Files touched
- `src/components/BackupPanel.tsx`
- `src/lib/localMirror.ts`
- `src/main.tsx`
- `src/pages/Index.tsx` (one bullet in the info dialog)
