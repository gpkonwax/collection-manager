# Merge the two pack-history download buttons into one

Today the dialog has two downloads: "Download pack history JSON" (top, only what's stored on this device) and "Export my past openings from chain" (bottom, rebuilds from WAX history). That split is confusing — most people want everything.

## What changes

- The top **Download pack history JSON** button becomes the single action. When clicked it:
  1. Rebuilds past openings from WAX chain history (same scan as today, with the live progress message shown).
  2. Merges those with whatever is already stored on this device (dedup by transaction).
  3. Downloads one combined JSON file.
  4. Also loads the merged result into the list on screen, so the openings appear immediately instead of requiring a re-import.
- While it runs, the button shows a spinner and is disabled; progress text ("Rebuilding openings… 12/40") shows under the button.
- If chain history nodes can't be reached, it still downloads whatever is stored locally and shows a warning toast rather than failing outright.
- The bottom section's **Export my past openings from chain** button and the explanatory paragraph ("The chain export only downloads a file…") are removed. That row keeps only **Clear on this device** and the stored counter.
- "Load pack history JSON" stays as is (for files shared between devices/people).

## Technical notes

All in `src/components/simpleassets/PackHistoryDialog.tsx`:

- Fold `handleChainExport` into `handleDownload`: call `exportPackHistoryFromChain(account, setChainProgress)` inside a try/catch, `mergePackHistory(result.entries)` into local storage, `reload()`, `onHistoryChanged?.()`, then `downloadPackHistory(account, mergedEntries)` + `markPackHistoryDownloaded(account)`.
- Reuse `chainBusy` / `chainProgress` state for the top button; move the progress `<p>` next to it.
- Delete the chain-export `Button` and the note paragraph at the bottom of the dialog; keep `HistoryUnavailableError` handling in the merged handler.
- Drop now-unused imports (`buildPackHistoryEnvelope` if the blob path is replaced by `downloadPackHistory`).
