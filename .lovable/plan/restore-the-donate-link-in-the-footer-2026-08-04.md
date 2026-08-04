# Restore the Donate link in the footer

Bring back the donation entry point as a simple text link in the footer, using the existing donate dialog (unchanged) with its pack thumbnails.

## What the user sees

- A small `Donate` link at the bottom-left of the footer, on the same horizontal level as the first line of the disclaimer block, styled like the bullet links above it (cheese-colored, underline on hover).
- The link only appears when a wallet is connected. Logged-out visitors see nothing extra.
- Clicking it opens the existing donate dialog: recipient `gpkcheesegpk`, a Tokens tab (WAX / CHEESE amount) and a Packs tab that lists SimpleAssets and AtomicAssets packs as image thumbnails with +/- quantity pickers.
- After a successful donation, the existing transaction success dialog shows the transaction ID and explorer link.

## Technical notes

All work is in `src/pages/Index.tsx`; `src/components/wallet/DonateDialog.tsx` stays as is.

1. Import `DonateDialog` and add a `showDonateDialog` state.
2. In the disclaimer container (the `mt-6 pt-4 border-t` block, around line 3050), wrap the first row so the Donate button sits left-aligned on the same line as the start of the disclaimer paragraph — a flex row with the button first and the disclaimer text taking the remaining width, collapsing to stacked on small screens.
3. Render the button only when `isConnected && accountName` (matching the header's connected checks), as a `text-xs text-cheese hover:underline` button.
4. Mount `<DonateDialog>` near the other dialogs at the end of the page, passing `gpkPacks={packs}`, `atomicPacks={atomicPacks}` (both already available from `useGpkPacks` / `useGpkAtomicPacks`) and an `onSuccess` handler that opens the existing `TransactionSuccessDialog` with the returned tx id, same as other flows on the page.
