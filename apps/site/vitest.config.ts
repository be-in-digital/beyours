import { defineConfig } from "vitest/config";

export default defineConfig({
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
