Implement the button behavior exactly as requested:

1. Keep **Show Received Cards** visible whenever the wallet is connected and not viewing another wallet.
2. Show the bracketed number only when the in-memory latest-pack data exists and contains received cards.
3. Make the button pressable only while that received-card data exists.
4. When pressable, clicking it will focus the collection/category and reveal the existing **Last Pack Opened** received-card panel without refreshing or reconstructing anything.
5. When the data is gone, the button will show no number and clicking it will intentionally do nothing.
6. Stop `recheckUnclaimed` / pending history checks from putting a stale count on the button by themselves.

Technical details:
- Derive the visible count from `packAudit.assets.length`, not `collectionSyncNotice.count` from persistent pending history.
- Leave `collectionSyncNotice` for category/focus hints only.
- Update the top-bar button rendering and click handler in `src/pages/Index.tsx`.
- Verify with a browser check that the button remains visible, has no stale count when no panel data exists, and only acts when `packAudit.assets` exists.