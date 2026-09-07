import { describe, expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"

import {
  describeMissing,
  divergentBuildAllowList,
  mergeOverrides,
  missingFromLockfile,
  parseLockfileOverrides,
} from "../../../scripts/lib/mirror-overrides.mjs"

/**
 * The security floors a client site installs against.
 *
 * pnpm honours `pnpm.overrides` from the WORKSPACE ROOT only. Here that root is
 * `/package.json`, so its 22 entries reach `apps/themes` like everything else
 * and `pnpm audit --prod --audit-level high` is green. On the mirror the copied
 * `apps/themes/package.json` IS the root, and it carried one entry — so every
 * client lockfile resolved without the other 21, and nothing compared them
 * because nothing broke: the mirror installed, the site built, CI was green on
 * both sides (#289).
 *
 * This lives in the bench, not the template: the last block reads the monorepo
 * root and would be meaningless — and red — on a client site.
 */

const REPO_ROOT = path.join(__dirname, "../../..")
const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), "utf8"))

describe("mergeOverrides", () => {
  test("carries every floor the template does not have", () => {
    const merged = mergeOverrides(
      { pnpm: { overrides: { "undici@<7.29.0": "^7.29.0", "qs@<6.15.2": "^6.15.2" } } },
      { pnpm: { overrides: { "eslint-plugin-react-hooks": "7.0.1" } } },
    )

    expect(merged.overrides).toEqual({
      "eslint-plugin-react-hooks": "7.0.1",
      "undici@<7.29.0": "^7.29.0",
      "qs@<6.15.2": "^6.15.2",
    })
    expect(merged.carried.sort()).toEqual(["qs@<6.15.2", "undici@<7.29.0"])
    expect(merged.overruled).toEqual([])
  })

  test("keeps a key only the template names", () => {
    // Nothing else supplies it. Dropping it would be the same defect in the
    // other direction.
    const merged = mergeOverrides({ pnpm: { overrides: {} } }, { pnpm: { overrides: { lodash: "4.17.21" } } })

    expect(merged.overrides).toEqual({ lodash: "4.17.21" })
    expect(merged.carried).toEqual([])
  })

  test("the root wins a disagreement, and says so", () => {
    // Not a preference: inside this workspace the root's entry is what pnpm
    // applies and the template's is inert. Any other rule would make the mirror
    // resolve something the monorepo never resolves, which is the whole bug.
    const merged = mergeOverrides(
      { pnpm: { overrides: { react: "19.2.4" } } },
      { pnpm: { overrides: { react: "19.1.0" } } },
    )

    expect(merged.overrides.react).toBe("19.2.4")
    expect(merged.overruled).toEqual([{ key: "react", root: "19.2.4", template: "19.1.0" }])
  })

  test("a manifest with no pnpm block is not a crash", () => {
    expect(mergeOverrides({}, {}).overrides).toEqual({})
    expect(mergeOverrides({ pnpm: {} }, { name: "x" }).overrides).toEqual({})
  })
})

describe("divergentBuildAllowList", () => {
  test("reports both directions", () => {
    const divergent = divergentBuildAllowList(
      { pnpm: { onlyBuiltDependencies: ["esbuild", "sharp"] } },
      { pnpm: { onlyBuiltDependencies: ["sharp", "puppeteer"] } },
    )

    expect(divergent).toEqual({ rootOnly: ["esbuild"], templateOnly: ["puppeteer"] })
  })

  test("identical lists are not divergent, whatever their order", () => {
    const divergent = divergentBuildAllowList(
      { pnpm: { onlyBuiltDependencies: ["sharp", "esbuild"] } },
      { pnpm: { onlyBuiltDependencies: ["esbuild", "sharp"] } },
    )

    expect(divergent).toEqual({ rootOnly: [], templateOnly: [] })
  })
})

describe("parseLockfileOverrides", () => {
  test("reads the block pnpm writes, quotes and all", () => {
    const parsed = parseLockfileOverrides(
      [
        "lockfileVersion: '9.0'",
        "",
        "settings:",
        "  autoInstallPeers: true",
        "",
        "overrides:",
        "  picomatch@<2.3.2: ^2.3.2",
        "  react: 19.2.4",
        // A key pnpm quotes because it starts with @, and one carrying a space
        // and two comparators. Both are in the real root lockfile, and a
        // parser that splits on the FIRST colon gets both wrong.
        "  '@hono/node-server@<1.19.15': ^1.19.15",
        "  brace-expansion@>=3.0.0 <5.0.9: ^5.0.9",
        "",
        "importers:",
        "  .:",
        "    devDependencies:",
        "      turbo:",
        "        specifier: ^2.9.3",
      ].join("\n"),
    )

    expect(parsed).toEqual({
      "picomatch@<2.3.2": "^2.3.2",
      react: "19.2.4",
      "@hono/node-server@<1.19.15": "^1.19.15",
      "brace-expansion@>=3.0.0 <5.0.9": "^5.0.9",
    })
  })

  test("stops at the end of the block rather than swallowing importers", () => {
    const parsed = parseLockfileOverrides(["overrides:", "  qs@<6.15.2: ^6.15.2", "importers:", "  .:"].join("\n"))

    expect(Object.keys(parsed)).toEqual(["qs@<6.15.2"])
  })

  test("a lockfile with no overrides is an empty map, not a throw", () => {
    expect(parseLockfileOverrides("lockfileVersion: '9.0'\n\nimporters:\n  .:\n")).toEqual({})
  })
})

describe("missingFromLockfile", () => {
  test("catches an override that never arrived, and one that arrived wrong", () => {
    const missing = missingFromLockfile(
      { "undici@<7.29.0": "^7.29.0", "qs@<6.15.2": "^6.15.2", react: "19.2.4" },
      { "qs@<6.15.2": "^6.0.0", react: "19.2.4" },
    )

    expect(missing).toEqual([
      { key: "undici@<7.29.0", expected: "^7.29.0", actual: null },
      { key: "qs@<6.15.2", expected: "^6.15.2", actual: "^6.0.0" },
    ])
    expect(describeMissing(missing)).toContain("undici@<7.29.0")
    expect(describeMissing(missing)).toContain("lockfile has nothing")
  })

  test("says nothing when the lockfile took them all", () => {
    expect(missingFromLockfile({ react: "19.2.4" }, { react: "19.2.4", extra: "1.0.0" })).toEqual([])
  })
})

/**
 * The regression itself, against the real files rather than fixtures.
 *
 * `publish-mirror.mjs` proves this at sync time, but a sync runs after the
 * merge and only when `apps/themes/**` changed. Adding a floor to the root
 * alone — which is exactly how #289 happened — touches neither, so this is the
 * check that runs on the pull request making it.
 */
describe("the root's floors reach the mirror", () => {
  const root = readJson("package.json")
  const template = readJson("apps/themes/package.json")

  test("every root override survives the merge, at the root's value", () => {
    const { overrides } = mergeOverrides(root, template)

    for (const [key, value] of Object.entries(root.pnpm.overrides)) {
      expect(overrides[key]).toBe(value)
    }
  })

  test("the two build allow-lists agree, so the sync has nothing to refuse", () => {
    // Not merged automatically — it grants the right to run install scripts on
    // a client's machine, which is a decision rather than a sync. This is the
    // assertion that keeps the decision from being skipped silently.
    expect(divergentBuildAllowList(root, template)).toEqual({ rootOnly: [], templateOnly: [] })
  })

  test("the parser round-trips the lockfile pnpm actually wrote", () => {
    // The mirror's lockfile is generated by the same pnpm from the same shape,
    // so if the parser reads this one it reads that one. Guards against a
    // lockfile format change quietly turning the sync-time assertion into a
    // no-op that passes.
    const written = parseLockfileOverrides(fs.readFileSync(path.join(REPO_ROOT, "pnpm-lock.yaml"), "utf8"))

    expect(missingFromLockfile(root.pnpm.overrides, written)).toEqual([])
  })
})
