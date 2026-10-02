# Mint number backup: self-hosted manifest plus live AtomicHub fallback

## Goal

Every SimpleAssets card (and every bridged AtomicAssets card) shows its real mint number, like `#356 / 398`, even when AtomicHub is down or still blocking browser requests. When AtomicHub opens its API, newly opened cards update live with no further work.

## How it will work for users

```text
Card on screen
  1. Saved mint backup on gpk-data (Cloudflare)  -> instant, works if AtomicHub is down
  2. Live AtomicHub lookup (once they open it)   -> covers cards opened since the last backup
  3. Neither available                           -> shows #-- as today
```

- The backup refreshes itself automatically each month, alongside the Top Holders list.
- Cards pulled from packs after the latest backup show `#--` until the next refresh, or straight away once AtomicHub opens access.
- The tooltip shows where the number came from: "Saved backup (date)" or "Live from AtomicHub".

## What gets built

1. **Mint backup builder script** (new `scripts/build-mint-manifest.mjs`)
   - Lists every gpk.topps SimpleAssets asset ID from the WAX chain, plus the original `sassets_id` of every bridged AtomicAssets card.
   - Asks AtomicHub for their mint numbers in batches of 100. Runs from a server, so the browser block does not apply. Includes polite pacing, retries and resume support.
   - **Incremental:** after the first full run, mint numbers already saved are never fetched again (a mint never changes). Monthly runs fetch only new cards, plus one sample per card type to update the "of total" and burned counts.
   - Splits the output into small files, grouped by the last 3 digits of the asset ID (about 1000 files), so the app downloads only the pieces it needs. A small index file records the snapshot date, the count, and file hashes.

2. **Data mirror and monthly automation**
   - `build-data-mirror.mjs` copies the mint files into `gpk-data/manifests/mints/` and lists them in the existing data-mirror index.
   - The existing monthly GitHub workflow (10th of each month) also runs the mint builder, then deploys and commits as it already does. It uses the Cloudflare secrets you already set up, so you add nothing new.

3. **App lookup** (`src/lib/saMintResolver.ts`)
   - Looks in the saved backup first. Only the needed pieces are downloaded, and they are cached for the session.
   - Asks AtomicHub live for anything missing, as it does today. That request currently fails quietly in the browser and will start working once access opens.
   - Totals: the larger of the two sources wins, so a live answer always overrides an older backup.
   - The main grid, Trades, Trade composer and Atomic pack browser already use this lookup, so they all benefit without separate changes.

4. **Offline copy**
   - The downloadable offline app bundles the mint index and its pieces, so mint numbers show with no internet connection.

## Order of work

1. Do a small test run of the builder (a few thousand assets). Measure the real total asset count and AtomicHub's rate limits, then confirm the file sizes stay well under Cloudflare's limits (25 MB per file, 20,000 files per site).
2. Write the full builder and the app lookup, with tests covering backup hits, live overrides, missing entries and offline mode.
3. Run the first full build. If it takes longer than one GitHub run allows (2 hours), it will be run in resumable chunks, possibly from the sandbox, then published.
4. Wire up the workflow, deploy, and check in the preview that Series 1, Series 2 and Tiger King cards show real numbers.

## Technical details

- Mint record format per piece file: `{ "<sa_id>": [mint, total, burned] }`. Totals per card key (`category:cardid:side:quality`) are stored separately in `mints/totals.json`, so monthly total updates do not rewrite every piece.
- Index: `manifests/mints/index.json` → `{ generatedAt, count, shards: { "000": { bytes, sha256 } ... } }`.
- Resolver order: memory → session cache → mirror shard (fetched via `getDataMirrorBases()` with the existing fallbacks) → live AtomicHub (existing batch code, 15 s timeout). Live results are cached under the existing `gpk_sa_mint_v2_` keys.
- Workflow: a new step `node scripts/build-mint-manifest.mjs --incremental`, placed before `build-data-mirror.mjs`; the commit step also adds `manifests/mints/`.
- `AGENTS.md`: add a rule that mint numbers come from the self-hosted backup first and live AtomicHub second.
