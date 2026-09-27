# Export/import favourites buttons inside the View Wallet popover

Goal: put the favourites export and import directly where the favourites list lives — inside the View Wallet popover — so it can be managed without opening the JSON menu.

## What you will see

In the View Wallet popover, when the **Favourites** list is expanded, a new row of two small buttons appears just under the list header (above the account rows):

- **Export** — downloads `gpk-favorite-accounts.json` (greyed out when the list is empty, same as the JSON menu item).
- **Import** — opens a file picker that accepts only a favourites JSON file; imported accounts merge in with no duplicates and the list refreshes instantly. A success message shows how many were added; a wrong file type shows a clear error.

The existing export/import in the JSON menu stays untouched — both paths write/read the same list.

## How it works (technical)

- `src/lib/favoriteAccounts.ts` already provides everything: `exportFavoritesJson()`, `parseFavoritesEnvelope()`, `importFavorites()`, and the `FAVORITES_CHANGED_EVENT` sync the popover already listens to. No lib changes needed.
- `src/components/ViewWalletControl.tsx`:
  - Add two small buttons (h-7, cheese styling matching the popover) in a flex row inside the `showFavs` block (around line 352).
  - Export: build the JSON with `exportFavoritesJson()`, download via a Blob + object URL as `gpk-favorite-accounts.json`, revoke the URL afterwards (same pattern as the existing JSON-menu exports in `src/pages/Index.tsx`).
  - Import: hidden `<input type="file" accept=".json,application/json">`; on change, read the file, `JSON.parse`, validate with `parseFavoritesEnvelope()` — if it isn't a favourites envelope, show an error toast and do nothing. Otherwise call `importFavorites(accounts)` and toast the result counts. The existing `FAVORITES_CHANGED_EVENT` listener re-loads the list, so no extra state wiring.
  - Empty-file / parse-failure guarded with try/catch and an error toast.

## Verification

- Typecheck + build clean.
- Extend `src/test/viewwallet-favorites.test.tsx`: expand Favourites, click Export (mock URL.createObjectURL) and assert the download was requested with the envelope shape; import a favourites file through the hidden input and assert the list gains the account; importing a non-favourites JSON shows an error and changes nothing.
