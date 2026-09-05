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
  },
})
