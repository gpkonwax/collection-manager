# Favourites export reminder popup

## Goal

When a user adds an account to their favourites — whether it's the very first favourite on a clean list or one more onto an already-populated list — show a one-time-per-session popup reminding them to export the list as JSON so it isn't lost (favourites live only in this browser's local storage).

## Behaviour

- Triggers on **any add**: starring from the header button, the View Wallet popover stars, or the banner — any path that calls `addFavorite` / `toggleFavorite`.
- Does **not** trigger on imports (importing means the user already has a JSON file — the reminder would be backwards) or on removals.
- Shows **once per browser session**: after the user dismisses it (or exports from it), it won't appear again until the tab/session is closed and a new one starts. Tracked via `sessionStorage`, not localStorage, so it re-arms next session.
- Popup content: short note that favourites are saved on this device only, with two buttons:
  - **Export now** — downloads `gpk-favorite-accounts-YYYYMMDD.json` immediately (same file as the JSON menu export).
  - **Got it** — dismisses.
- Works in the offline app too (pure local storage + file download, no network).

## Implementation

1. **`src/lib/favoriteAccounts.ts`**
   - `notifyChanged()` gains an optional detail payload: `addFavorite` dispatches the change event with `{ type: 'added', account }`; `removeFavorite` with `{ type: 'removed' }`; `importFavorites` with `{ type: 'imported' }` (so listeners can tell them apart).
2. **New `src/components/FavoritesExportReminder.tsx`**
   - Mounted once in `Index.tsx` (next to the other global dialogs).
   - Listens for `FAVORITES_CHANGED_EVENT`; on `{ type: 'added' }`, checks `sessionStorage` key `gpk:fav-export-reminded` — if unset, opens the dialog and sets the key.
   - Dialog (existing `ui/dialog`, cheese-yellow accent): title "Back up your favourites", body explaining the list is stored only in this browser and can be exported as JSON from the JSON menu or right here; buttons **Export now** (calls `exportFavoritesJson()` + Blob download, then closes) and **Got it**.
3. **Tests** — `src/test/favorites-reminder.test.tsx`: popup appears on first add, does not reappear on a second add in the same session, does not appear after import, "Export now" produces the envelope download.

## Verification

- New unit/render tests pass, full test suite stays green.
- Typecheck (`bunx tsgo --noEmit -p tsconfig.app.json`) clean; preview build clean.
- Manual check in preview: star an account → popup appears; star another → no popup; reload page (new session storage is per-tab, so use a fresh tab) → popup appears again on next add.
