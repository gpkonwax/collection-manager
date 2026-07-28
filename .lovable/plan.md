# View Wallet — Top GPK Holders list

Add a collapsible "Show List" section beneath the account input in the View Wallet popover. It displays a scrolling, ranked list of every WAX account holding 1+ GPK assets (SimpleAssets `gpk.topps` + AtomicAssets bridged `cheesenftwax` GPK schemas), largest → smallest. Clicking a row fills the input; the user still presses **View** to load.

## UX

- Popover gets a new row under the input: `Show List ▾` (toggles to `Hide List ▴`).
- Expanded panel (max ~360px tall, virtualized scroll):
  - Header row: `Rank · Account · GPK held`
  - Rows: `#1  someuser.wam   1,284`
  - Search box at top filters by account substring.
  - Status line: `Scanning… 3,214 accounts` / `Top 500 · updated 12s ago`.
- First open triggers the live scan (with a cancel button). Result is cached in-memory for the session so re-opening is instant. A small `Refresh` link re-runs it.
- Clicking a row: sets the input value, closes the list, focuses the input. User presses **View** as today.
- Bright/Dark themes: reuse existing `border-cheese/*`, `text-cheese`, `bg-card` tokens — no hardcoded colors.

## Data source & scan strategy

Scope confirmed: **both** contracts, unioned per account.

1. **SimpleAssets holders (`gpk.topps`)**
   - Endpoint: `POST /v1/chain/get_table_by_scope` on contract `gpk.topps`, table `sassets`.
   - Each row = one holder scope + row count (`count` field ≈ number of SA NFTs that account holds under gpk.topps).
   - Paginate with `lower_bound`/`limit=1000` via `WAX_RPC_ENDPOINTS` fallback until `more` is empty. Expected size: a few thousand scopes.

2. **AtomicAssets holders (bridged GPK)**
   - Use AtomicAssets API accounts endpoint with `fetchWithFallback(ATOMIC_API.baseUrls, …)`:
     `GET /atomicassets/v1/accounts?collection_name=cheesenftwax&schema_name=series1&schema_name=series2&schema_name=exotic&schema_name=…&limit=1000&page=N`
   - Reuse the schema list already present in `BRIDGED_SCHEMAS` / atomic mirror config (series1, series2, exotic, and any others we currently mirror) so it stays a superset of GPK-on-WAX AA.
   - Response gives `{ account, assets }`. Paginate until short page.

3. **Merge**: sum SA count + AA count per account into a `Map<string, {sa, aa, total}>`. Sort desc by total. Slice **top 500**.

## Files

- **New** `src/lib/gpkHolders.ts`
  - `scanGpkTopps(signal): Promise<Map<string, number>>` — paginated `get_table_by_scope` scan via `waxRpcCall`.
  - `scanBridgedAa(signal): Promise<Map<string, number>>` — paginated accounts endpoint via `fetchWithFallback`.
  - `fetchTopGpkHolders({ signal, onProgress }): Promise<Holder[]>` — runs both in parallel, merges, sorts, slices 500. Emits progress `{ saScanned, aaScanned }`.
  - Session cache: `let cached: Holder[] | null` + `cachedAt`; `getCachedHolders()`.

- **Edit** `src/components/ViewWalletControl.tsx`
  - Add `showList` state, `holders`, `loading`, `error`, `progress`, `filter`.
  - New JSX under the input: toggle button + collapsible panel with search input and a virtualized list (reuse `@tanstack/react-virtual` already in the project) inside a `max-h-[360px] overflow-auto` container.
  - On first expand (or Refresh): call `fetchTopGpkHolders` with an `AbortController`; on unmount/close abort.
  - Row `onClick`: `setValue(account)`, collapse list, focus input.
  - Preserve existing single-account validate/submit path unchanged.

## Technical notes

- All network calls go through existing fallback helpers (`waxRpcCall`, `fetchWithFallback`) so RPC/atomic endpoint outages don't kill the scan.
- Scan is cancellable and progress-reported so users see it's alive (previous perf memory: WAX table scans can take 30–90s).
- Only session cache — no IndexedDB (per the earlier decision to avoid persistent storage growth).
- No changes to holders themselves being "viewable"; the row just prefills the existing validated flow, so all existing account-exists checks still run on **View**.

## Out of scope

- No server-side snapshot, no background refresh across sessions, no leaderboard page outside the popover.
