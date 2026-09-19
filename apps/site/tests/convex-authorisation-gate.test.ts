/**
 * Every publicly callable Convex function on the commercial site says how it
 * is protected.
 *
 * THE DEFECT. `eslint.config.mjs` imported the two Next presets and nothing
 * else, so the rule that enforces the authorisation seam — the one
 * `apps/reference` and `apps/themes` have both run for months — never looked
 * at this app at all. Measured at `b9e20ea`: 68 `query`/`mutation`/`action`
 * wrappers plus two HTTP routes, all publicly callable, none of them required
 * to say a word about who may call them. This is the backend that holds the
 * affiliate ledger, the signed apporteur contracts, the founders' offer and
 * the internal ops console.
 *
 * Turning it on found no unguarded function — 63 of the 70 already resolved
 * the caller from the session or through `requireAdmin`, and seven are public
 * on purpose (the contact form, the waiting list, the affiliate terms, the
 * contract text, the founders counter, the code validator, the checkout return
 * page). What was missing was any of that being WRITTEN DOWN where a reviewer
 * of the next wrapper would meet it.
 *
 * It also found a hole in the rule itself. `apps/site` runs Convex Auth, whose
 * session lookup is `getAuthUserId`; the rule's signal was `/AuthUser\b/`, and
 * the word boundary does not match a name that continues into `Id`. Forty-odd
 * correctly guarded queries read as unguarded claims. Fixed in the rule.
 *
 * WHY A TEST AS WELL AS A LINT RULE. The rule only runs if the config loads
 * it, and the config not loading it is precisely the state this replaces. A
 * lint rule cannot assert its own presence.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const APP_ROOT = join(__dirname, "..");
const CONVEX_DIR = join(APP_ROOT, "convex");

describe("the lint config loads the authorisation rule", () => {
  const config = readFileSync(join(APP_ROOT, "eslint.config.mjs"), "utf8");

  it("imports the rule the engine apps run", () => {
    expect(config).toContain("convex-auth.mjs");
  });

  it("applies it to the app's own Convex wrappers", () => {
    expect(config).toContain('files: ["convex/*.ts"]');
    expect(config).toContain('"convex/no-unguarded-convex-function": "error"');
    expect(config).toContain('"convex/require-convex-permission": "error"');
  });

  it("reaches it by relative path, not by depending on an engine package", () => {
    /* `apps/site` depends on NONE of the `@be-yours/*` packages and the
       point of that is that `pnpm install` here needs no private-registry
       token. A devDependency for a lint rule would put the registry between
       this app and its own lint. `apps/themes` must do the opposite — it is
       cloned into a standalone repository where a path out of the workspace
       resolves to nothing — which is why the two configs differ here. */
    expect(config).toContain("../../packages/convex-functions/eslint/convex-auth.mjs");

    const manifest = JSON.parse(readFileSync(join(APP_ROOT, "package.json"), "utf8"));
    const declared = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];
    expect(declared.filter((name) => name.startsWith("@be-yours/"))).toEqual([]);
  });
});

/**
 * Every wrapper carries a marker, checked here as well as by the rule.
 *
 * Deliberately cruder than the rule — it counts declarations and markers
 * rather than parsing — because its job is different: the rule judges each
 * function, this notices if the rule stopped running. A file where the two
 * counts drift apart is one to look at either way.
 */
describe("every public wrapper says how it is protected", () => {
  const PUBLIC_BUILDER = /=\s*(?:query|mutation|action)\s*\(/g;
  const MARKER = /@(?:public-by-design|guarded-inline|unguarded-tracked):\s*\S/g;

  const files = readdirSync(CONVEX_DIR).filter(
    (name) => name.endsWith(".ts") && name !== "auth.config.ts"
  );

  it("is looking at the whole backend, not at nothing", () => {
    // A count that collapses means the directory moved, and a scan of an empty
    // directory finds no violations — the same green as a clean one.
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(files)("convex/%s", (name) => {
    const source = readFileSync(join(CONVEX_DIR, name), "utf8");
    const wrappers = source.match(PUBLIC_BUILDER)?.length ?? 0;
    const markers = source.match(MARKER)?.length ?? 0;

    expect(markers).toBeGreaterThanOrEqual(wrappers);
  });
});
