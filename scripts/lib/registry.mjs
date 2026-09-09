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
  return lookupPublishedVersion(pkg).version
}

/**
 * The same lookup, with the distinction `publishedVersion` throws away.
 *
 * `npm view` fails for two unrelated reasons and the wrapper above returns
 * `null` for both: the registry answering "no such package", and the registry
 * not answering at all — no token, no network, a 500. A caller that treats the
 * second as the first reports a clean bill of health for a check it never ran,
 * which is the failure this repository keeps having to fix (see the
 * `EXPORTS_UNKNOWN` note in `engine-exports.mjs`, written after exactly that).
 *
 * `known: false` means the question got no answer. Refuse, or say so; never
 * pass.
 */
export function lookupPublishedVersion(pkg, { ask = askRegistry } = {}) {
  let answer
  try {
    answer = { stdout: ask(pkg) }
  } catch (error) {
    answer = { failure: `${error?.stderr ?? ""}\n${error?.stdout ?? ""}` }
  }
  return classifyLookup(answer)
}

/** The one call that touches the network. Replaced in tests. */
function askRegistry(pkg) {
  return execFileSync("npm", ["view", pkg, "version", `--registry=${REGISTRY}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

/**
 * What npm's answer means, as a pure function of its output.
 *
 * Separated from the call so it can be tested without a registry. The first
 * version of the test asked npm for a name nobody has published and asserted
 * the 404; run alone it passed, and inside a full `pnpm test` it failed after
 * 140 seconds because a loaded runner got a timeout rather than a 404. A guard
 * about "did the registry answer" must not itself depend on the registry
 * answering.
 */
export function classifyLookup(answer) {
  if (answer.failure === undefined) {
    const version = (answer.stdout ?? "").trim()
    return { version: version || null, known: true }
  }
  // A 404 IS an answer: the registry has no such package. Everything else —
  // ENEEDAUTH, E401, E403, a socket error, a timeout — is the registry
  // declining to say, and must never read as "nothing to check".
  if (/\bE404\b|404 Not Found/.test(answer.failure)) return { version: null, known: true }
  const reason = answer.failure.split("\n").map((line) => line.trim()).filter(Boolean).pop()
  return { version: null, known: false, reason: reason ?? "npm view failed" }
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
