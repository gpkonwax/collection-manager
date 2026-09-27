# Favourite accounts with JSON export/import

Goal: let you star WAX accounts (collections you like, past trading partners) and keep them in a personal list inside the View Wallet popover. The list can be exported as a JSON file and imported again exactly like the existing alerts / layout / puzzle / pack-history files.

## What you will see

1. **A new "Favourites" section in the View Wallet popover** (next to Top holders and Active traders):
   - Shows your starred accounts, most recently added first.
   - Clicking an account fills the input box, same as the other lists.
   - Each row has a small star button to remove it, plus a filter field when the list is long.

2. **Star buttons where accounts appear**:
   - Next to each account in the Top holders and Active traders lists — click to star/unstar.
   - A star button beside the account input, so you can star the account you are currently viewing (or any typed name after it validates).

3. **Export via the JSON menu**: a new "Export favourites" item downloads `gpk-favorite-accounts.json`.

4. **Import via the JSON menu**: dropping the file into "Import file(s)…" recognises it automatically (same as the other JSON types), merges it with your existing favourites (no duplicates), and shows it in the Recent imports list with its own badge. Bulk drop fully supported: you can select or drop a favourites file together with alerts, layout, puzzle, and pack-history files in one big multi-file load — each file is detected and routed by its type, and the per-file result summary lists what was added from each.

## How it works (technical)

- New `src/lib/favoriteAccounts.ts`:
  - Stores favourites in `localStorage` under `gpk:favorite-accounts` — an array of `{ account, addedAt, note? }`, validated against WAX naming rules, capped at a sensible limit (e.g. 200).
  - Export envelope: `{ type: 'gpk-favorite-accounts', version: 1, exportedAt, accounts: [...] }`.
  - Import parser: accepts the envelope, validates each account name, merges by account name (existing entries keep their original `addedAt`), returns `{ added, updated, skipped }` counts like the alerts importer.

- `src/lib/jsonRouter.ts`:
  - New `favorites` kind: `detectKind` recognises `type === 'gpk-favorite-accounts'` with an `accounts` array.
  - New `onFavorites` router handler + result summary, label "Favourites", and a badge colour in the Recent imports list.

- `src/components/JsonMenu.tsx`: "Export favourites" menu item (disabled with count 0), wired to a new `onExportFavorites` prop.

- `src/components/ViewWalletControl.tsx`:
  - New collapsible "Favourites" section rendered above the other lists, with filter input and per-row star/remove buttons.
  - Star toggle buttons added to holder rows, active-trader rows, and beside the account input.
  - Favourites state lives in the component, synced to localStorage through the lib; a small custom event keeps multiple open instances in sync.

- `src/App.tsx` (or wherever JSON import handlers live): add the `onFavorites` handler to the router handlers and pass `onExportFavorites` + favourites count into `JsonMenu`.

- Works in the offline bundle too (pure localStorage, no network).

## Verification

- Typecheck + build clean.
- Unit test for the lib: star/unstar, dedupe on import, invalid names skipped, export envelope round-trips through `parseAndDetect`.
- Render test: popover shows the Favourites section, starring an account adds it, clicking a favourite fills the input.
- Manual check in preview: export the file, clear favourites, re-import via the JSON menu, confirm the list is restored and appears in Recent imports.
