import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Slowest test here measures 327ms on an idle machine — the HTML email renderer walks a full template per case.
    // Against the 5s default that is thin: a full `turbo run lint type-check
    // test` on a contended runner was measured slowing one test from 302ms to
    // past 5000ms, a ~16x factor, and packages/cms failed exactly that way.
    // A timeout is there to catch a hung test, not to police speed, and 15s
    // still catches a hang. The rule, so the next package can apply it: if the
    // slowest test leaves less than ~30x headroom, give it this ceiling.
    testTimeout: 15_000,
  },
})
