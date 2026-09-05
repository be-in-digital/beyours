import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json. Without it nothing under
    // `lib/` that imports through the alias — payment-providers.ts, which
    // decides whether the checkout quotes VAT — can be loaded by a test at
    // all, so the module that renders the total was untestable.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "edge-runtime",
    // convex-test compiles the whole `convex/` module graph on the first call
    // in a file, which on a cold, contended machine runs past the 5s default
    // and reports as a timed-out affiliate flow. The tests are milliseconds
    // once the graph is warm.
    testTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
  },
});
