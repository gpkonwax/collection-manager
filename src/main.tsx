import './polyfills';
import { createRoot } from "react-dom/client";
import { del as idbDel } from 'idb-keyval';
import App from "./App.tsx";
import "./index.css";

// One-time cleanup of legacy offline-backup persistence. Persisting the ~4 GB
// ZIPs to IndexedDB proved unreliable across browsers (QuotaExceededError), so
// the feature was removed — users now load the ZIPs per session on demand.
// Reclaim any storage a previous version may have written.
try {
  idbDel('gpk-local-mirror-v1').catch(() => { /* noop */ });
} catch { /* IDB unavailable */ }
try {
  localStorage.removeItem('gpk-local-mirror-persist');
} catch { /* noop */ }

createRoot(document.getElementById("root")!).render(<App />);
