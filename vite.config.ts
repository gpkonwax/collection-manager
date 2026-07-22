import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const isOfflineBundle = process.env.VITE_OFFLINE_BUNDLE === '1';

// Offline bundle uses relative asset URLs so index.html works from file:// as
// well as from any static server. GitHub Pages needs the /collection-manager/
// prefix. Everything else (dev, Lovable preview) stays at root.
const base = isOfflineBundle ? './' : isGitHubPages ? '/collection-manager/' : '/';

export default defineConfig(({ mode }) => ({
  base,
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
