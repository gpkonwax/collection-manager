# Records ZIP: download, load, and refresh every month

One small ZIP holds the collection records: the top holders list and the mint-number backup (all 1,000 mint files and their index). People can download it from the Offline Backup section and load it back in later. The monthly workflow rebuilds it.

## What users will see (Offline Backup section)

A new card called "Collection records (holders + mint numbers)" sits next to the image ZIP steps:

- **Download records ZIP**: shows the size and the date of the snapshot. It links to the latest copy on the backup GitHub release.
- **Load records ZIP**: lets you pick the file from your device. Once it loads, mint ribbons and the View Wallet "Top Holders" list read from the ZIP first and only use the internet as a fallback. The card shows "Loaded — snapshot from <date>, N cards, N holders" and has a clear button.
- The loaded ZIP lasts for the browser session only, like the image ZIPs. It is not stored permanently.
- If the ZIP is missing or broken (wrong files, bad checksum), you get a plain message and nothing gets replaced.
- The offline app download includes this card too, so you can view records offline.

## Monthly refresh

The existing "Refresh GPK holders manifest" workflow (runs on the 10th) gets one more step after the mint backup is rebuilt:

1. Package `gpk-records.zip` containing `gpk-topps-holders.json`, `mints/index.json`, `mints/000-999.json` and a small `records-info.json` (snapshot date, card count, holder count).
2. Upload it to the latest release of `bewbzz/gpkonwaxbackup`, replacing the previous copy. This uses the `BACKUP_REPO_TOKEN` secret, which the offline-app workflow already uses.
3. Also copy it into the gpk-data mirror so it is served from there when Cloudflare is set up.

If `BACKUP_REPO_TOKEN` is missing, the workflow shows a warning and keeps going (same as the Cloudflare step). The ZIP is also saved to the workflow run so it is never lost.

**Your one action:** add the `BACKUP_REPO_TOKEN` secret to the **collection-manager** repo, if it isn't there already. I'll include exact steps after building.

## Technical details

- `scripts/build-records-zip.mjs` (new): zips `mirror-output/manifests/gpk-topps-holders.json` and `manifests/mints/*` into `dist-records/gpk-records.zip` with `records-info.json`. It uses the zip tooling already in the repo scripts.
- `.github/workflows/holders-manifest.yml`: adds a build step, a `gh release upload --clobber` step (guarded on the token), and an `actions/upload-artifact` step. `build-data-mirror.mjs` copies the ZIP into `gpk-data/downloads/`.
- `src/lib/recordsZip.ts` (new): reads the ZIP in memory with the existing ZIP reader, checks each shard against the `sha256` values in `index.json`, and keeps an in-memory store with subscribe/clear.
- `src/lib/saMintResolver.ts`: the shard lookup checks the loaded records store before the mirror fetch. Live AtomicHub still overrides it under the existing rules. Source label: "records ZIP (date)".
- `src/lib/gpkHolders.ts`: `fetchTopGpkHolders` returns the loaded holders list first if one exists.
- `src/components/BackupPanel.tsx`: new `RecordsZipCard` (HEAD check for size/date like `OfflineAppCard`, a download link, a hidden file input, status, and a clear button).
- Tests: ZIP parse and checksum rejection, resolver priority (records before mirror, live still wins), and holders fallback.
- Update `AGENTS.md`, `roadmap.md`, and the data-mirror memory.
