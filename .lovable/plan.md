

## Fix: Persist Card Order Across Series Switches

### Problem
Two issues are causing the order to revert when switching series:

1. **Missing dependency**: The save-to-localStorage effect (line 400) is missing `variantFilter` in its dependency array, so changes made under a specific variant may save to the wrong key.

2. **No in-memory fallback**: The load effect (line 457) reads only from localStorage. If a user drags cards around but the save hasn't committed yet (or if they want a purely session-based workflow), switching categories can lose unsaved state.

### Fix — `src/pages/Index.tsx`

1. **Add `variantFilter` to save effect dependencies** (line 400) — ensures the order is saved under the correct key.

2. **Add a session-level in-memory order cache** (`useRef<Map<string, string[]>>`) that stores every custom order by its storage key. This cache:
   - Gets written to whenever `customOrder` changes (alongside the localStorage write)
   - Gets checked first in `loadOrder` before falling back to localStorage
   - Survives category/variant switches within the session
   - Gets included in the JSON export alongside localStorage orders

This way, a user can reorder Series 1, switch to Series 2, reorder that, switch back — all orders stay in memory. When they hit "Save Layout", the export includes all session orders.

### Specific changes

- Add `const sessionOrders = useRef(new Map<string, string[]>())` near line 389
- In the save effect (line 395-400): also write to `sessionOrders.current.set(key, customOrder)` and add `variantFilter` to deps
- In `loadOrder` (line 373-387): check `sessionOrders.current.get(key)` before `localStorage.getItem(key)`
- In `handleExportLayout` (line 481-505): merge session orders into the export alongside localStorage orders

