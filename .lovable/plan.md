## Goal

Correctly relabel template `51437` as the **Mitten Pack** (not Bernventures) in `useGpkAtomicPacks.ts`, while keeping it disabled for now.

## Background

On-chain verification confirmed:
- Template `48479` = Bernventures Pack (2 cards) — already correctly configured and live.
- Template `51437` = **Mitten Pack** (5 cards, "Bern 4 Golden Mittens" promo) — currently mislabeled in `PACK_CONFIG` as a 5-card Bernventures variant. Both use the `burnieunpack` contract.

The `PACK_DEFAULTS` entry and the `ATOMIC_PACK_CATEGORY_MAP` in `Index.tsx` already correctly identify `51437` as Mittens — only `PACK_CONFIG` is out of sync.

## Change

### `src/hooks/useGpkAtomicPacks.ts` — line 46

Re-add the disabled flags so the Mitten Pack stays gated while accurately labeled. The contract (`burnieunpack`) and card count (5) are already correct.

Before:
```ts
'51437':  { contract: 'burnieunpack', cards: 5, openMode: 'transfer' },
```

After:
```ts
'51437':  { contract: 'burnieunpack', cards: 5, openMode: 'transfer', disabled: true, disabledReason: 'Opening temporarily disabled' },
```

## Not changing

- The "Possibly soon: Mittens, GameStonk, and more" copy on the front page and info dropdown remains accurate — Mittens is still gated.
- Bernventures (48479) stays live for testing.
- No display-name changes needed; `PACK_DEFAULTS['51437']` already reads "Mitten Pack" so the card UI will show the correct name and image once this lands.
