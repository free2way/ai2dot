import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL("./src/test/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    exclude: ["extension/**", "node_modules/**", ".next/**", "desktop/.runtime/**", "desktop/release/**"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
