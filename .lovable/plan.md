## Goal

Simulate a real mega pack reveal against the live mirror-first pipeline — no wallet, no on-chain unbox — and measure whether every image resolves, from which tier (local / primary mirror / backup A / backup B / gateway), and how fast.

## What the test does

Drive a headless Chromium (Playwright) against the running dev server and exercise the exact same code paths a real reveal uses — `buildRevealCandidates` + `preloadRevealImage` from `src/lib/revealImageSources.ts` — for a synthetic pack of the correct size.

No production code changes. The test lives under `scripts/` (Node) and does its work in two layers:

1. **Node layer (fast, always runs)**
   - Load the pinned manifest via the same `loadPinnedManifest()` the app uses.
   - Pick representative card sets:
     - GPKMEGA (Series 1, boxtype `thirty`): 30 random cards, mixed variants (base + a couple of GIF variants like `prism`, `slime`).
     - GPKTWOC (Series 2, boxtype `gpktwo55`): 55 random cards including the +42 ID offset.
     - EXOMEGA (Exotic, boxtype `exotic25`): 25 random cards.
   - For each card, build the IPFS URL exactly like `buildGpkCardImageUrl` does, then run `buildRevealCandidates(url, null, manifest)` to get the ordered candidate list.
   - Fire parallel `HEAD` requests to every mirror candidate for every card and record: which mirror answered first, latency, HTTP status, `content-length`.
   - Emit a table per pack: `cardId | variant | winner tier | winner host | ms | mirrors OK (3/3) | manifest hit`.

2. **Browser layer (real image decode, one pack)**
   - Spin up Playwright against `http://localhost:8080`, inject a synthetic reveal by calling `preloadRevealImage` from a small dev-only page route OR by evaluating the module directly in-page (dynamic `import()` of `/src/lib/revealImageSources.ts` via Vite).
   - Run the full pack through `preloadRevealImage` in parallel with the same abort/timeout logic the dialog uses.
   - Capture `{ url, label, elapsedMs }` per card + total wall time.
   - Screenshot nothing — this is a data test, not a visual one.

## Deliverable

A single script `scripts/test-reveal-pipeline.mjs` runnable as:

```
node scripts/test-reveal-pipeline.mjs --pack GPKMEGA
node scripts/test-reveal-pipeline.mjs --pack GPKTWOC --browser
node scripts/test-reveal-pipeline.mjs --all
```

Output sections:
- **Manifest coverage**: how many of the pack's hashes are in `pinned-manifest.json`.
- **Per-mirror health**: for each of Netlify / GitHub / Cloudflare, count of 200s vs failures across all hashes.
- **Winner distribution**: how many cards resolved from each tier, and the p50/p95 latency.
- **Missing files**: any card where all mirrors failed (these are the ones a real reveal would fall through to IPFS for).
- **Browser wall time** (when `--browser` is passed): total ms for the full pack parallel preload — the number that matters for user-perceived reveal readiness.

## What we learn

- Whether Netlify / GitHub / Cloudflare actually have every mega-pack card (surfacing the same gaps `audit-mirrors.mjs` finds, but scoped to a real pack shape).
- Whether the mirror-first ordering wins in practice, or whether we're still falling through to IPFS for some variants (e.g. GIFs excluded from Cloudflare by size).
- The real end-to-end preload time for a 30/55/25-card pack — the number that determines whether "Reveal now" ever needs to be pressed.

## Out of scope

- No on-chain transactions, no `gpk.topps::unbox`, no wallet.
- No changes to `PackRevealDialog.tsx`, `Index.tsx`, or the mirror-first library — this only reads them.
- No visual/screenshot testing — `audit-mirrors.mjs` already covers byte-level checks; this test is about reveal-path behavior end-to-end.
