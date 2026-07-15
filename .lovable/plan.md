## Problem

In Binder view, cards you own multiple copies of aren't showing as stacked when one copy is an AtomicAsset and another is a SimpleAsset (which is exactly what happens right after opening a pack that mints atomic NFTs, when you already owned the same card as a SimpleAsset — or vice versa).

## Root cause

`binderGrid` in `src/pages/Index.tsx` (around line 892) builds two lookup maps for owned cards:

- `ownedByTemplateId` — keyed by AtomicAssets `_template_id`
- `ownedByCardKey` — keyed by `${cardid}:${side}:${variant}`

Then for each template it does:

```ts
const byTid = ownedByTemplateId.get(template.templateId);
const byKey = ownedByCardKey.get(`${template.cardid}:${template.quality}:${template.variant}`);
const owned = byTid || byKey || null;   // ← bug: first-match wins, second is dropped
```

If any atomic copy exists (`byTid` non-empty), the SimpleAsset copies in `byKey` are silently discarded — so the stack count reflects only atomic dupes, not the true total. When new atomic mints from a pack land on a card you already owned as a SimpleAsset, the SimpleAsset copies vanish from the binder stack.

## Fix

Merge the two lookups instead of picking one, and dedupe by asset id so a card that appears in both maps isn't double-counted:

```ts
const merged: SimpleAsset[] = [];
const seen = new Set<string>();
const push = (arr?: SimpleAsset[]) => {
  if (!arr) return;
  for (const a of arr) if (!seen.has(a.id)) { seen.add(a.id); merged.push(a); }
};
push(byTid);
push(byKey);
const owned = merged.length ? merged : null;
```

This preserves existing byTid-first ordering (so the primary displayed card stays the atomic one when both exist), and correctly reports `owned.length` for the stack badge and the BinderStackDialog.

No other logic changes needed — `renderBinderCard`, `stackCount={owned.length}`, and `BinderStackDialog` all already handle arbitrary-length arrays.

## Files touched

- `src/pages/Index.tsx` — replace the `byTid || byKey || null` line in the `binderGrid` useMemo with the merge above (~lines 918–922).

## Verification

1. Open the packs that just landed and confirm all previously-received duplicates now appear as stacks in binder view.
2. Confirm the number badge matches classic view's total count for that cardid/side/variant.
3. Click a stacked cell → BinderStackDialog lists both the atomic and the simpleasset copies.
4. Cards you only own one copy of still open the detail dialog directly (no accidental stack popup).
