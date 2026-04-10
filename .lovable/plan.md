

## Persist Saved Layout in localStorage

### Problem
The `savedOrder` state is a plain `useState` — it lives only in memory. Any page refresh or navigation wipes it.

### Solution
Persist the saved layout to `localStorage` keyed by account name, so it automatically restores when the user returns.

### File changes

**`src/pages/Index.tsx`**

1. **Initialize `savedOrder` from localStorage**: On mount (and when `accountName` changes), read from `localStorage` key `gpk-saved-layout-{accountName}`. If found, parse and set as initial state.

2. **Auto-save on changes**: Add a `useEffect` that writes `savedOrder` to localStorage whenever it changes (debounced or direct). Also persist `loadedLayoutName`.

3. **Clear on logout**: When `accountName` becomes null, clear the state (but keep localStorage so it restores on re-login).

### Key logic
```typescript
const STORAGE_KEY = `gpk-saved-layout-${accountName}`;

// Restore on mount
useEffect(() => {
  if (!accountName) return;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    setSavedOrder(parsed.order);
    setLoadedLayoutName(parsed.name ?? null);
  }
}, [accountName]);

// Persist on change
useEffect(() => {
  if (!accountName || savedOrder === null) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    order: savedOrder,
    name: loadedLayoutName
  }));
}, [savedOrder, loadedLayoutName, accountName]);
```

This means once you load a JSON, it stays across refreshes until you explicitly clear it or load a different one.

