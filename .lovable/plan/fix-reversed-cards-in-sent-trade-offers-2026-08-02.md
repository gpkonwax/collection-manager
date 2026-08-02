# Fix reversed cards in Sent trade offers

## Problem

In the Trades dialog, sent (outgoing) offers show the two card columns under the wrong headings: the card you are actually sending appears under "They send back", and the card you asked for appears under "You send". Received offers are labelled correctly.

## Cause

In `src/components/TradesDialog.tsx`, the offer card computes two asset lists:

- `theyGive` = counterparty's assets (for outgoing offers this is `recipient_assets`, i.e. what they send back)
- `youGive` = your assets (for outgoing offers this is `sender_assets`, i.e. what you send)

The two column labels are then applied in the incoming order for both directions, so on outgoing offers "You send" is rendered over `theyGive` and "They send back" over `youGive` — exactly reversed.

## Fix

Render the columns so each label always matches its own list:

- Column showing your assets → "You give" (incoming) / "You send" (outgoing)
- Column showing their assets → "They give you" (incoming) / "They send back" (outgoing)

For incoming offers keep the current visual order (their offer first, yours second); for outgoing offers show your assets first, their return assets second — matching how the cards are already positioned on screen, just with the correct labels and correct underlying lists.

## Scope

Presentation only, one file: `src/components/TradesDialog.tsx`. No changes to offer fetching, accept/decline/cancel actions, or the trade composer.
