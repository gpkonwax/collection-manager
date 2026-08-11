# Pack History: group by pack type first

## What changes

After loading a pack history JSON, the dialog opens on a **pack-type gallery** instead of a long list of individual openings.

- Each distinct pack (e.g. "GPK Series 1 Mega", "Exotic Mega") appears once as a large pack-art tile.
- Underneath each tile: the pack name and the count of openings found (e.g. "4 packs opened").
- Clicking a tile drills into the existing detailed list, filtered to that pack type only — same rows, thumbnails, +N expander, Replay button and Transaction link as today.
- A "Back to all packs" button at the top of the drill-in view returns to the gallery.

Tiles are sorted by count (most opened first), then by name. Search and the contract dropdown keep working: in gallery view they narrow which tiles appear and the counts shown; inside a pack they narrow the rows.

## Behaviour details

- Grouping key: pack name + contract (SimpleAssets vs AtomicAssets), so an SA and AA pack with the same name stay separate tiles.
- Tile art uses the pack image from the most recent opening in that group; falls back to the current box emoji placeholder if none.
- Most recent opening date shown as small secondary text on the tile.
- Clearing history, or a filter that empties the group, returns to the gallery.
- Empty state and all toolbar buttons (Download, Load, Clear) are unchanged.

## Technical notes

All work is confined to `src/components/simpleassets/PackHistoryDialog.tsx`:

- Add `const [activeGroup, setActiveGroup] = useState<string | null>(null)`.
- Derive `groups` with `useMemo` over `filtered`: `Map<key, { key, packName, source, packImage, count, latestAt, entries }>` keyed by `${source}::${packName}`.
- Render gallery grid (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3`) when `activeGroup === null`; otherwise render the existing row list over `groups.get(activeGroup).entries`.
- Reset `activeGroup` to `null` on dialog open, on account/refresh reload, on clear, and when the active group no longer exists in `groups`.
- Existing `expanded` set, `IpfsMedia mirrorFirst` thumbnails, replay and explorer logic are reused unchanged.
