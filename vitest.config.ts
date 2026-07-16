import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.{ts,tsx,mjs}",
    ],
    // Script tests spawn HTTP servers and hit the network stack; give them more room.
    testTimeout: 15000,
    // Scripts tests need Node, not jsdom
    environmentMatchGlobs: [["scripts/**", "node"]],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
