import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The gpt-translation suites exercise the retry path, and the backoff
    // between attempts is a real `setTimeout` inside `translateText` — the
    // mocked HTTP client resolves instantly, so the whole wait is production
    // code sleeping. `batchTranslate > should handle partial failures` burns
    // three of those sleeps and measures 3.0s on a warm dev machine, against
    // the 5s default. That headroom does not survive a two-core CI runner, and
    // the failure it produces is a timeout reported as a broken translation
    // assertion. `aws/__tests__/ses.test.ts` hit the same wall and answered it
    // per-test; this is the same answer one level up, so the next retry suite
    // added here inherits it.
    testTimeout: 15_000,
  },
})
