import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  /* Same "@/" root as tsconfig and Next. Without it a test cannot import
     anything under components/, because those files import "@/convex/..." —
     which is how the pricing page and the checkout guard went untested
     together for as long as they disagreed. */
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
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
