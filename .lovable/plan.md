

## Footer with Donate Button and Modal

### What gets built

A footer at the bottom of the page with the donation blurb and a "Donate" button. When clicked, a `DonateDialog` modal opens with two tabs: **Tokens** and **NFTs**.

### Footer (`src/pages/Index.tsx`)
- Add a footer section below all existing content (before the floating selection bar)
- Centered text with the blurb: *"This Project was built by the $CHEESE team..."*
- A cheese-themed "Donate" button that opens the modal
- Styled to match the existing dark/cheese theme

### DonateDialog (`src/components/wallet/DonateDialog.tsx` — new file)
- Header: "Donate WAX or unopened GPK packs to $CHEESE Team"
- Recipient field pre-filled with `gpkcheesegpk` (read-only for now)
- Two tabs using the existing `Tabs` component:

**Token Tab:**
- Token selector dropdown (WAX at 8 precision via `eosio.token`, CHEESE at 4 precision via `cheeseburger`)
- Amount input (number)
- Send button → calls `transferToken` from `WaxContext` with the selected token's contract/symbol/precision, recipient, amount, and memo `"donation"`

**NFT Tab:**
- Fetches user's AtomicAssets + SimpleAssets using existing hooks (`useSimpleAssets`, `useGpkAtomicAssets`)
- Displays selectable card grid (thumbnails with checkboxes, similar to batch transfer)
- Send button → builds combined transaction (same pattern as `TransferDialog.tsx`):
  - `simpleassets::transfer` for SA assets
  - `atomicassets::transfer` for AA assets
- On success: show `TransactionSuccessDialog`

### Files to change

| File | Change |
|------|--------|
| `src/components/wallet/DonateDialog.tsx` | **New.** Modal with token/NFT tabs, sends to `gpkcheesegpk` |
| `src/pages/Index.tsx` | Add footer section + render `DonateDialog` with open state |

### Technical notes
- Reuses `transferToken` from WaxContext for token donations
- Reuses the same multi-action transaction pattern from `TransferDialog` for NFT donations
- NFT grid in the modal shows small thumbnails with checkboxes (scrollable area)
- WAX token: contract `eosio.token`, symbol `WAX`, precision 8
- CHEESE token: contract `cheeseburger`, symbol `CHEESE`, precision 4
- All buttons/inputs styled with cheese theme to match existing UI

