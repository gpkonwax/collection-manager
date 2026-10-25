Use a locally bundled Archivo Black font only for bright-mode headings, so the offline download retains its typography without affecting dark mode.
Use paired locally bundled banner-title artwork for bright and dark mode so both show the same lettering without changing dark-mode body typography or background.
Use shared interactive artwork controls for NFT details and packs; handwriting is offline-only typed text in bundled styles, with no cloud or AI recognition step.
Keep original SimpleAssets pack-art source URLs separate from bundled image paths and retain AtomicAssets raw image references, so the enlarged viewer can credit provenance without mistaking a backup gateway for the source.
Resolve SimpleAssets mint numbers from the self-hosted sharded mint backup first and live AtomicHub second, so mints survive AtomicHub outages and CORS blocks while new mints still appear.
Show only the original mint number on grid ribbons; keep circulating and burned supply in tooltips and details because bridge order and surviving supply are not the original mint or total printed.
Keep default grid ordering in a shared natural-card comparator, sorting identical card copies by original mint after card ID, side, and variant so saved layouts and alternate sort modes retain their own ordering.
- Ship holders + mint backup as one session-only records ZIP (gpk-records.zip) rebuilt by the monthly holders and incremental mint workflows (kept apart so slow AtomicHub lookups never break the holders run); a loaded ZIP is read before network mirrors.
- Discover freshly minted SimpleAssets cards in the mint refresh from Hyperion `simpleassets::createlog` (author filtered client-side) behind a saved timestamp bookmark, so new pack openings get mints between monthly holder scans; history outages must warn and keep the old bookmark, never fail the run.
- Resolve pack-history replay mint labels by original asset identity through the grid's mint presentation and saved SA resolver, never by bridge order or card title, so replay stays accurate when cards leave a wallet.
- Treat AtomicAssets minted_at_time as the creation date of a bridged copy, separately from transferredAt and the original SimpleAssets mint, so card details never report a later transfer as the bridge date.
- Store pack-opening provenance (opener, mint time, pack, bridger) in its own sharded manifests/provenance store, separate from mint shards, filled by a resumable one-time backfill workflow and extended by the twice-daily mint workflow only for finished phases; history listings must come from a full-history node and empty transaction replies count as failures, so years of openings are never silently skipped.
- SA/AA history live on `sa-history`/`aa-history` branches (by-asset shards; loaded ZIP first, raw GitHub next, AA live AtomicHub merged last); resumable scans, refresh after initial backfill. AA openings use minter+schema rules shared by script and app. Prices only from settlements.
- Show 1985 retro scans only through src/lib/retroScans.ts (base Series 1/2, unambiguous geepeekay files only, data mirror retro/ first then geepeekay), behind a session-only switch offered when exactly Base is filtered, so missing or ambiguous scans fall back to NFT artwork.
- Keep card-detail explorer destinations source-aware (AtomicHub for AtomicAssets IDs, WAX Explorer for SimpleAssets IDs), and route external links through the existing warning so unindexed SimpleAssets never lead to missing AtomicHub asset pages.
- Fetch record files (mint shards, provenance, transfers, holders) only from a loaded records ZIP and raw GitHub, never the data mirror or image mirrors, because neither carries them and 404 probes delay mint numbers.
- Resolve Lovable-hosted detail logo pointers against the published asset host, because GitHub Pages cannot serve root-relative /__l5e/assets-v1/ paths.
- Keep the card-detail AtomicAssets badge as a bare wordmark with a navy-lettered twin for bright mode, because white letters vanish on the light panel once the navy circle backing is gone.

## Bridge & transfers
- Submit message and fee actions together through the wallet executor for atomic payment; keep legacy-token history readable.
- Login pack fans reuse shared pack metadata and mirror-aware media, keeping artwork consistent with the catalog.
- Gate collection selection by view mode and clear pending selections/dialogs on entering Binder, so actions from another view cannot leak into its browsing-only layout.
- Native AtomicAssets detail supply comes from template /stats (assets includes burns; circulating = assets minus burned), cached per template; bridged cards retain the SimpleAssets resolver so original and bridged counts never mix.
- See src/components/simpleassets/AGENTS.md for bridge, transfer, history rules.
- Use savedLayoutStacks helpers for comma-joined stacks and unstacking; read rendered grid columns for neighbours to avoid row wrapping and preserve exports.
- Card-detail neighbour navigation uses rendered [data-detail-cell] rects (src/lib/gridNeighbour.ts) to follow any layout.
- Run checks with `bunx vitest run` (two projects: app in jsdom, scripts in node), never plain `bun test`, because Bun's runner lacks the jsdom setup and reports false failures.
- Load rarely used windows through src/components/LazyWindows.tsx (fetched on first open, then kept mounted), because it trims the first page load without changing window state between openings.
