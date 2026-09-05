/**
 * Does the tree we are about to publish actually work against the versions we
 * are about to pin?
 *
 * CI builds `apps/themes` against `packages/*` at HEAD, through the pnpm
 * workspace link. The mirror does not ship that: `publish-mirror.mjs` rewrites
 * every `workspace:^` to `^<latest published>`, read from the registry, because
 * only the registry says what a client can actually install. Nothing asserted
 * those two were the same code, and they routinely are not — a subpath added to
 * a package's `exports` without a version bump exists at HEAD and does not
 * exist in the tarball a client gets.
 *
 * Measured on this repository, 2026-09-05: every engine version was last set on
 * 2026-09-01 by #278, and `./sesSending`, `./stripeChargeRouting`,
 * `./htmlSanitize`, `./platformWebhookFailures` and `@be-in-digital/admin/game`
 * were all added on 2026-09-04. Six shipped `apps/themes` modules import them.
 * A client's `pnpm install` resolves happily and then `next build` and
 * `convex deploy` die with `ERR_PACKAGE_PATH_NOT_EXPORTED`, while all four
 * required checks are green — `check:mirror-css` included, because it symlinks
 * `packages/<name>` and so never sees the pinned version either.
 *
 * `.changeset/gamification-player-flow.md` already described the window and
 * said it "does not close on its own if the release never publishes". This is
 * the check that makes it close: a mismatch stops the publish instead of
 * reaching a client.
 *
 * Pure and network-free on purpose — the caller fetches the published `exports`
 * maps and passes them in, so all of this is testable without a registry.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const SCOPE = "@be-in-digital/"

/** Files whose imports a client's build or test run would actually resolve. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]

/** Directories that hold no source a client resolves. */
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", ".next", ".turbo", "coverage"])

/**
 * Every `@be-in-digital/*` specifier the tree imports, as `pkg -> subpaths`.
 *
 * A bare `@be-in-digital/core` records the subpath `.`, which is what an
 * `exports` map calls it.
 */
export function engineImportsIn(root) {
  const found = new Map()

  const record = (specifier) => {
    const rest = specifier.slice(SCOPE.length)
    const slash = rest.indexOf("/")
    const pkg = slash === -1 ? rest : rest.slice(0, slash)
    const subpath = slash === -1 ? "." : `.${rest.slice(slash)}`
    if (!pkg) return
    const key = SCOPE + pkg
    if (!found.has(key)) found.set(key, new Set())
    found.get(key).add(subpath)
  }

  // `from "…"`, `import("…")`, `require("…")` — one pattern, because all three
  // end in a quoted specifier and nothing else in this scope is quoted.
  const specifiers = /["'](@be-in-digital\/[^"']+)["']/g

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(join(dir, entry.name))
        continue
      }
      if (!SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue
      const source = readFileSync(join(dir, entry.name), "utf8")
      for (const match of source.matchAll(specifiers)) record(match[1])
    }
  }

  if (statSync(root).isDirectory()) walk(root)
  return found
}

/**
 * True when a package whose `exports` map is `map` resolves `subpath`.
 *
 * Handles the one wildcard form Node supports, `"./x/*"`, which matches a
 * single `*` standing for any remaining path.
 */
export function exportsResolve(map, subpath) {
  if (map === undefined || map === null) {
    // No `exports` field at all: Node falls back to legacy resolution, which
    // allows any path into the package. Unverifiable here and not a defect.
    return true
  }
  if (typeof map === "string") return subpath === "."
  if (Object.prototype.hasOwnProperty.call(map, subpath)) return true

  for (const pattern of Object.keys(map)) {
    const star = pattern.indexOf("*")
    if (star === -1) continue
    const before = pattern.slice(0, star)
    const after = pattern.slice(star + 1)
    if (
      subpath.length >= before.length + after.length &&
      subpath.startsWith(before) &&
      subpath.endsWith(after)
    ) {
      return true
    }
  }
  return false
}

/**
 * Which imports the pinned versions cannot resolve.
 *
 * @param imports  from `engineImportsIn`
 * @param published `pkg -> { version, exports }` as read from the registry.
 *                  A package missing from this map is reported rather than
 *                  skipped: not knowing is not the same as being fine.
 * @returns one entry per unresolvable import, ready to print
 */
export function unresolvableImports(imports, published) {
  const problems = []
  for (const [pkg, subpaths] of imports) {
    const entry = published[pkg]
    if (!entry) {
      problems.push({ pkg, subpath: "*", version: null, reason: "not published" })
      continue
    }
    for (const subpath of [...subpaths].sort()) {
      if (!exportsResolve(entry.exports, subpath)) {
        problems.push({
          pkg,
          subpath,
          version: entry.version,
          reason: "not exported by the published version",
        })
      }
    }
  }
  return problems
}

/** The failure message, written to be actionable without opening this file. */
export function describeUnresolvable(problems) {
  const lines = [
    "the mirror would ship imports its pinned engine versions cannot resolve:",
    "",
  ]
  for (const p of problems) {
    lines.push(
      p.version === null
        ? `  ${p.pkg} — ${p.reason}`
        : `  ${p.pkg}@${p.version} does not export ${p.subpath}`,
    )
  }
  lines.push(
    "",
    "A client would install this without complaint and then fail to build with",
    "ERR_PACKAGE_PATH_NOT_EXPORTED. It happens when a package gains an export",
    "subpath without a version bump: the workspace link CI builds against has it,",
    "the published tarball does not.",
    "",
    "Fix by releasing the engine first — add a changeset for the package above,",
    "merge it, and let Release publish — then re-run this sync. Do not work",
    "around it by removing the import; the import is correct, the mirror's",
    "dependency range is what is behind.",
  )
  return lines.join("\n")
}
