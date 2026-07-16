import './polyfills';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getPersistPreference, restoreLocalMirrorFromIdb } from "./lib/localMirror";

// Best-effort restore of a previously-persisted local image mirror.
// Runs in the background; if IDB is unavailable or empty, this is a silent no-op.
if (getPersistPreference()) {
  restoreLocalMirrorFromIdb().catch((err) => {
    console.warn('[main] local mirror restore failed', err);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
