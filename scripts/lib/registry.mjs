/**
 * What the registry already has, and which of `packages/*` it does not.
 *
 * WHY THIS EXISTS. Two scripts have to agree on the same question — "what can
 * a client actually install?" — and used to answer it separately:
 *
 *   - `publish-mirror.mjs` pins the mirror's engine dependencies to whatever
 *     the registry reports, because only the registry says what `pnpm install`
 *     on a client site can resolve;
 *   - `publish-plan.mjs` decides whether a push to `main` will publish
 *     anything at all, which is the same comparison `changeset publish` makes
 *     and the reason `release.yml` can skip a twelve-minute E2E on the 96% of
 *     pushes that ship nothing.
 *
 * A second copy of that lookup would be a copy of the one thing the release
 * chain must not get wrong — the mirror pinning a version the gate never
 * checked. Same reason `lib/mirror-tree.mjs` is shared between the publisher
 * and the checker.
 *
 * `publishedVersion` shells out to npm and needs a token; everything below it
 * is pure and takes the lookup as an argument, so the arithmetic is testable
 * without a registry.
 */

import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

/** The repository root, resolved from this file rather than the working directory. */
export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url))

/** GitHub Packages. Private: reads need NODE_AUTH_TOKEN with `read:packages`. */
export const REGISTRY = "https://npm.pkg.github.com"

/**
 * The version the registry serves for `pkg`, or null.
 *
 * Null means "the registry does not have this package", which for a name the
 * workspace declares is the ordinary answer for a package that has never been
 * published. A caller that needs to tell that apart from an auth failure has
 * to say so itself — `publish-mirror.mjs` does, because pinning a mirror
 * dependency to nothing is fatal there and merely informative here.
 */
export function publishedVersion(pkg) {
  try {
    return (
      execFileSync("npm", ["view", pkg, "version", `--registry=${REGISTRY}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }) ?? ""
    ).trim()
  } catch {
    return null
  }
}

/**
 * Every `packages/*` that `changeset publish` would consider, newest name last.
 *
 * `private: true` is what changesets honours to mean "never published", so it
 * is what is honoured here. The three apps are excluded by living outside
 * `packages/` — and by `.changeset/config.json`'s `ignore` list, which says the
 * same thing a second time.
 */
export function publishablePackages(root = REPO_ROOT) {
  const packagesDir = join(root, "packages")
  const packages = []

  const entries = readdirSync(packagesDir, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    let manifest
    try {
      manifest = JSON.parse(readFileSync(join(packagesDir, entry.name, "package.json"), "utf8"))
    } catch {
      // A directory under `packages/` with no readable manifest is not a
      // package. Left to `pnpm install` to complain about, not to this.
      continue
    }
    if (manifest.private === true || !manifest.name || !manifest.version) continue

    // Repository-relative, so a caller can hand it straight to `git log`.
    const dir = `packages/${entry.name}`
    packages.push({ name: manifest.name, version: manifest.version, dir })
  }

  return packages
}

/**
 * Which of `packages` the registry does not already serve at that exact version.
 *
 * This is `changeset publish`'s own rule, restated: it compares each package's
 * version against the registry and pushes whatever is missing, printing
 * `already published` for the rest. So a non-empty answer here is exactly "this
 * push will publish something".
 *
 * `lookup` is injected so the comparison can be tested without a network or a
 * token. A lookup that cannot reach the registry answers null, which is not
 * equal to any version and so reports the package as one that would publish —
 * an unanswerable question gates rather than waves through, and it is what
 * `changeset publish` will then attempt on the same broken token anyway. The
 * `published` field keeps the distinction for whoever reads the log.
 */
export function unpublishedPackages(packages, lookup = publishedVersion) {
  return packages
    .map((pkg) => ({ ...pkg, published: lookup(pkg.name) }))
    .filter((pkg) => pkg.published !== pkg.version)
}
