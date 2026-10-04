# Card detail Information column

- Add **Information** as the leftmost column in card details, with **Mint information** next and **Bridge Information** on the right for bridged cards. Stack the columns on narrow screens; use two columns when there is no bridge information.
- Show the NFT ID as a clickable link: AtomicHub for AtomicAssets and the existing WAX Explorer destination for SimpleAssets. Show a clickable template ID only when an AtomicAssets template exists.
- Show **Collection: gpk.topps** linking to its AtomicHub collection page and **Series** linking to the matching AtomicHub schema page. Display a readable series name while preserving the correct schema in its link.
- Keep the external-site warning for each new link. Avoid duplicating the template ID in Mint information; retain its AtomicAssets issued-supply figure there.
- Verify bridged, native AtomicAssets, and SimpleAssets card details, including destinations and column order.

## Technical notes

The detail dialog already holds the asset ID, source, schema/category, template ID, and the external-link warning. Reuse those values and the existing category-label mapping; no new network request or saved data is needed. AtomicHub's numeric asset and template explorer paths respond successfully, so the readable card-name prefix in example URLs is not required for the link destination.
