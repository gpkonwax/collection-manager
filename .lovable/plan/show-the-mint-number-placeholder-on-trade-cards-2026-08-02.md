# Show the mint-number placeholder on trade cards

## Goal

Every card shown in the Trades dialog — both Received and Sent offers, on both sides of each offer — gets the same mint-number ribbon that already appears above cards on the homepage, so once real mint numbers arrive people can see exactly which mint they are trading.

## What changes

In the Trades dialog's card thumbnail:

- Add a small centered pill above the artwork, identical in style to the homepage ribbon: `#<mint>` when a mint is known, `#--` while it is still a placeholder, with the same tooltip wording.
- Apply the same mint rule the homepage uses:
  - Bridged GPK schemas (`series1`, `series2`, `exotic`) show `#--`, because their AtomicAssets template mint is bridging order, not the real mint.
  - Native AtomicAssets schemas show their template mint number.
- Keep the existing name and asset-id lines beneath the image unchanged.

Because both the "You send" and "They send back" / "They give you" columns render through this one thumbnail component, the ribbon appears on every card in every offer, received and sent, with no other layout change.

## Technical notes

- File: `src/components/TradesDialog.tsx` (`AssetThumb`).
- Data already available: `OfferAsset.mint` (from `template_mint`) and `OfferAsset.schema_name` in `src/lib/atomicOffers.ts` — no fetching or backend changes needed.
- When real mint numbers are plumbed in later, the same field feeds this ribbon, so it will populate automatically.
