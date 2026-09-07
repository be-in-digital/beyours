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
 * Two halves, because a subpath can fail in two ways. The map may not carry it
 * at all — the drift above — or the map may carry it and point at a file the
 * tarball never shipped, which resolves in the map and dies just as hard one
 * step later. That second half is not hypothetical either: `restaurant`
 * declared `./stores`, `./services` and `./hooks` while the build bundled only
 * `src/index.ts`, and `core`'s `./auth/rbac` pointed into `src/` while the
 * tarball carried only `dist/` (both in those packages' CHANGELOGs). So
 * `tarballContents` returns the archive's file list alongside the map, and
 * `unshippedTargets` checks what each declaration points at.
 *
 * Network-free on purpose — the caller fetches the published tarballs and this
 * module reads them (`tarballContents`), so all of it is testable against a
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
 * The `path` record of a pax extended header, which overrides the next entry's
 * name.
 *
 * Needed for the file list, not for the manifest: npm writes the manifest at
 * the short, fixed `package/package.json`, but node-tar switches to a pax
 * header for any path the 100-byte ustar name field cannot hold, and the
 * truncated name it leaves behind would read as a file the tarball does not
 * carry. That is a false "declared but not shipped" on a package that is
 * correctly built — the one failure mode this gate must not have.
 *
 * Records are `"<byte length> <key>=<value>\n"`, and the length counts the
 * whole record, so this walks bytes rather than characters: a non-ASCII path
 * makes the two disagree.
 */
function paxPath(block) {
  for (let at = 0; at < block.length && block[at] !== 0; ) {
    const space = block.indexOf(0x20, at)
    if (space === -1) break
    const length = Number.parseInt(block.toString("ascii", at, space), 10)
    if (!Number.isInteger(length) || length <= 0 || at + length > block.length) break
    const equals = block.indexOf(0x3d, space + 1)
    if (equals !== -1 && equals < at + length) {
      if (block.toString("ascii", space + 1, equals) === "path") {
        // -1 drops the record's trailing newline.
        return block.toString("utf8", equals + 1, at + length - 1)
      }
    }
    at += length
  }
  return null
}

/**
 * What an npm tarball carries: the `exports` map its manifest declares, and
 * the paths of every file inside it.
 *
 * `npm view <pkg> exports` is NOT equivalent: GitHub Packages serves an
 * abbreviated packument without the field, so the lookup answers empty for
 * every engine package whatever the tarball says (#380). The tarball is the
 * artefact a client installs, so its manifest is the ground truth this whole
 * module exists to check — and so is its file list, because a manifest can
 * name a file the archive does not hold.
 *
 * `files` is a Set of package-relative paths written the way `exports` targets
 * are, `./dist/index.js`, so a target is checked by a plain lookup. Entries
 * are the archive's own: npm roots everything at `package/`, that prefix is
 * stripped, and directory entries are dropped because no export target may
 * resolve to one.
 *
 * `exports` is the parsed value, or `undefined` when the manifest genuinely
 * declares none — the legacy shape `exportsResolve` allows. Throws on anything
 * unreadable (not gzip, no manifest inside, manifest not JSON): the caller
 * maps that to `EXPORTS_UNKNOWN`, never to "fine".
 *
 * The tar walk is deliberately minimal: 512-byte headers, an octal size, data
 * padded to the block. It reads the two extensions that rename an entry — pax
 * `x` (what node-tar writes past 100 bytes) and GNU `L` — because a name read
 * short would look like a missing file; everything else it does not care about
 * is skipped by size, which is all tar requires.
 */
export function tarballContents(tgzPath) {
  const archive = gunzipSync(readFileSync(tgzPath))
  const files = new Set()
  let manifest
  let renamed = null

  for (let at = 0; at + 512 <= archive.length; ) {
    const header = archive.subarray(at, at + 512)
    if (header.every((byte) => byte === 0)) break // end-of-archive marker
    const type = String.fromCharCode(header[156])
    const size = Number.parseInt(tarField(header, 124, 12).trim() || "0", 8) || 0
    const body = archive.subarray(at + 512, at + 512 + size)
    at += 512 + Math.ceil(size / 512) * 512

    // Both of these name the entry that FOLLOWS them; `g` is the global
    // variant, which names nothing.
    if (type === "x" || type === "X") {
      renamed = paxPath(body) ?? renamed
      continue
    }
    if (type === "L") {
      renamed = tarField(body, 0, body.length)
      continue
    }
    if (type === "g" || type === "K") continue

    const name = tarField(header, 0, 100)
    const prefix = tarField(header, 345, 155)
    const stored = renamed ?? (prefix ? `${prefix}/${name}` : name)
    renamed = null

    if (type === "5" || stored.endsWith("/")) continue // a directory, never a target
    if (!stored.startsWith("package/")) continue // npm roots every entry there
    const shipped = `./${stored.slice("package/".length)}`

    files.add(shipped)
    if (shipped === "./package.json") manifest = JSON.parse(body.toString("utf8"))
  }

  if (manifest === undefined) throw new Error(`${tgzPath} carries no package/package.json`)
  return { exports: manifest.exports, files }
}

/**
 * The map entry Node would pick for `subpath`, and what its `*` stood for.
 *
 * An exact key always beats a pattern; between patterns Node takes the most
 * specific, which is the longest text before the `*` and then the longest
 * after it. Picking the same one matters beyond a yes/no answer: it decides
 * which target `unshippedTargets` goes looking for, and checking a pattern
 * Node would not have used is how a correctly-built package turns red.
 *
 * Returns `{ entry, star }`, or `null` when the map does not carry it.
 */
function resolvedEntry(map, subpath) {
  if (typeof map === "string") return subpath === "." ? { entry: map, star: null } : null
  if (typeof map !== "object" || map === null) return null

  const keys = Object.keys(map)
  // Node also accepts a map whose keys are all CONDITIONS rather than
  // subpaths — `{ "import": …, "require": … }` — as sugar for `{ ".": … }`.
  // (Mixing the two forms is an error Node refuses, so one non-"." key is
  // enough to tell them apart; `{}` exports nothing, not even ".".)
  if (!keys.some((key) => key.startsWith("."))) {
    return keys.length > 0 && subpath === "." ? { entry: map, star: null } : null
  }
  if (Object.prototype.hasOwnProperty.call(map, subpath)) return { entry: map[subpath], star: null }

  let best = null
  for (const pattern of keys) {
    const star = pattern.indexOf("*")
    if (star === -1) continue
    const before = pattern.slice(0, star)
    const after = pattern.slice(star + 1)
    if (subpath.length < before.length + after.length) continue
    if (!subpath.startsWith(before) || !subpath.endsWith(after)) continue
    if (
      best === null ||
      before.length > best.before.length ||
      (before.length === best.before.length && after.length > best.after.length)
    ) {
      best = { pattern, before, after }
    }
  }
  if (best === null) return null
  return {
    entry: map[best.pattern],
    star: subpath.slice(best.before.length, subpath.length - best.after.length),
  }
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
 * This answers the map question only. A subpath the map carries can still
 * point at a file the tarball omits — see `unshippedTargets`.
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
  return resolvedEntry(map, subpath) !== null
}

/** Every string an entry can resolve to, flattening conditions and fallbacks. */
function targetLeaves(entry, out = []) {
  if (typeof entry === "string") out.push(entry)
  else if (Array.isArray(entry)) for (const alternative of entry) targetLeaves(alternative, out)
  else if (entry !== null && typeof entry === "object") {
    for (const value of Object.values(entry)) targetLeaves(value, out)
  }
  // Anything else — `null` above all, which blocks a subpath on purpose —
  // points at no file, so there is nothing to look for.
  return out
}

/** `./a/./b.js` and `./a/b.js` are the same file; the file list holds the second. */
function normalizeTarget(target) {
  const segments = target.split("/").filter((segment) => segment !== "" && segment !== ".")
  return `./${segments.join("/")}`
}

/**
 * The files a resolvable subpath points at and the tarball does not carry.
 *
 * The gap this closes: `exportsResolve` answers "is it in the map", and a
 * package can declare `"./stores": "./dist/stores.js"` while the build never
 * emits `dist/stores.js` or `files` excludes it. Resolution succeeds, the gate
 * stays green, and the client's `next build` dies one step further along —
 * `ERR_MODULE_NOT_FOUND` instead of `ERR_PACKAGE_PATH_NOT_EXPORTED`, same
 * broken delivery. Both recorded occurrences are in the CHANGELOGs of
 * `restaurant` (c1af162) and `core`.
 *
 * Three decisions, because this gate blocks the sync to the repository every
 * client clones, so a wrong red stops all delivery and is worse than a miss:
 *
 *   - CONDITIONS AND FALLBACKS. An entry can be `{ types, import, require }`,
 *     nested, or an array of alternatives. This flags a subpath only when NONE
 *     of its leaves is shipped — proof that no consumer resolves it, whichever
 *     condition its bundler activates. The strict reading, demanding every
 *     leaf, would also catch a half-built entry (`.mjs` shipped, `.d.ts` not),
 *     but it decides for the client which conditions matter, and this module
 *     cannot know that. Both recorded occurrences ship no leaf at all, so the
 *     provable rule catches the real ones. Tighten it the day a partial build
 *     actually reaches a client.
 *   - WILDCARDS. `"./aws/*": "./src/aws/*.ts"` is checked against the import
 *     that matched it, substituting the `*` exactly as Node does — every
 *     occurrence, from the pattern Node itself would have picked. So
 *     `./aws/folders` looks for `./src/aws/folders.ts` and nothing broader.
 *   - WHAT IS NOT CHECKABLE IS NOT FLAGGED. No file list, an unread map, a
 *     legacy package with no `exports`, a `null` (blocked) entry, or a target
 *     that is a bare specifier rather than a `./` path — each returns nothing.
 *     Silence here is "cannot prove it missing", never "it is fine": the map
 *     half still ran, and a lookup that failed outright is already flagged as
 *     `EXPORTS_UNKNOWN`.
 *
 * @returns the missing targets, or `[]` when there is nothing to report
 */
export function unshippedTargets(map, subpath, files) {
  if (files === undefined || files === null) return []
  if (map === EXPORTS_UNKNOWN || map === undefined || map === null) return []

  const match = resolvedEntry(map, subpath)
  if (match === null) return [] // not exported at all — the other half's problem

  const targets = targetLeaves(match.entry)
    .map((target) => (match.star === null ? target : target.replaceAll("*", match.star)))
    // A target may be a bare specifier pointing into another package, which
    // this tarball is not expected to carry.
    .filter((target) => target.startsWith("./") && !target.split("/").includes(".."))
  if (targets.length === 0) return []

  const shipped = files instanceof Set ? files : new Set(files)
  const missing = targets.filter((target) => !shipped.has(normalizeTarget(target)))
  return missing.length === targets.length ? missing : []
}

/**
 * Which imports the pinned versions cannot resolve.
 *
 * @param imports  from `engineImportsIn`
 * @param published `pkg -> { version, exports, files }` as read from the
 *                  registry, where `exports` may be `EXPORTS_UNKNOWN` when the
 *                  tarball could not be fetched or read, and `files` is the
 *                  archive's contents from the same read. A package missing
 *                  from this map, or one whose exports are unknown, is
 *                  reported rather than skipped: not knowing is not the same
 *                  as being fine.
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
        continue
      }
      const missing = unshippedTargets(entry.exports, subpath, entry.files)
      if (missing.length > 0) {
        problems.push({
          pkg,
          subpath,
          version: entry.version,
          reason: "declared but not shipped",
          targets: missing,
        })
      }
    }
  }
  return problems
}

/** The failure message, written to be actionable without opening this file. */
export function describeUnresolvable(problems) {
  const unread = (p) => p.reason === "exports could not be read from the published tarball"
  const unshipped = (p) => p.reason === "declared but not shipped"
  const behind = (p) => p.reason === "not exported by the published version" || p.version === null

  const lines = [
    "the mirror would ship imports its pinned engine versions cannot resolve:",
    "",
  ]
  for (const p of problems) {
    if (p.version === null) lines.push(`  ${p.pkg} — ${p.reason}`)
    else if (unread(p)) lines.push(`  ${p.pkg}@${p.version} — ${p.reason}`)
    else if (unshipped(p)) {
      lines.push(
        `  ${p.pkg}@${p.version} declares ${p.subpath}, but the tarball ships` +
          ` none of: ${p.targets.join(", ")}`,
      )
    } else lines.push(`  ${p.pkg}@${p.version} does not export ${p.subpath}`)
  }
  if (problems.some(behind)) {
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
  if (problems.some(unshipped)) {
    lines.push(
      "",
      "Where a subpath is declared but not shipped, the version is not behind —",
      "the BUILD is, and releasing again would publish the same hole. The tarball",
      "carries the exports map naming that file and not the file itself, so a",
      "client installs it, resolves the subpath, and dies on ERR_MODULE_NOT_FOUND.",
      "Fix it in the package: give the entry point to the build, or add the",
      "directory it lands in to `files` in that package's package.json — then",
      "release. Twice already: `restaurant` declared ./stores, ./services and",
      "./hooks while the build bundled only src/index.ts, and `core`'s",
      "./auth/rbac pointed into src/ while the tarball carried only dist/.",
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
