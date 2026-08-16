# Make the ZIP backup genuinely reliable offline

## Confirmed diagnosis

The images are present. Seeing a different, smaller set fail after loading the same ZIPs points to the browser loader rather than missing archive data, and the current implementation confirms two weaknesses:

1. **The entire backup is expanded into memory.** `ingestMirrorZip()` reads a whole ZIP into an `ArrayBuffer`, `fflate.unzip()` expands every file at once, then copies every image again into another `Uint8Array`, a `Blob`, and a `blob:` URL. With multi-gigabyte ZIP parts, transient ZIP buffers, uncompressed bytes, Blobs, and decoded GIF/JPEG data can occupy several times the archive size. Browser memory pressure and image-decoder failures can therefore affect different cards on different runs even though their bytes are in the ZIP.
2. **Only the first ZIP part reliably notifies mounted cards.** The hook subscribes to a snapshot that returns only `0` or `1` (`hasLocalMirror() ? 1 : 0`). After part 1 changes it to `1`, loading parts 2 and 3 keeps it at `1`, so React sees no new snapshot and card hooks that previously missed do not necessarily re-resolve. Those cards continue trying network gateways, which explains why some blanks remain despite being present locally.

There is also a deterministic path mismatch: image paths containing encoded spaces can be requested as `%20` while ZIP entries use literal spaces. That affects specific variants and must be normalized.

The reliable solution is not more retries. It is to stop holding the whole image library in RAM and treat the ZIPs as a read-only local image drive.

## 1. Replace eager extraction with an indexed, on-demand ZIP reader

- Use a browser ZIP reader that can read each selected `File` by random access.
- On load, read only each archive's central directory and build a lightweight index of entry names; do **not** decompress every image.
- Keep the selected browser `File` objects as the backing store for the session.
- When a visible card requests an image, locate its indexed ZIP entry and decompress only that image.
- Return the resulting `blob:` URL to the existing media hook, ahead of every online source.

This makes memory usage proportional to the visible cards, not the entire multi-gigabyte archive.

## 2. Add a bounded image cache with safe cleanup

- Cache recently extracted local images so scrolling back does not repeatedly unzip them.
- Set a byte-based memory ceiling and evict least-recently-used entries that are no longer mounted.
- Revoke evicted `blob:` URLs only after their card consumer releases them.
- Deduplicate simultaneous requests for the same entry so stacked copies extract once.
- Clear all readers, indexes, requests, and Blob URLs when “Clear loaded backup” is pressed.

## 3. Make multi-part loading atomic and observable

- Index all selected parts first, then publish one new monotonically increasing mirror generation after the complete batch is ready.
- Replace the current `0/1` subscription snapshot with this generation, so every successful batch causes mounted cards—including prior failures—to retry local resolution.
- Do not show “You're protected” merely because at least one file exists.
- Track every selected part by name, file count, and readiness, and clearly report a failed or incomplete part.

## 4. Normalize every lookup path

Use one canonical key function for both ZIP indexing and card requests:

- strip `mirror/` and map `atomic/` paths to the same bare IPFS key used by card metadata
- safely decode `%20` and other URL-encoded path segments
- normalize slashes and remove query/hash suffixes
- support AtomicAssets bare CIDs whose stored file has a detected extension
- preserve aliases for both raw and encoded forms where needed

## 5. Prove archive coverage before claiming protection

After indexing, compare the loaded entries with the pinned `gpk-manifest.json`:

- expected files vs. indexed files
- all required ZIP parts loaded
- missing and duplicate entry counts
- coverage by major series, including Tiger King

The Offline Backup panel will show one of:

- **Complete — safe to use fully offline**
- **Incomplete — part(s) or image entries missing**
- **Corrupt entry detected**

Provide a compact downloadable/copyable report for any mismatch. ZIP CRC validation will run when an individual entry is extracted; an entry that fails CRC will be marked corrupt rather than silently falling back online.

## 6. Enforce offline-first behavior

- A local ZIP hit must never time out into a public gateway while extraction is still pending.
- If the ZIP index says the image exists but extraction fails, show a specific local-backup error and allow retry; do not disguise it as an IPFS failure.
- Only use mirrors/gateways when the loaded ZIP index definitively does not contain the requested key.
- Previously failed cards must recover automatically when a complete ZIP batch is loaded.

## 7. Validation

Add focused tests for:

- three ZIP parts loaded as one batch, including a card from the final part
- reloading a batch after a previous failed card request
- encoded-space paths
- AtomicAssets bare-CID and extension mapping
- concurrent duplicate requests
- LRU eviction without revoking an in-use image
- incomplete part detection and bad-entry/CRC handling
- fully offline rendering with all network image requests blocked

The final acceptance check is: load all parts, receive **Complete — safe to use fully offline**, block every IPFS and mirror host, browse Tiger King and other series, and confirm every indexed card resolves only from local ZIP entries.

## Technical scope

- Refactor `src/lib/localMirror.ts` from an eager in-memory store into an indexed asynchronous local source with acquisition/release semantics.
- Adapt `useIpfsMedia` to await local resolution and treat “indexed/pending” differently from “not present.”
- Update `BackupPanel.tsx` with batch progress, part status, coverage verification, and honest complete/incomplete status.
- Extend `localMirror.test.ts` and media-source tests around the new async behavior.
- Keep the existing online mirror and gateway fallback behavior unchanged when no ZIP is loaded or an image is absent from the backup.
