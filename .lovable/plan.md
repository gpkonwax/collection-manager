# Clear button for the View Wallet favourites list

## What you will see

In the View Wallet popover, the Favourites button row becomes three buttons:

```text
[ Export ] [ Import ] [ Clear ]
```

- **Clear** is greyed out when the list is empty (same as Export).
- Clicking Clear opens a confirmation dialog *before* anything is deleted:
  - Title: "Clear all favourites?"
  - Body: explains that this removes **every** favourited account from this browser — accounts starred this session **and** accounts loaded from imported JSON files — and cannot be undone; suggests pressing Export first if a backup is wanted.
  - Buttons: **Cancel** (default, Esc also cancels) and a red **Clear all**.
- Confirming empties the list everywhere at once: the popover list, the star buttons in the Top holders / Active traders rows, the header "Favourite this account" button, and the JSON menu export count — they all listen to the same favourites-changed sync already in place.
- A success toast confirms how many accounts were removed. Nothing else is touched: alerts, layouts, puzzle files, pack history and the reminder-popup state are unaffected — the Clear button only ever touches the favourites list.

## How it works (technical)

1. **`src/lib/favoriteAccounts.ts`**
   - Add `clearFavorites(): number` — captures `loadFavorites().length`, writes `[]` to `gpk:favorite-accounts`, fires the change event with type `'cleared'` (new `FavoritesChangeType` value). Returns the number removed for the toast.
2. **`src/components/ViewWalletControl.tsx`**
   - Third button in the Export/Import flex row (same h-7 ghost styling, `Trash2` icon, `text-destructive` tint, `flex-1`), disabled when `favorites.length === 0`.
   - Opens the existing `ui/alert-dialog` (`AlertDialog` / `AlertDialogContent` pattern already used by `ExternalLinkWarningDialog`): Cancel + destructive `Clear all` action calling `clearFavorites()`, then `setFavorites(loadFavorites())` and a `toast.success` with the removed count.
3. **Tests — extend `src/test/viewwallet-favorites.test.tsx`**
   - Clear button is disabled when the list is empty.
   - With favourites saved: click Clear → dialog appears → Cancel keeps the list intact.
   - Confirm Clear all → `loadFavorites()` is empty, the success toast fired with the right count, and the popover list shows the empty-state hint.

## Verification

- Full test suite green, `bunx tsgo --noEmit -p tsconfig.app.json` clean, preview build clean.
- Manual check in preview: save a favourite + import a JSON, open View Wallet → Favourites → Clear → confirm → list empties; cancel path changes nothing.
