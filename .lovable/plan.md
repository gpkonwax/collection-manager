# Restore bridge mint in the card grid

- Keep the existing top ribbon unchanged: it shows the original mint number, or `#--` while unresolved.
- Restore the separate green **Bridge Mint #…** label below the card's metadata, in the same position and style it had before removal. Include `/ total` when the bridge total exists and keep the attachment indicator alongside it.
- Show this label only on bridged AtomicAssets cards in Series 1, Series 2, and Exotic when bridge-mint data exists. Do not show it on SimpleAssets or native AtomicAssets cards.
- Update the grid tests to cover resolved and unresolved original mints, bridged versus native cards, and the separate label. Check the displayed result in both themes.

## Technical details

Reuse the existing `isBridgedAsset` classifier and restore the conditional label markup removed from `SimpleAssetCard` in the October 2 revision. Retain the current mint ribbon logic and existing bright-theme bridge-mint styling; no mint resolution or card-detail changes.
