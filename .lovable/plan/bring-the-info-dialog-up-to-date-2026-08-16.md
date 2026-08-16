# Bring the Info dialog up to date

The Info dialog (header ⓘ button) still describes the app as it was several releases ago. It has no mention of trading, pack history/replay, the puzzle expansion, retro view, pack info popups, data mirror, or the bright theme. This updates the content only — no layout or behaviour changes.

## New sections to add

**🔄 Card & Pack Trading (P2P)**
- Propose card-for-card or pack-for-pack trades directly with any WAX account.
- Protocol-locked: AtomicAssets trades AtomicAssets, SimpleAssets trades SimpleAssets — never mixed.
- AtomicAssets uses the official atomicassets offer system; SimpleAssets uses an `eosio.msig` multisig swap so both sides execute in one atomic transaction — no escrow, no custom contract, nobody can take a card and walk.
- Consistent wording throughout: left side is **You send**, right side is **They send back**.
- Trade composer has the same filtering as the homepage — series, variant (including Packs), sort and search — plus mint-number ribbon, card ID, variant and series on every card.
- Trades dialog merges both protocols into Received / Sent tabs, with protocol badges, stale-offer flags, and accept / decline / cancel / counter.
- A green number badge on the Trades header button counts unread incoming offers from both protocols.

**🕰️ Pack Opening History & Replay**
- Rebuild every pack you have ever opened straight from the WAX chain — pack type, date, transaction, and full contents.
- Gallery overview groups by pack type in the same natural order as the homepage; click a pack to drill into every individual opening.
- Download your history as JSON and load it back any time; a Clear button removes stale files.
- History is stored in IndexedDB, and a warning tells you when openings have been recorded since your last download.
- **Replay** any opening through the full reveal and card-deal animation, with the reveal order shuffled so it feels different every time.
- Thumbnails are cached locally and served mirror-first for fast reopening.

## Sections to revise

**🛡️ Built-in Resistance** — add the **Data mirror** layer (Cloudflare-hosted backup of puzzle scans, pack art and the holders manifest, with geepeekay.com as fallback). Drop "coming soon" from the offline app bundle line since it ships now.

**📦 Pack Openings** — note that Mittens, GameStonk and the Mega/token packs are supported now, and add hover **pack info popups** showing original Topps spec sheets (price, print run, contents, odds) plus variant descriptions in the filter dropdown.

**🧩 Puzzle Builder** — retitle from "Series 2 Puzzle Builder" to cover the added Series 2 (2nd/3rd printing), Series 3, 4 and 5 puzzles; mention the always-visible reference picture and that pieces stay locked until Scramble is pressed.

**👁️ Collection Views** — mention the **Retro (1985 scan)** colour-grade toggle for Series 1 & 2, and that Series 2 SimpleAssets cards now show their real mint number in the top ribbon.

**🎛️ Flexibility** — add the **holders dropdown** in View Wallet (top-to-bottom largest holders) and the **Bright** theme skin alongside Dark Cheese.

**📂 Import / Export** — add pack history JSON to the list of exportable files.

**🤝 Community** — add the footer Donate option (WAX, $CHEESE or packs).

## Technical notes

All changes are inside the Info dialog JSX block in `src/pages/Index.tsx` (roughly lines 2504–2636). Same markup patterns (`<h4 className="font-semibold text-cheese ...">` + bulleted `<ul>`) so styling and both themes stay consistent. No other files touched.
