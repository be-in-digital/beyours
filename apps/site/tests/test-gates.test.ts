/**
 * The tests are checked by the same gates as the code.
 *
 * THE DEFECT. `tsconfig.json` excluded `tests` and `eslint.config.mjs` ignored
 * `tests/**`, so 52 files and 799 tests were type-checked by nothing and
 * linted by nothing. Measured by injecting
 * `const auditProbe: number = "this is a string"` into a suite: `tsc` exited
 * 0, `eslint` reported 0 errors, and `vitest` passed 57. Nothing that a test
 * asserted about a type meant anything, and no product bug turned out to be
 * hiding behind the gap — the exposure was prospective, which is exactly the
 * kind that grows quietly.
 *
 * Two directories legitimately cannot be checked and are named here rather
 * than assumed: `tests/convex` (convex-test suites, which need Vite's
 * `import.meta.glob` and the harness's own generics — the same exclusion
 * `apps/reference` and `apps/themes` carry) and `tests/e2e` (Playwright's, with
 * its own runner).
 *
 * This asserts the two configs still say that, and only that. Widening either
 * one back to `tests` fails here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_ROOT = join(__dirname, "..");

/** The only directories either gate may skip inside `tests/`. */
const ALLOWED_SKIPS = ["tests/convex", "tests/e2e"];

function read(file: string): string {
  return readFileSync(join(APP_ROOT, file), "utf8");
}

describe("the type-check gate covers the test suite", () => {
  const tsconfig = read("tsconfig.json");

  it("does not exclude the whole of tests/", () => {
    // `"tests"` and `"tests/**"` as whole entries — not `"tests/convex"`,
    // which is legitimate and contains the same prefix.
    expect(tsconfig).not.toMatch(/"tests(\/\*+)?"/);
  });

  it.each(ALLOWED_SKIPS)("excludes only %s of it", (dir) => {
    expect(tsconfig).toContain(`"${dir}"`);
  });
});

describe("the lint gate covers the test suite", () => {
  const eslintConfig = read("eslint.config.mjs");

  it("does not ignore the whole of tests/", () => {
    expect(eslintConfig).not.toMatch(/"tests(\/\*+)?"/);
  });

  it.each(ALLOWED_SKIPS)("ignores only %s of it", (dir) => {
    expect(eslintConfig).toContain(`"${dir}/**"`);
  });
});
