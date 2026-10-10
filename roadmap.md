# Roadmap
- [x] Remove Binder selection and transfer/burn/bridge controls; clear selections/dialogs on entry. Six tests passed and browser UI fixture confirmed Classic → Binder → Classic resets selection (no real wallet signing required).
- [x] Native AtomicAssets detail: show live template minted/circulating/burned counts and hide bridged totals; 29 tests passed and real Crash Gordon supply verified in the detail window.
- [x] Transfer and bridge windows made as tall as the screen allows (92dvh, width unchanged); selected-card tiles doubled to 64px artwork with the original mint number on top of each card.
- [x] Bridge moved into the grid selection bar (third button, disabled with tooltip for mixed/native/over-20 selections); simple confirm window; Transfer and Bridge windows enlarged.
- [x] Bridge window card tiles use the same size and spacing as the collection grid (6 columns on wide screens) so more cards fit at once.
- [x] Enlarge bridge dialog, add Select all in both directions and front-page collection/variant filters; reset to Series 1/all variants on opening; verified with 16 tests and browser interaction (no wallet transaction signed).

- [x] Pack-opening provenance: opener, mint date and pack in card details; one-time backfill workflow + twice-daily updates; bundled in records ZIP.
- [ ] Confirm the user-started "Backfill pack provenance" workflow finishes on GitHub (blocked: external workflow completion).

- [x] In card details, hide backup-source mint line; show bridged-card bridge mint and dated bridge information beside mint information (stack on narrow screens).
- [x] Add linked Information column before mint and bridge details for NFT ID, template ID, collection and series.

- [x] Show original mint numbers on pack-history replay cards during reveal, matching the grid; never show bridge-order numbers as originals.
- [x] Favourite accounts feature: star accounts, Favourites section in View Wallet popover, JSON export/import via JSON menu with bulk multi-file drop — done 2026-09-27
- [x] Rework only bright-mode backdrop and headings; preserve dark mode, page layout, card grid and behavior.
- [x] Replace bright-mode yellow box fills with light surfaces; make the background bold spilled paint, preserving header buttons and dark mode.
- [x] Extend paint across the bright background and use the banner's exact lettering for the bright-mode title.
- [x] Give dark mode the same banner-lettered title in the existing yellow, cream, and dark brown palette.
- [x] Make bright-mode card surrounds translucent white and fill the view selector so it stands out over the paint.
- [x] Improve bright-mode readability for bridge mint badges, backup warning, grid actions, intro and bridge copy, ad link, and footer.
- [x] Enlarge pack artwork from both pack grids and multiple-pack browsers with card-style tilt, magnifier, and drawing controls.
- [x] Display pack artwork source details: original geepeekay.com credits for bundled images, IPFS path and available on-chain metadata for AtomicAssets packs.
- [x] Mint-number backup: builder script, sharded backup (bridged cards, 283,804 mints), app lookup backup-first then live, offline bundle, monthly workflow step.
- [x] Plain SimpleAssets cards in the mint backup — holders workflow indexed both bridged and unbridged assets.
- [x] Show only the mint number on card ribbons; keep supply/burn figures in tooltips and details.
- [x] In the default grid, sort duplicate cards by original mint number ascending, with unresolved copies last.
- [x] Records ZIP: download + load in Offline Backup, rebuilt and released monthly
- [x] Card details: live trading history (sales + transfers) for AtomicAssets cards
- [x] SimpleAssets ownership history: live incoming transfer + twice-daily transfer recorder
- [x] Stop requesting mint/record files from the 3 image backups (data site + raw GitHub only).
- [x] NFT detail: AtomicAssets badge uses the new white ATOMICASSETS wordmark SVG (hosted asset, GitHub-Pages-safe URL).
- [x] Favourites backup popup now states the starred account was already added — no re-import needed.

- [x] Full SimpleAssets market history: scan scripts, chained backfill workflow, sa-history branch, card details "Full on-chain history" with sales/listings/gifts/burns/bridging; checks pass.
- [ ] Start "Backfill SimpleAssets market history" on GitHub once (blocked: needs the user to start it; ~2–3 days of automatic runs).
- [ ] Collectables.io sale prices (open) and per-card price summaries (deferred to analytics page).
