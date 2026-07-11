Add a new section inside the existing info dialog (`?` button in the top bar) that explains the recently added "View Wallet" read-only mode using clear spot-point lists of what you can and cannot do.

### What to build

1. **New info-dialog section titled "👁️ View Any Wallet (Read-Only)"** placed near the top of the dialog, after the "No New Smart Contracts" block and before "Collection Views".

2. **Spot-point content**

   **You can:**
   - Enter any valid WAX account name and browse that wallet's collection without logging in.
   - View the Classic card grid, Collector Binder view, card detail dialogs, and pack holdings.
   - See both SimpleAssets and AtomicAssets items together.
   - Switch back to your own collection at any time with the "Return to my collection" button.

   **You cannot:**
   - See their saved layout, Puzzle Builder, or completion percentage.

3. **Visual treatment** — Match the existing dialog sections: `h4` heading with emoji + text, `ul.list-disc pl-5` bullet list, `text-foreground` body, `text-cheese` heading. Consider a small highlighted box (`rounded-lg border border-cheese/30 bg-cheese/5 p-3`) around the "read-only" summary sentence for emphasis.

### Files changed
- `src/pages/Index.tsx` — insert the new section into the info dialog JSX.

### Not in scope
- No changes to `WaxContext`, card components, or write actions.
- No new components or state management.