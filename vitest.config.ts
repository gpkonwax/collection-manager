import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Script tests spawn HTTP servers and hit the network stack; give them more room.
    testTimeout: 15000,
    // Run checks with `bunx vitest run` (or `bun run test`); plain `bun test`
    // uses Bun's own runner and reports false failures.
    projects: [
      {
        extends: true,
        test: { name: "app", environment: "jsdom", include: ["src/**/*.{test,spec}.{ts,tsx}"] },
      },
      {
        // Scripts tests need Node, not jsdom
        extends: true,
        test: { name: "scripts", environment: "node", include: ["scripts/**/*.{test,spec}.{ts,tsx,mjs}"] },
      },
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
