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
 * How a registry lookup ended.
 *
 * `absent` and `unreachable` were one answer — `null` — and the two mean
 * opposite things. Measured without a token: `npm view` answered `E401` for all
 * ten packages, `publishedVersion` returned `null` for all ten, and
 * `publish-plan` printed `WILL PUBLISH (registry has nothing)` for nine
 * packages the registry serves. Every one of those lines was false, and the
 * table was the only thing anyone reads before believing the plan.
 *
 * The DECISION is unchanged and stays fail-safe: an unanswerable question still
 * reports the package as one that would publish, because that is what
 * `changeset publish` will then attempt on the same broken token. What changes
 * is that the log no longer states a fact about the registry that nobody asked
 * it.
 */
export const FOUND = "found"
/** The registry answered, and has no such package. `npm view` says `E404`. */
export const ABSENT = "absent"
/** The question was not answered: no token, a refused token, a network fault. */
export const UNREACHABLE = "unreachable"

/**
 * npm's own error code for a lookup that failed, or null when it printed none.
 *
 * `npm view` writes `npm error code E404` on the first line of stderr and the
 * human sentence after it. The code is the part worth reading: the sentence is
 * localised and reworded between majors, the code is not.
 */
function npmErrorCode(stderr) {
  const match = /npm (?:ERR!|error) code (\S+)/.exec(stderr ?? "")
  return match ? match[1] : null
}

/**
 * What that code means about the registry.
 *
 * `E404` is the registry answering: it does not have this package, which for a
 * name this workspace declares is the ordinary state of one never published.
 * `E401`, `E403` and `ENEEDAUTH` are the registry refusing to say — GitHub
 * Packages is private, so a missing or expired `NODE_AUTH_TOKEN` produces
 * exactly these — and every network fault is the same class of non-answer.
 * Anything unrecognised is treated as a non-answer too: guessing `absent` from
 * a code nobody has read is how a 401 became a 404 in the first place.
 */
export function classifyLookupError(code) {
  return code === "E404" ? ABSENT : UNREACHABLE
}

/**
 * What the registry serves for `pkg`, and whether it answered at all.
 *
 * `{ version, state, code }` — `version` is null unless `state` is `found`,
 * and `code` carries npm's own error code so a log can name it.
 */
export function lookupPublished(pkg) {
  try {
    const out = execFileSync("npm", ["view", pkg, "version", `--registry=${REGISTRY}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    const version = (out ?? "").trim()
    // An empty stdout with exit 0 is not a version. It has no documented
    // cause and is not worth inventing one for; what it is not is an answer.
    return version
      ? { version, state: FOUND, code: null }
      : { version: null, state: UNREACHABLE, code: null }
  } catch (error) {
    const code = npmErrorCode(error?.stderr?.toString?.() ?? String(error?.stderr ?? ""))
    return { version: null, state: classifyLookupError(code), code }
  }
}

/**
 * The version the registry serves for `pkg`, or null.
 *
 * Kept for callers that only need the version and treat every non-answer the
 * same — `publish-mirror.mjs` pins a dependency or fails, and either error is
 * fatal there. Anything that PRINTS the outcome should call `lookupPublished`
 * instead and say which of the two it got.
 */
export function publishedVersion(pkg) {
  return lookupPublished(pkg).version
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
 * One lookup answer, however the caller's `lookup` chose to phrase it.
 *
 * `lookupPublished` returns `{ version, state, code }`; the tests inject a
 * plain `name => version | null`, which is the shape `publishedVersion` had
 * and the shape anyone writing a stub reaches for. A bare `null` from such a
 * stub means "not published" — it is a fixture, not a registry, and it has no
 * network to fail on.
 */
function normaliseLookup(answer) {
  if (answer && typeof answer === "object") {
    return { version: answer.version ?? null, state: answer.state ?? UNREACHABLE, code: answer.code ?? null }
  }
  return { version: answer ?? null, state: answer ? FOUND : ABSENT, code: null }
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
 * `changeset publish` will then attempt on the same broken token anyway.
 *
 * `published` keeps the version for whoever reads the log and `state` keeps
 * WHY it is null. Those were one field, and a caller printing "registry has
 * nothing" from `published === null` was stating the registry's answer when
 * the registry had refused to give one.
 */
/**
 * @param {Array<{ name: string, version: string, dir: string }>} packages
 * @param {(name: string) => (string | null | { version: string | null, state?: string, code?: string | null })} [lookup]
 */
export function unpublishedPackages(packages, lookup = lookupPublished) {
  return packages
    .map((pkg) => {
      const { version, state, code } = normaliseLookup(lookup(pkg.name))
      return { ...pkg, published: version, publishedState: state, lookupCode: code }
    })
    .filter((pkg) => pkg.published !== pkg.version)
}

/** True when any row's version could not be read at all. */
export function anyUnreachable(rows) {
  return rows.some((row) => row.publishedState === UNREACHABLE)
}
