import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // The convex-test suites compile the whole `convex/` module graph on their
    // first call, and with seventeen files sharing the machine that first call
    // can take well past the 5s default — the suite then reports a timeout as
    // a failed authorisation check. The tests themselves run in milliseconds
    // once the graph is warm; this ceiling is for the cold start, not for them.
    testTimeout: 30_000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Playwright owns the *.spec.ts files under e2e/. The *.test.ts files
      // there are Vitest suites (Deliveroo scenarios) and must stay visible:
      // excluding all of e2e/ hid them from both runners.
      '**/e2e/**/*.spec.ts',
      '**/e2e/**/*.setup.ts',
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
})
