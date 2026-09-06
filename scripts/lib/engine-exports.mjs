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
 * The changeset behind `@be-in-digital/admin@9.0.0` ("Ship the gamification
 * player flow in the client template", now in `packages/admin/CHANGELOG.md`)
 * already described the window and said it "does not close on its own if the
 * release never publishes". This is the check that makes it close: a mismatch
 * stops the publish instead of reaching a client.
 *
 * Network-free on purpose — the caller fetches the published tarballs and this
 * module reads them (`exportsOfTarball`), so all of it is testable against a
 * fixture tarball, without a registry.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { gunzipSync } from "node:zlib"

const SCOPE = "@be-in-digital/"

/** Files whose imports a client's build or test run would actually resolve. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]

/** Directories that hold no source a client resolves. */
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", ".next", ".turbo", "coverage"])

/**
 * "The published `exports` could not be read at all."
 *
 * A distinct value, not `undefined`, because the two mean opposite things:
 * `undefined` is a package that genuinely declares no `exports` — Node
 * resolves it legacily and any subpath works — while this is a question that
 * got no answer. Conflating them is the defect #380 measured: GitHub Packages
 * omits `exports` from the packument `npm view` serves, every lookup came back
 * empty, and the gate read the silence as "anything resolves" while the
 * tarballs carried strict maps missing the very subpaths the template imports.
 * Not knowing is not the same as being fine: this value resolves nothing and
 * `unresolvableImports` flags it, so an unanswered lookup stops the sync.
 */
export const EXPORTS_UNKNOWN = Symbol("published exports could not be read")

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

/** A NUL-terminated string field of a tar header block. */
function tarField(header, at, length) {
  const bytes = header.subarray(at, at + length)
  const nul = bytes.indexOf(0)
  return bytes.toString("utf8", 0, nul === -1 ? length : nul)
}

/**
 * The `exports` field of the `package/package.json` inside an npm tarball —
 * the one place the registry cannot abbreviate.
 *
 * `npm view <pkg> exports` is NOT equivalent: GitHub Packages serves an
 * abbreviated packument without the field, so the lookup answers empty for
 * every engine package whatever the tarball says (#380). The tarball is the
 * artefact a client installs, so its manifest is the ground truth this whole
 * module exists to check.
 *
 * Returns the parsed `exports` value, or `undefined` when the manifest
 * genuinely declares none — the legacy shape `exportsResolve` allows. Throws
 * on anything unreadable (not gzip, no manifest inside, manifest not JSON):
 * the caller maps that to `EXPORTS_UNKNOWN`, never to "fine".
 *
 * The tar walk is deliberately minimal: 512-byte headers, an octal size, data
 * padded to the block. Entries it does not care about — pax extended headers
 * included — are skipped by size, which is all tar requires. npm writes the
 * manifest at the short, fixed path `package/package.json`, so the ustar
 * name field always carries it whole.
 */
export function exportsOfTarball(tgzPath) {
  const archive = gunzipSync(readFileSync(tgzPath))
  for (let at = 0; at + 512 <= archive.length; ) {
    const header = archive.subarray(at, at + 512)
    if (header.every((byte) => byte === 0)) break // end-of-archive marker
    const name = tarField(header, 0, 100)
    const prefix = tarField(header, 345, 155)
    const size = parseInt(tarField(header, 124, 12).trim() || "0", 8)
    at += 512
    if ((prefix ? `${prefix}/${name}` : name) === "package/package.json") {
      return JSON.parse(archive.subarray(at, at + size).toString("utf8")).exports
    }
    at += Math.ceil(size / 512) * 512
  }
  throw new Error(`${tgzPath} carries no package/package.json`)
}

/**
 * True when a package whose `exports` map is `map` resolves `subpath`.
 *
 * Three states, not two. A map (object or string) is checked; `undefined` or
 * `null` is a package that genuinely declares no `exports`, which Node
 * resolves legacily — any path allowed, nothing to verify, not a defect; and
 * `EXPORTS_UNKNOWN` is a lookup that FAILED, which resolves nothing. The
 * third used to be folded into the second, and that fold is how the gate
 * shipped `admin@8.0.0` without `./game` while reporting nothing (#380).
 *
 * Handles the one wildcard form Node supports, `"./x/*"`, which matches a
 * single `*` standing for any remaining path.
 */
export function exportsResolve(map, subpath) {
  if (map === EXPORTS_UNKNOWN) return false
  if (map === undefined || map === null) {
    // No `exports` field at all: Node falls back to legacy resolution, which
    // allows any path into the package. Unverifiable here and not a defect.
    return true
  }
  if (typeof map === "string") return subpath === "."
  const keys = Object.keys(map)
  // Node also accepts a map whose keys are all CONDITIONS rather than
  // subpaths — `{ "import": …, "require": … }` — as sugar for `{ ".": … }`.
  // (Mixing the two forms is an error Node refuses, so one non-"." key is
  // enough to tell them apart; `{}` exports nothing, not even ".".)
  if (!keys.some((key) => key.startsWith("."))) {
    return keys.length > 0 && subpath === "."
  }
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
 * @param published `pkg -> { version, exports }` as read from the registry,
 *                  where `exports` may be `EXPORTS_UNKNOWN` when the tarball
 *                  could not be fetched or read. A package missing from this
 *                  map, or one whose exports are unknown, is reported rather
 *                  than skipped: not knowing is not the same as being fine.
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
    if (entry.exports === EXPORTS_UNKNOWN) {
      // One line per package, not one per subpath: the failure is the lookup,
      // and every subpath of it is equally unverified.
      problems.push({
        pkg,
        subpath: "*",
        version: entry.version,
        reason: "exports could not be read from the published tarball",
      })
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
  const unread = (p) => p.reason === "exports could not be read from the published tarball"
  const lines = [
    "the mirror would ship imports its pinned engine versions cannot resolve:",
    "",
  ]
  for (const p of problems) {
    if (p.version === null) lines.push(`  ${p.pkg} — ${p.reason}`)
    else if (unread(p)) lines.push(`  ${p.pkg}@${p.version} — ${p.reason}`)
    else lines.push(`  ${p.pkg}@${p.version} does not export ${p.subpath}`)
  }
  if (problems.some((p) => !unread(p))) {
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
  }
  if (problems.some(unread)) {
    lines.push(
      "",
      "Where the exports could not be read, nothing above says the package is",
      "behind — it says nobody knows, and the sync refuses to run on a guess.",
      "The tarball could not be fetched or parsed: check NODE_AUTH_TOKEN",
      "(read:packages), the registry's reachability, and re-run. Do not ship",
      "on an unanswered lookup; reading silence as \"anything resolves\" is",
      "exactly how this gate was once a no-op (#380).",
    )
  }
  return lines.join("\n")
}
