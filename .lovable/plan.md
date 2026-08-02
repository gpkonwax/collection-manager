# Unify trade wording: "You send" / "They send back"

## Problem

The trade flow uses two different vocabularies. In "Propose a trade" the left column is "They give" and the right is "You give". In the Trades dialog's Sent tab the left is "You send" and the right is "They send back". Same idea, opposite sides, different words.

## Change

Adopt the Sent-tab wording everywhere in the composer, with your cards on the left:

- Left picker: title "You send", subtitle "Pick from your <protocol> cards"
- Right picker: title "They send back", subtitle "Pick from <counterparty>'s <protocol> cards"

So the columns swap position (your wallet on the left, theirs on the right) and take the new labels. Selection state, validation, and the built transaction are unaffected — only which column renders first and what it is called.

The Received tab is unified too, in the same send/send-back vocabulary and with the same left/right convention (their side first, since they made the offer):

- Left: "They send" (their cards)
- Right: "You send back" (your cards)

## Technical detail

Two files.

`src/components/TradeComposerDialog.tsx`: in the two-column grid around lines 540–563, reorder the two `AssetPicker` blocks so the "mine" picker renders first, and update the `title`/`subtitle` props. Refresh the two prop doc comments near lines 45–47 that reference the old labels.

`src/components/TradesDialog.tsx`: in `OfferCard` (lines 257–269), change the incoming labels from "They give you"/"You give" to "They send"/"You send back". Outgoing labels stay "You send"/"They send back".

No changes to offer building, actions, or hooks.
