## Goal

Make "Newest" sort reflect when an NFT entered the wallet, as accurately as each contract allows.

- **AtomicAssets**: sort by real `transferred_at_time` from the Atomic API (accurate).
- **SimpleAssets**: keep asset-ID descending as a best-effort proxy (the `sassets` table has no receipt timestamp). Label the option so users know the caveat.

## Changes

### 1. Capture transfer time for AtomicAssets
`src/hooks/useGpkAtomicAssets.ts`
- Add `transferredAt?: number` (ms epoch) to the internal asset shape.
- Read `transferred_at_time` from each Atomic API row (string ms since epoch) and parse to number.
- Pass it through when constructing the unified asset object handed to the page.

`src/hooks/useSimpleAssets.ts`
- Add `transferredAt?: number` to the exported `SimpleAsset` interface, left `undefined` for SA rows (no source of truth).

`src/pages/Index.tsx` (wherever atomic assets are merged into the unified `SimpleAsset[]`)
- Propagate `transferredAt` from the atomic hook into the merged asset object. No change to SA merge path.

### 2. Update the Newest comparator
`src/pages/Index.tsx` around line 887:
- New rule for `sortMode === 'newest'`:
  1. If both assets have `transferredAt`, sort by it descending.
  2. If only one has `transferredAt`, the one with a real timestamp comes first (Atomic is genuinely "newer info" than an ID guess).
  3. If neither has `transferredAt` (both SA), fall back to the current BigInt asset-ID descending compare.
- Keep the existing try/catch around BigInt parsing.

### 3. Label the option honestly
`src/pages/Index.tsx` around line 2439:
- Change the SelectItem label from `Newest` to `Recently received`.
- Add a small helper text / tooltip near the sort dropdown (or extend the existing note) explaining: "AtomicAssets use real transfer time. SimpleAssets fall back to asset ID (mint order) — no on-chain receipt time exists for SA."

No other sort modes, filters, or views change. No backend/data-model changes. No new dependencies.

## Verification

- Wallet with mixed Atomic + SA cards: with "Recently received" selected, the most recently transferred Atomic cards appear first, ahead of SA cards, and SA cards among themselves order by asset ID descending (matches today's behavior for SA).
- Wallet with Atomic-only: order matches Atomic API `sort=transferred` order.
- Wallet with SA-only: order is unchanged from today.
- Confirm no regression in Classic, Binder, and Saved views.

## Out of scope

- Scanning WAX action history for SA transfer times (rejected: slow, rate-limited).
- Changing any other sort mode.
- Persisting a locally-observed "first seen in wallet" timestamp — not requested.
