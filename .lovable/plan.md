## What is actually happening

**Do I know what the issue is? Yes.** The current pack reveal preload is still built around `new Image()` attempts that walk sources one-by-one. For an Exotic Mega, one worker can spend roughly this long before it returns:

```text
original Pinata URL + 5 rotated gateways/mirror candidates × 8s each = up to ~48s per card
```

There are 4 workers, so the UI can sit at `0 / 25 cards ready` for a long time if the first 4 images are all on slow GIF/IPFS requests.

The **Reveal now** button does not immediately reveal because it only flips `preloadSkipRef.current = true`. The workers only check that flag **between cards**, not while they are currently stuck inside `preloadCardImage()`. So pressing it can appear to do nothing until the current 4 long preload attempts finish.

The reason thumbnails load after refresh / Show Received Cards is that collection thumbnails are not blocked behind an all-cards preload gate. They lazy-load a few visible images at a time through the normal `useIpfsMedia` path, with caches/mirror handling, so slow cards do not freeze the entire UI.

## Fix plan

### 1. Make SA reveal preloading genuinely cancellable

In `src/components/simpleassets/PackRevealDialog.tsx`:

- Replace the current `preloadCardImage()` loop with an abort-aware resolver.
- Track active preload work with an `AbortController` / finalizer ref.
- On timeout, abort/cleanup the active request instead of just resolving false while the browser may continue holding that connection.
- On dialog close/unmount, abort all active preload work.

### 2. Make “Reveal now” immediate

Change the button so it does not wait for workers to naturally finish.

When clicked:

- Abort active preload attempts immediately.
- Build the reveal card list from winners already resolved.
- Keep original URLs for cards not yet resolved.
- Set `newCards` and switch to `revealing` immediately.
- Guard the async preload completion path so it cannot later double-finalize or jump phases again.

### 3. Use mirror-first loading for pack reveals

The reveal should not start with public IPFS gateways when we have backup mirrors.

For each card, candidate order should be:

1. loaded local ZIP mirror, if present
2. built-in primary mirror
3. Backup A / Netlify mirror
4. Backup B / Cloudflare mirror as best-effort only
5. public IPFS gateways last

This matches why thumbnails recover better: use the controlled mirrors first, then IPFS only as fallback.

### 4. Race a small set of sources per card instead of walking every gateway serially

For each card:

- Try the best 2-3 sources in a small race.
- Keep total pack-level concurrency low so we do not flood hosts.
- Abort losing requests after a winner is found.
- If the mirror race fails, then fall back to public gateways with bounded attempts.

This avoids the current “wait 8 seconds per gateway per card” wall.

### 5. Make unresolved cards self-heal during reveal using the same source priority

Update `RevealCardImage` so cards that were skipped/unresolved do not restart at Pinata and suffer the same issue again.

- If preload produced a winner URL, render that directly.
- If no winner exists yet, use the same mirror-first source list.
- Keep image loading eager during the reveal.
- Keep the card shell visible so the sequence continues even if one image is slow.

### 6. Improve progress diagnostics

Add clear preload status without blocking user action:

- Keep `X / N cards ready`.
- Add current mode/source text such as “Checking backup mirrors…” / “Falling back to IPFS…”
- Console logs should show source category and timing per card, e.g. mirror winner vs IPFS fallback vs skipped.

### 7. Verify the exact failure class

After implementation:

- Run a targeted test/simulation where image loads hang and confirm **Reveal now** switches to `revealing` immediately.
- Verify a real/simulated 25-card pack cannot remain stuck at `0 / 25` indefinitely.
- Verify normal collection thumbnails still load unchanged.
- Verify Series 1 mega, Series 2c, and Exotic mega all use the same fixed SimpleAssets path.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>