import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    /**
     * jsdom, not node.
     *
     * Most suites here read source from disk and need no DOM. The sidebar does:
     * the defect this package shipped — a nav entry offered to a role the
     * server refuses — is only fully proved by rendering the sidebar for that
     * role and finding the link absent. Under `environment: 'node'` that test
     * cannot exist, so the rule was asserted and the component that applies it
     * was not.
     */
    environment: 'jsdom',
    /**
     * 30s, because this package's cost is jsdom and jsdom's cost is not the
     * assertion.
     *
     * Three runs of the same tree failed 8 tests, then 2 different tests, then
     * 0 — every failure `Test timed out in 5000ms`, not one an assertion. That
     * is the signature of a suite racing a wall clock, and it reddens `main`
     * for whoever pushed next rather than for whoever broke something.
     *
     * Measured on an idle machine: 37 files, 622 tests, 28.7s wall — of which
     * 37.0s is `environment`, roughly a second per file just to construct a
     * DOM, on top of 19.2s of collection. The tests themselves are 12.5s. So
     * most of what a test here waits for is work that happens before it runs
     * and that scales with how busy the machine is, and the 5s default leaves
     * the render suites almost no headroom: `app-sidebar-render.test.tsx`
     * measures 6.5s for ten tests alone and 21.2s in a loaded full run.
     *
     * The same reasoning `apps/themes` wrote down for convex-test's cold start
     * (60s there), sized for what this package actually pays for. 30s still
     * catches a genuine hang — nothing here legitimately takes seconds — and no
     * longer turns a busy runner into a red build.
     */
    testTimeout: 30_000,
  },
})
