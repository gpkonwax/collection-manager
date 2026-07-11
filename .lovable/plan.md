
## View Another Wallet (Read-Only)

Add a lightweight way to browse any WAX account's `gpk.topps` collection without touching your own session. The viewed data flows through the exact same grid / card / detail components; only the write actions and private-only views get hidden.

### 1. Viewing state (single source of truth)

Introduce a `viewedAccount` string in `Index.tsx` (or a tiny `ViewContext`) that overlays the current session:

```ts
const effectiveAccount = viewedAccount ?? accountName;
const isViewing = !!viewedAccount && viewedAccount !== accountName;
```

Every hook that currently reads `accountName` for fetching switches to `effectiveAccount`:

- `useSimpleAssets`
- `useGpkAtomicAssets`
- `useGpkPacks`
- `useGpkAtomicPacks`
- `fetchPendingNfts` polling (only run when `!isViewing`)

Write-oriented state stays keyed to `accountName` and is simply hidden when `isViewing`.

URL support: `?view=<account>` — read on mount, keep in sync with `history.replaceState`. "Clear" removes the param and restores your own wallet. Browser back works naturally.

### 2. Header UI (next to the account chip)

In the top bar, right next to the wallet dropdown, add a small "View wallet" control:

- Compact `Input` (WAX-name pattern) + "View" button.
- Validates client-side against WAX account rules: `^[a-z1-5.]{1,12}$`, no leading/trailing dot, no double dots. On invalid input, show a subtle inline error, no toast spam.
- Optional pre-check via `get_account` on `WAX_CHAIN.rpcUrls[0]`; on 404 show "Account not found" and do not switch.
- On success: set `viewedAccount`, update URL, close the popover.

While `isViewing`, the header shows a persistent banner/pill:

```
Viewing someuser.wam (read-only) — [Return to my collection]
```

Placed just under the top bar so it's visible on every scroll position.

### 3. Read-only enforcement

When `isViewing === true`, hide or disable, do NOT just visually gray out:

- Transfer, Burn, Batch Actions bar
- Puzzle claim/build actions
- Pack open / reveal actions (pack cards still render, but the "Open" button is hidden)
- Price alert create/edit (existing alerts panel is hidden entirely)
- Save layout / import layout / edit Saved order
- Donate flows tied to the viewed wallet
- Collect Unclaimed button
- Any "Refetch" that mutates local storage keyed to the viewed wallet

Guardrails inside `WaxContext` write methods (`transferNFTs`, `burnNFTs`, `claimDrop`, `joinDao`, etc.): unchanged — they operate on `session`, which is still yours. Since the buttons are hidden, they cannot be triggered against the viewed wallet.

### 4. Hidden views while viewing

Per your call, when `isViewing`:

- Completion % component is not rendered.
- Puzzle Builder tab/view is not rendered (and if the user is currently on it, auto-switch to Classic).
- Saved layout view is not rendered. Category/view switcher hides that option.

Views that stay: Classic grid, Binder view, Card Detail dialog (zoom/flip/metadata/external market links only — action buttons removed).

### 5. localStorage isolation

All keys currently built from `accountName` (`gpk-saved-layout-${accountName}-...`, alerts, stuck-pack storage, etc.) must keep using `accountName`, not `effectiveAccount`. This prevents the viewed wallet from ever writing to your saved layouts or reading someone else's. Audit sites:

- `Index.tsx` layout keys (lines ~400–810)
- `usePriceAlerts`
- `stuckPackStorage`
- Any binder template caches keyed by account

Since Saved/Puzzle/Alerts are hidden while viewing, most of this is automatic; the audit just confirms no side-writes slip through.

### 6. Edge cases

- Viewing your own account name via `?view=me`: treat as not viewing (clear the flag).
- Wallet disconnected while viewing: viewing keeps working (no session needed to read public data).
- Empty collection: reuse the existing empty-state copy, worded as "This wallet has no GPK NFTs."
- Fetch error for viewed wallet: show inline error inside the grid, keep the "Return to my collection" button visible.
- Any WAX name allowed (per your call) — no blocklist for bridge/contract accounts.

### 7. Files to touch

- `src/pages/Index.tsx` — viewing state, URL sync, banner, hide write UI, gate Saved/Puzzle/Completion, thread `effectiveAccount` into the four fetch hooks, keep localStorage keys on `accountName`.
- New `src/components/ViewWalletControl.tsx` — the input + validation + optional `get_account` check, rendered in the top bar next to the account chip.
- New `src/components/ViewingBanner.tsx` — sticky banner with "Return to my collection".
- `src/components/simpleassets/SimpleAssetDetailDialog.tsx` — accept an `isReadOnly` prop; hide Transfer/Burn/Alert buttons when true.
- `src/components/simpleassets/SimpleAssetCard.tsx` — accept `isReadOnly`; skip selection checkbox and any inline action.
- `src/components/simpleassets/GpkPackCard.tsx` / `AtomicPackCard.tsx` — accept `isReadOnly`; hide Open button.
- No changes to `WaxContext` — the session-based write methods stay untouched.

### 8. Verification

- Enter your own account → normal experience, no banner.
- Enter another known WAX account → grid populates with their SA + AA GPKs; banner visible; Transfer/Burn/Open/Alerts/Save/Puzzle/Completion all gone; detail dialog opens read-only.
- Disconnect wallet while viewing → grid keeps working.
- `?view=someuser.wam` deep link works on hard reload; "Return to my collection" removes the param.
- Invalid names (`FOO`, `too-long-name-here`, `..bad`) rejected inline; `get_account` 404 shows "Account not found".
- Saved layout for your own account is untouched after a view session.
