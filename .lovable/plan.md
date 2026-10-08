# Clarify the favourites backup popup

## Current behaviour (verified)

When you star an account, `addFavorite()` in `src/lib/favoriteAccounts.ts` saves it to the favourites list **first**, and only then fires the event that opens the "Back up your favourites" popup (`src/components/FavoritesExportReminder.tsx`). The account is already in your list — the popup is only a once-per-session reminder that favourites live in this browser's storage and can be exported as a backup file. No re-import is ever required; the exported file is just a safety copy.

The confusion comes from the popup's wording, which doesn't say the account was already added.

## What you will see

The popup is reworded so it's unmistakable that the account is already saved:

- Title stays "Back up your favourites".
- First line becomes: "**[account]** has been added to your favourites." (the account name is passed through the existing event detail, which already carries it).
- The backup explanation follows: favourites are stored only in this browser, so export a JSON copy if you want to keep them safe across devices or browser clears.
- Buttons unchanged: "Got it" and "Export now" (export remains optional).

No behaviour changes — the account is added instantly either way, the popup still shows only once per session, and export still downloads the same file.

## How it works (technical)

- `src/components/FavoritesExportReminder.tsx`: read `detail.account` from the `FAVORITES_CHANGED_EVENT` (already dispatched by `notifyChanged('added', account)`), store it in state, and render it in the dialog copy.
- `src/test/favorites-reminder.test.tsx`: update the copy assertions and add a check that the starred account name appears in the popup.

## Verification

- Typecheck + build clean.
- Reminder tests pass, including the new account-name assertion.
- Manual check: star an account, confirm the popup says it was added and the account appears in the Favourites list immediately without any import.
