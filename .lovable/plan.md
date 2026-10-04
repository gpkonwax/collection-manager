# Pack-opening provenance for every card (one-time backfill + twice-daily updates)

## Goal
Every card's details show who opened the pack it came from, when it was minted, and which pack type, for SimpleAssets and AtomicAssets packs. A one-time scan collects everything back to May 2020. After that, the twice-daily mint workflow adds new openings.

## What users will see
- In card details, under **Mint information**: "Opened by: account", "Minted on: date" and "Pack: name".
- Bridged cards still show Bridge Information beside it. Where possible, "Bridged by" comes from the saved records, with the live lookup used only as a fallback.
- When a card has no record, those lines are hidden. The app never guesses.
- Works offline once the records ZIP is loaded.

## Steps
1. **Check sources first (step 1 of the build):** confirm against live data that the archival history node returns `gpk.topps:getcards` from 2020, and confirm how each AtomicAssets pack type delivers its cards. Pack types that can't be confirmed are left out and listed in the report. Nothing gets guessed.
2. **Backfill script (manual, resumable):**
   - SimpleAssets (Series 1, Series 2, Exotic, Tiger King): page through pack claims on the archival node, read each transaction's createlog actions, and record the card ID, opener, time and pack.
   - AtomicAssets: mint logs for packs that mint straight to the opener, plus pool transfers (Food Fight memo) for packs delivered by transfer.
   - Saves its progress after every batch so a failed run continues where it stopped. Polite request rate with backoff, and it rotates to other nodes when one fails.
3. **New manual workflow "Backfill pack provenance":** runs the script in chunks that fit GitHub's time limit, commits progress each time, and can be re-run until it's done.
4. **Twice-daily mint workflow:** the createlog reader it already uses also saves the opener and time for new SimpleAssets cards. A small AtomicAssets check adds new atomic pack openings after a saved bookmark. Outages warn and keep the old bookmark.
5. **Records ZIP + app:** the provenance shards go into `gpk-records.zip` and the data mirror. The detail dialog reads the loaded ZIP first, then the mirror.
6. **Tests:** script parsers (createlog, transfer memo, logmint), resume/bookmark behaviour, ZIP checksum validation for the new shards, and detail-dialog rendering with and without a record.

## Technical details
- Storage: `manifests/provenance/000-999.json`, sharded with the same asset-id hashing as the mint shards, plus an `index.json` with sha256 values and scan cursors. Each entry is `{o: opener, t: epochMs, p: packCode, b?: bridger}`, kept compact.
- Script: `scripts/backfill-pack-provenance.mjs` with pure parsers in `scripts/lib/provenance.mjs`. Hyperion: `wax.eosdac.io` is tried first, with the other nodes as fallback. The AtomicAssets API uses the existing list of nodes.
- Concurrency group `gpk-manifests` is shared so the backfill and mint runs never clash on push.
- `src/lib/provenance.ts` resolver (records ZIP, then mirror shard, with an in-memory cache). `recordsZip.ts` accepts the optional `provenance/` files.
- `AGENTS.md`: add a rule that provenance is stored separately from the mint shards and filled by backfill + incremental bookmark. Add the task to `roadmap.md`.
