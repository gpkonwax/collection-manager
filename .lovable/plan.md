# Card detail mint and bridge information

- Remove the “Mint number — saved backup (date)” line from **Mint information** in card details, while keeping the original mint number and supply figures there. Leave the grid’s mint tooltip and the backup lookup unchanged.
- Give bridged cards their own **Bridge Information** section below Mint information, with the existing bridge mint and, when available, the date the AtomicAssets version was created. Do not show this section for SimpleAssets or native AtomicAssets cards.
- If the bridge date is unavailable or invalid, show the bridge mint without inventing a date. Keep the original mint and bridge mint clearly distinct.
- Check bridged, unbridged, dated, and undated cards in tests and in the card detail view.

## Technical notes

The saved-backup line is produced by the shared supply helper, which also feeds grid tooltips, so filter it only in the detail view. The AtomicAssets response includes `minted_at_time` (milliseconds); sampled bridged cards expose this field. Use that creation date for the bridged AtomicAssets representation, **not** `transferred_at_time` (which may be a later transfer). Parse and validate it, then display a readable date without claiming it is the original SimpleAssets mint date or the time a bridge request started.
