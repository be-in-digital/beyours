import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    /**
     * 15s, for the same reason `packages/admin` needed one.
     *
     * Nothing here is slow on its own: 68 files and 1 652 tests measure 15.9s
     * wall on an idle machine, of which the tests themselves are 3.9s and
     * collection is 15.3s. But `pnpm test` fans the whole monorepo out at once,
     * and under that contention a suite that runs in well under a second alone
     * can cross the 5s default and fail as a timeout —
     * `profileProvisioning.test.ts` (40 tests, 540ms of test time) did exactly
     * that, red in the full run and green in 406ms on its own.
     *
     * A timeout that fires on machine load is worse than no timeout: it reports
     * a broken assertion where there is none, and it reddens `main` for whoever
     * pushed next. 15s is far above anything in this package and still catches a
     * real hang.
     */
    testTimeout: 15_000,
  },
})
