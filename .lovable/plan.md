# Unify trade wording: "You send" / "They send back"

## Problem

The trade flow uses two different vocabularies. In "Propose a trade" the left column is "They give" and the right is "You give". In the Trades dialog's Sent tab the left is "You send" and the right is "They send back". Same idea, opposite sides, different words.

## Change

Adopt the Sent-tab wording everywhere in the composer, with your cards on the left:

- Left picker: title "You send", subtitle "Pick from your <protocol> cards"
- Right picker: title "They send back", subtitle "Pick from <counterparty>'s <protocol> cards"

So the columns swap position (your wallet on the left, theirs on the right) and take the new labels. Selection state, validation, and the built transaction are unaffected — only which column renders first and what it is called.

The Received tab keeps its own wording ("They give you" / "You give"), which reads correctly for an offer arriving at you; if you want that unified too, say so and it becomes "They send" / "You send back".

## Technical detail

One file: `src/components/TradeComposerDialog.tsx`. In the two-column grid around lines 540–563, reorder the two `AssetPicker` blocks so the "mine" picker renders first, and update the `title`/`subtitle` props. Also refresh the two prop doc comments near lines 45–47 that reference the old labels. No changes to `TradesDialog.tsx`, offer building, or hooks.
