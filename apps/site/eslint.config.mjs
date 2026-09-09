import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
    ".claude/skills/**",
    /*
      `tests/**` used to be ignored WHOLESALE, and so did `tests` in
      tsconfig.json — so 52 files and 799 tests were checked by neither gate.
      Confirmed by injecting `const auditProbe: number = "this is a string"`
      into a suite: `tsc` exited 0, `eslint` reported 0 errors, and `vitest`
      passed 57.

      Only the two directories that genuinely cannot be checked are ignored
      now. `tests/convex/` holds convex-test suites that rely on Vite's
      `import.meta.glob` and on the harness's own generics, neither of which
      `tsc` can model — the same exclusion `apps/reference` and `apps/themes`
      carry, and for the same stated reason. `tests/e2e/` is Playwright's,
      with its own runner and its own config.
    */
    "tests/convex/**",
    "tests/e2e/**",
  ]),
]);

export default eslintConfig;
