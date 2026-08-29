import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // The app imports itself as `@/…`. Type-only imports erase before Vitest ever
  // resolves them, which is why this was not needed until a tested module
  // imported a *value* that way.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    globals: true,
    // The convex-test suites compile the whole `convex/` module graph on their
    // first call, and with a hundred-odd files sharing the machine that first
    // call runs well past the 5s default — the suite then reports a timeout as
    // a failed authorisation check, which is a lie about what broke. The tests
    // themselves finish in milliseconds once the graph is warm; this ceiling is
    // for the cold start. Same value, same reason, as `apps/reference`.
    testTimeout: 30_000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Playwright owns the *.spec.ts files under e2e/. The *.test.ts files
      // there are Vitest suites (the Deliveroo scenarios) and must stay
      // visible: excluding all of e2e/ hid eleven of them from both runners.
      // `reference` fixed exactly this and the fix was never carried over.
      '**/e2e/**/*.spec.ts',
      '**/e2e/**/*.setup.ts',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
})
