

## Per-Category Saved Collections

### Overview
Make each category have its own independent saved collection layout, so users can build and maintain separate arrangements for Series 1, Series 2, Tiger King, etc. Each category stores its own layout in localStorage and can have its own imported/exported JSON file.

### How It Works

**Storage key change**: Instead of a single `gpk-saved-layout-{account}`, use `gpk-saved-layout-{account}-{category}`. When the user switches categories while on the Saved Collection tab, the current category's layout loads automatically.

**State becomes category-aware**: The single `savedOrder` / `loadedLayoutName` state pair will be keyed by `categoryFilter`. When category changes, persist the current layout and load the new category's layout from localStorage.

### Technical Details

**Single file: `src/pages/Index.tsx`**

1. **Change localStorage key** to include category: `gpk-saved-layout-${accountName}-${categoryFilter}`

2. **Swap layout on category change**: Add an effect that saves the current `savedOrder` for the previous category and loads the new category's layout when `categoryFilter` changes.

3. **Update export/import**: 
   - Export filename default: `gpk-layout-${accountName}-${categoryFilter}.json`
   - JSON payload includes `category` field
   - Import works the same but stores to the current category's key

4. **"Copy to Saved" scopes to current category**: Already uses `filtered` which is category-filtered, so this works as-is.

5. **Initial state**: Read from `gpk-saved-layout-${accountName}-${categoryFilter}` on mount.

6. **"All Categories" saved view**: Will have its own independent layout (key uses `all`), allowing a master arrangement if desired.

