# Fix "View Wallet — Show List" empty results

## Root cause

The current scan calls `get_table_by_scope` with `code: 'gpk.topps'`. That table doesn't exist — `gpk.topps` is the SimpleAssets **author**, not the row scope owner. SA rows live under `code: 'simpleassets'`, one scope per holder, and there is no on-chain or third-party holder-by-author index for SimpleAssets. A brute-force scope walk is too large for the browser.

## Approach

Precompute the holders list off-chain (Node script, same pattern as `build-atomic-mirror.mjs`) and publish it as a static JSON on the existing mirrors. The client just fetches that JSON — no live scan.

Regeneration is **manual** — you run it whenever you want a refresh, same cadence as the image mirror. No cron, no automation.

The list combines **two sources shown as separate columns**, both scoped strictly to GPK/Topps:
- **SA** — gpk.topps SimpleAssets (`code: simpleassets`, filtered by `author == 'gpk.topps'`)
- **AA** — AtomicAssets collection `gpk.topps` (all schemas — the same collection `build-atomic-mirror.mjs` already enumerates)

No `cheesenftwax` involvement.

## Changes

### 1. New script `scripts/build-holders-manifest.mjs`

- **SA pass**: paginate `get_table_by_scope` on `simpleassets.sassets` (1000/page, follow `more`). For each scope, `get_table_rows` and count rows where `author === 'gpk.topps'`. Concurrency-limited (8 parallel) with RPC fallback across `WAX_RPC_ENDPOINTS`. Skip scopes whose gpk.topps row count is 0.
- **AA pass**: page through `/atomicassets/v1/accounts?collection_name=gpk.topps&limit=1000` on `ATOMIC_API.baseUrls` with fallback. Returns `{account, assets}` directly.
- **Merge** into a map keyed by account: `{ account, sa, aa, total }`.
- Writes `mirror/manifests/gpk-topps-holders.json`:
  ```json
  {
    "generatedAt": "2026-07-29T…Z",
    "totals": { "accounts": 12345, "sa": 456789, "aa": 12345 },
    "holders": [
      { "account": "abc.wam", "sa": 1234, "aa": 56, "total": 1290 },
      …
    ]
  }
  ```
- Sorted by `total desc`. Committed to the primary mirror repo and served from Netlify / Cloudflare / GitHub Pages just like existing manifests.

### 2. `src/lib/gpkHolders.ts` — replace live scan

- Drop `scanGpkTopps` (broken `code: 'gpk.topps'` call) and `scanBridgedAa` (wrong `cheesenftwax` collection).
- New `fetchTopGpkHolders` races the `remoteMirror` URLs (Netlify → Cloudflare → GitHub Pages) for `manifests/gpk-topps-holders.json`; local ZIP mirror consulted first if loaded.
- Expose `Holder = { account, sa, aa, total }` and `generatedAt` on the response.
- Cache the parsed result in-memory for the session (existing `cached` var stays).

### 3. `src/components/ViewWalletControl.tsx` — UI update

- Replace the "Scanning gpk.topps… N accounts" progress line with a simple "Loading holders…" spinner.
- Show manifest's `generatedAt` timestamp: "snapshot from 2026-07-28".
- Grid columns become `[#, Account, SA, AA, Total]` — three tabular-num numeric columns, right-aligned, with `Total` bolded in cheese/yellow.
- Header row updated to match. Row `title` becomes `"{sa} SA · {aa} AA"` for hover context.
- Sort stays `total desc`; filter, refresh (re-fetches manifest, no rescan), and click-to-fill unchanged.

### 4. `scripts/README.md`

Short section covering how to regenerate `gpk-topps-holders.json` and re-publish. Note explicitly that this is manual and re-runs whenever you want a fresh snapshot.

## Out of scope

- No cron / GitHub Actions automation.
- No live client-side rescan option — refresh just re-fetches the manifest.
- No `cheesenftwax` or any non-GPK collection.
- No historical trend data — each manifest overwrites the previous one.

## Technical notes

- Manifest size: ~15–25k combined accounts × ~50 bytes ≈ well under 1 MB, gzipped ~150 KB.
- Script runtime: 15–45 min, dominated by SA per-scope reads. Idempotent — re-runs from scratch, no partial-state file.
- Client change is a net simplification: no long-running RPC loop or AbortController for the scan; AbortController stays only for the fetch race.
- The narrower list layout (3 numeric columns) still fits in the 320px popover — columns `[28px, 1fr, 44px, 44px, 52px]`.
