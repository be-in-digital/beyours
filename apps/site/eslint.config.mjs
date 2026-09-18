import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
/*
  By RELATIVE PATH, not by package specifier, and the difference is the point.

  `apps/themes` imports this rule as `@be-yours/convex-functions/eslint/
  convex-auth` because it is cloned into a standalone repository per client,
  where a path out of the workspace resolves to nothing. `apps/site` is never
  cloned — it is the commercial site, it lives only here, and it deliberately
  depends on NONE of the engine packages (see CLAUDE.md). A devDependency on
  one of them to reach a lint rule would put the private registry between this
  app and `pnpm lint`, and would make that statement false for the sake of a
  file with no imports in it.
*/
import convexAuth from "../../packages/convex-functions/eslint/convex-auth.mjs";

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
  {
    /*
      The authorisation seam, on the app it was never applied to.

      This config imported the two Next presets and nothing else, so the rule
      that makes a Convex wrapper say how it is protected — `query`, `mutation`,
      `action`, `httpAction` — never looked at `apps/site/convex/` at all: 68
      publicly callable functions, unlinted, on the backend that holds the
      affiliate ledger, the contract signatures, the founders' offer and the
      internal ops console.

      `convex/*.ts` only: `convex/lib/` holds the guards themselves, `email/`
      and `fonts/` hold no wrappers, and `_generated/` is machine-written.
    */
    files: ["convex/*.ts"],
    plugins: { convex: convexAuth },
    rules: {
      "convex/no-unguarded-convex-function": "error",
      "convex/require-convex-permission": "error",
    },
  },
]);

export default eslintConfig;
