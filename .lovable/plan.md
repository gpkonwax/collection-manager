## Fix "data is too long" when zipping the expanded mirror

### What's happening
After the atomic download finished (1545 files OK), the script tried to rebuild `gpk-image-mirror.zip` covering the combined mirror (Series 1/2/Exotic + all new atomic files). The resulting buffer is now well over Node's ~2 GB single-buffer limit, so two things blow up:

1. `JSZip.generateAsync({ type: 'nodebuffer' })` builds the whole ZIP in memory.
2. `sha256(zipBuf)` then calls `Hash.update` on that same >2 GB buffer → `RangeError: data is too long`.

Your **downloaded images are safe** — they're on disk in `scripts/mirror-output/`. Only the final ZIP + manifest hashing step failed. The manifest.json for the atomic files was already saved before the zip step.

### The fix (script-only, no app changes)

Change `scripts/build-image-mirror.mjs` so the ZIP is built and hashed as a **stream** instead of one giant buffer:

1. Replace `JSZip.generateAsync({ type: 'nodebuffer' })` with `zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'STORE' })`.
2. Pipe that stream into **both** `fs.createWriteStream(zipPath)` and a `crypto.createHash('sha256')` transform, tracking byte count as it flows.
3. On stream `finish`, read the final digest + byte count and write them into `manifest.json` (`zipSha256`, `zipBytes`) exactly like today.
4. Keep the existing `--no-zip` flag working (already supported).

Also add a safety net in `scripts/build-atomic-mirror.mjs`:

5. When the combined mirror is likely to exceed the practical ZIP size, print a clear note ("ZIP is ~2.5 GB — upload via GitHub Release, not `git push`") so you don't hit the GitHub push limit again.

### What you'll run after I ship the fix

Nothing needs re-downloading. Just re-run:

```cmd
node scripts/build-atomic-mirror.mjs
```

It will skip all 1545 already-downloaded files (resumable), rebuild the ZIP via streaming, write the correct `zipSha256` / `zipBytes`, and copy the pinned manifest into `public/gpk-manifest.json`. Then verify:

```cmd
node scripts/verify-mirror.mjs scripts/mirror-output
```

Then upload as before (GitHub push for the folder in batches, Release asset for the ZIP, Cloudflare re-upload minus the ZIP).

### Technical notes
- Streaming avoids ever holding the full ZIP in a single Buffer, sidestepping both the JSZip nodebuffer cap and the `Hash.update` 2 GB argument cap.
- `compression: 'STORE'` is unchanged (images are already compressed; no CPU wasted).
- The manifest schema (`zipSha256`, `zipBytes`, `zipFileName`) stays identical, so `remoteMirror.ts` and `localMirror.ts` need no changes.
- Existing resumability (`errorCounts`, `missing`) is untouched — only the final zip+hash stage changes.

Approve and I'll patch the script.
