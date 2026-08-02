# Flag SimpleAssets offers in the Trades button badge

Right now the coloured number on the Trades button in the header only counts AtomicAssets offers. The SimpleAssets hook that loads msig swap proposals tracks no unread state at all, so an incoming SA offer arrives silently.

## What changes

- The badge counts unread incoming offers from **both** protocols (AA + SA) as one number.
- Opening the Trades dialog marks both protocols read, so the badge clears in one go.
- The tooltip keeps the same wording ("N new incoming trade offers"), still capped at "9+".
- The existing "NEW" ribbon inside the dialog now also appears on SimpleAssets rows, since both use the same last-seen timestamp.

## Technical notes

**`src/hooks/useSaOffers.ts`**
- Add the same unread tracking `useAtomicOffers` has: read/write the shared `gpk-trades-last-seen:<account>` localStorage key, expose `incomingUnreadCount` and `markAllRead`.
- Both hooks writing the same key is intentional — one shared "last seen" moment across protocols keeps the merged list consistent.
- Guard for SA offers whose `created_at_time` is 0 (a proposal discovered without a history timestamp): treat those as unread rather than silently dropping them, using the derived `expiration - 7 days` value already computed in `saOffers.ts` as the fallback.

**`src/pages/Index.tsx`**
- Destructure `incomingUnreadCount` / `markAllRead` from `useSaOffers`, sum with the AA count for the header badge, and call both `markAllRead`s wherever `markTradesRead` is called today.
