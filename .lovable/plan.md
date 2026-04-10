

## Prompt User for Filename on JSON Export

### What changes
Replace the current auto-download behavior in `handleExportLayout` with a browser `prompt()` dialog that lets the user choose the filename before saving. The default suggestion will be `gpk-layout-{accountName}.json`.

### Implementation

**`src/pages/Index.tsx`** — Modify `handleExportLayout` (lines 467-486):

1. Before creating the blob, show `window.prompt("Enter filename for your layout:", \`gpk-layout-${accountName}.json\`)`.
2. If the user cancels (returns `null`), abort the export.
3. If the user provides a name, ensure it ends with `.json` (append if missing).
4. Use the user-provided filename in `a.download` instead of the hardcoded one.

### Files touched
- `src/pages/Index.tsx` — ~5 lines changed in `handleExportLayout`

