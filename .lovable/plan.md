# Fix three Pack History problems

## 1. History disappears and has to be re-loaded

Today the whole history (and the "last downloaded" marker) lives in `localStorage`, and every write is wrapped in a `try {} catch {}` that swallows failures silently. If the browser refuses or evicts that storage — quota pressure from the other caches on the same origin, or the browser clearing site data — the history vanishes with no signal to you, which matches what you saw overnight.

Fix:
- Move the pack history store to IndexedDB (already used elsewhere in the app via `idb-keyval`), which has far more room and is not evicted the same way. Keep an in-memory copy so reads stay instant.
- Migrate anything currently in `localStorage` into IndexedDB on first load, then clean up the old key.
- Stop failing silently: if a save genuinely fails, show a visible warning telling you to download the JSON now.

Note: the exact reason your storage was wiped is not confirmed — it may also be a browser-level site-data clear, which no code can prevent. The IndexedDB move plus the loud save-failure warning removes the silent-failure case and makes the durable path much stronger.

## 2. SimpleAssets pack art broken in Pack History

Confirmed cause: SimpleAssets pack art is a bundled app image (`src/assets/gpk_pack_*.jpg`), so its URL contains a build hash. That hashed URL gets written into the history entry and into the exported JSON. After any redeploy the hash changes and the stored URL 404s — which is why only the SimpleAssets tiles are broken while the AtomicAssets (IPFS) art still loads. The main pages are fine because they resolve the image from the pack symbol at render time.

Fix:
- At render time in Pack History, resolve SimpleAssets pack art from the stored pack symbol (`packId`) through the same `gpkPackMeta` lookup the homepage uses, and only fall back to the stored URL when no symbol matches.
- Extend the symbol lookup so the extra SimpleAssets packs (Crash Gordon, Bernventures, Gamestonk, Mittens, Food Fight/WinterCon, Tiger King) resolve to their existing artwork the same way the homepage grid does.
- Stop writing build-hashed local URLs into new history entries and exports; store the symbol instead so old files self-heal on load.

## 3. "16 openings since your last download" after re-loading the JSON

Confirmed cause: the warning compares each opening's timestamp against a `lastDownloadedAt` value kept in a *separate* localStorage key. When storage was wiped, that key went with it, so after re-importing the file the code sees "never downloaded" and reports every entry as unsaved.

Fix:
- Replace the timestamp comparison with an exact record of which openings are already in a downloaded file: keep a per-account set of saved transaction ids, written on download.
- On import, mark every opening in the loaded file as saved (they are, by definition, already in a file). Re-loading your JSON will then show no warning.
- The warning then only appears for openings recorded after the last download — which is what it was meant to say.

## Technical notes

- `src/lib/packOpenHistory.ts`: swap `localStorage` for `idb-keyval` with a synchronous in-memory mirror plus a one-time migration of `gpk:packHistory:v1`; replace `gpk:packHistoryDownloaded:v1` (timestamp map) with a saved-txId set per account; `countUnsavedOpenings` becomes a set difference; `mergePackHistory` marks imported txIds as saved; expose a save-failure flag.
- `src/lib/gpkPackMeta.ts`: add symbol → artwork entries for the remaining SimpleAssets packs.
- `src/lib/packOpenHistoryChain.ts` and the live recorder in `src/pages/Index.tsx`: persist `packId` (symbol) and skip persisting bundled asset URLs for SimpleAssets.
- `src/components/simpleassets/PackHistoryDialog.tsx`: resolve pack art via symbol first for both the gallery tiles and the drill-down rows; render the save-failure warning; awaits for the now-async store load.
