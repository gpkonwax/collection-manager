

## Restore Pack Donations in Donate Dialog

### Problem
The "Packs" tab in the Donate dialog only appears when you currently own packs (`amount > 0`). If you have no packs, the tab is completely hidden, making it look like the feature was removed.

### Solution
Always show both "Tokens" and "Packs" tabs regardless of whether you own packs. When you have no packs, the Packs tab will display a message like "No packs available to donate" instead of hiding entirely.

### Changes

**`src/components/wallet/DonateDialog.tsx`**
- Remove the `hasPacks` conditional from the `TabsTrigger` (line 184) so the "Packs" tab always renders
- Remove the `{hasPacks && ...}` wrapper around `TabsContent` for packs (line 226)
- Add an empty state message inside the packs scroll area when no packs are available

