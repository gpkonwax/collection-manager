## Goal

1. Update the front-page copy and info dropdown to reflect that Crash Gordon pack openings are now live.
2. Enable the Bernventures pack-opening button so testing can begin.

## Changes

### 1. `src/hooks/useGpkAtomicPacks.ts` — enable Bernventures
Remove `disabled: true` and `disabledReason` from the two Bernventures template entries (keep Mittens `53187` disabled):
- `'48479'` (Bernventures 2-card pack) → `{ contract: 'burnieunpack', cards: 2, openMode: 'transfer' }`
- `'51437'` (Bernventures 5-card pack) → `{ contract: 'burnieunpack', cards: 5, openMode: 'transfer' }`

This will flip the `AtomicPackCard` from the "Opening Disabled" state to the live "Open Pack(s)" button automatically (it reads `pack.packConfig.disabled`).

### 2. `src/pages/Index.tsx` — info dropdown (around line 1564)
Change the supported-packs bullet so Crash Gordon and Bernventures move from "likely soon" to supported:

> Most Topps pack types supported — Series 1, Series 2, Tiger King (Exotic), Food Fight, Crash Gordon and Bernventures — with Mittens, GameStonk and more likely soon.

### 3. `src/pages/Index.tsx` — Pack Openings hero section (around lines 1729–1730)
Update the two bullets:
- **Supported now:** Series 1, Series 2, Tiger King (Exotic), all Food Fight packs, Crash Gordon, and Bernventures.
- **Possibly soon:** Mittens, GameStonk, and more.

## Notes

- No changes needed to `packOpenActions.ts` — Bernventures already routes through the default single-transfer path via `burnieunpack`.
- The Bernventures pack image / metadata entries already exist; only the disabled flags are blocking the button.
- Mittens (`53187` / `atomicpacksx`) stays disabled per the current state.
