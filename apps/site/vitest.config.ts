import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json. Two things need it, and both
    // were untestable without it: `lib/payment-providers.ts`, which decides
    // whether the checkout quotes VAT, and anything under `components/` that
    // imports "@/convex/..." — which is how the pricing page's « À venir »
    // badge and the checkout guard behind it went untested together for as
    // long as they disagreed.
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  /* The automatic JSX runtime. `tests/error-boundaries.test.tsx` renders the
     five `error.tsx` files to static markup to prove each one is wired to the
     reporter; without this esbuild emits `React.createElement` into modules
     that never import React. */
  esbuild: { jsx: "automatic" },
  test: {
    environment: "edge-runtime",
    // convex-test compiles the whole `convex/` module graph on the first call
    // in a file, which on a cold, contended machine runs past the 5s default
    // and reports as a timed-out affiliate flow. The tests are milliseconds
    // once the graph is warm.
    testTimeout: 30_000,
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
