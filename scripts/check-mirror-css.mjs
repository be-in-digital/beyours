#!/usr/bin/env node
/**
 * Builds `apps/themes`'s stylesheet twice — once here, once in the layout a
 * client actually gets — and fails if the two differ.
 *
 * WHY THIS EXISTS. `apps/themes/app/globals.css` reaches the engine packages
 * through `@source` globs, because Tailwind v4 auto-detects the app's own files
 * and nothing else. Those globs were written relative to the MONOREPO root:
 *
 *     @source "../../../packages/ui/src/**\/*.{ts,tsx}"
 *
 * `scripts/publish-mirror.mjs` ships that file verbatim to
 * `beyours-boilerplate`, where `apps/themes` IS the repository root — so the
 * glob resolved above the root, matched nothing, and Tailwind said nothing,
 * because a source glob that hits no files is not an error. Measured at
 * Tailwind 4.2.2: 3102 rules here, 2526 in a client clone. The 576 missing
 * rules were every class used only inside `packages/ui` or `packages/admin` —
 * `max-h-[60vh]` on the promotion form, `min-h-[50vh]` on the store guard,
 * `text-muted-foreground/30`, `fill-orange-500`. An unbounded dialog with its
 * submit button off screen, on every site we had sold.
 *
 * That had happened once before and been fixed once before. It came back
 * because NOTHING BUILT THE PUBLISHED TREE. CI builds `apps/themes` in the
 * monorepo, where the paths resolve; the mirror is pushed without ever being
 * compiled. This check closes that gap, and it is the only thing standing
 * between a third occurrence and a client.
 *
 * HOW. `lib/mirror-tree.mjs` — the module the publisher itself copies with —
 * materialises the shippable cut into a temporary directory. Its
 * `node_modules` is then assembled the way a client's `pnpm install` leaves it:
 * every ordinary dependency symlinked to the one `apps/themes` already
 * resolved, and every `@be-in-digital/*` package rebuilt from the files its
 * `files` field actually PUBLISHES. That second half matters — dropping `src`
 * from `packages/ui`'s `files` would break client stylesheets exactly as badly
 * as a wrong path, and would be just as invisible here.
 *
 * Both builds use the Tailwind resolved by `apps/themes`, so the only variable
 * left is the layout. (The mirror's own lockfile is generated fresh at sync
 * time and floats within `^4.2.2` — clients are on 4.3.x while this repo pins
 * 4.2.2 — which changes how many rules a given class set produces. Comparing
 * one version against the other would measure Tailwind, not us.)
 *
 * Usage:  node scripts/check-mirror-css.mjs   (also: pnpm check:mirror-css)
 *         --keep   leave the temporary tree in place for inspection
 */

import { createRequire } from "node:module"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { materializeMirror } from "./lib/mirror-tree.mjs"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const THEMES = join(ROOT, "apps/themes")
const PACKAGES = join(ROOT, "packages")
const ENTRY = "app/globals.css"
const keep = process.argv.includes("--keep")

const log = (msg) => console.log(msg)

/**
 * Reported, then unwound — never `process.exit`.
 *
 * `process.exit` does not run pending `finally` blocks, so exiting from inside
 * the `try` below left the materialised tree behind: 13 MB per invocation, on
 * every run of a check meant to run on every pull request.
 */
class CheckFailure extends Error {}
/** Thrown to leave the comparison early when everything agrees. */
class Done extends Error {}
const fail = (msg) => {
  throw new CheckFailure(msg)
}

// ---------------------------------------------------------------------------
// 1. A client-shaped node_modules
// ---------------------------------------------------------------------------

/**
 * What `pnpm install` leaves a client with, without the network.
 *
 * Ordinary dependencies are the same packages at the same versions on both
 * sides, so they are symlinked to the ones `apps/themes` already has. The
 * engine packages are not: on the mirror they arrive from the registry as
 * tarballs, holding only what `files` publishes. Rebuilding them from that
 * list is what makes this check able to see a `files` regression.
 */
function installClientModules(mirror) {
  const source = join(THEMES, "node_modules")
  if (!existsSync(source)) {
    fail(`${source} is missing — run \`pnpm install\` before this check.`)
  }

  const target = join(mirror, "node_modules")
  mkdirSync(target, { recursive: true })
  for (const entry of readdirSync(source)) {
    if (entry === "@be-in-digital") continue
    symlinkSync(join(source, entry), join(target, entry))
  }

  const pkg = JSON.parse(readFileSync(join(THEMES, "package.json"), "utf8"))
  const engine = Object.keys(pkg.dependencies ?? {}).filter((d) => d.startsWith("@be-in-digital/"))
  if (engine.length === 0) fail("apps/themes declares no @be-in-digital dependency — that cannot be right.")

  mkdirSync(join(target, "@be-in-digital"), { recursive: true })
  for (const dep of engine) {
    const name = dep.slice("@be-in-digital/".length)
    const from = join(PACKAGES, name)
    if (!existsSync(from)) fail(`${dep} is a dependency of apps/themes but packages/${name} does not exist.`)

    const to = join(target, dep)
    mkdirSync(to, { recursive: true })
    copyFileSync(join(from, "package.json"), join(to, "package.json"))

    // `files` is what the registry tarball contains, and therefore all a client
    // has. Anything outside it does not exist on a client site.
    const { files = [] } = JSON.parse(readFileSync(join(to, "package.json"), "utf8"))
    for (const published of files) {
      const src = join(from, published)
      // `dist` is absent until the package is built; a client always has it,
      // but no Tailwind source lives there, so its absence is not this check's
      // business.
      if (existsSync(src)) symlinkSync(src, join(to, published))
    }
  }
  return engine
}

// ---------------------------------------------------------------------------
// 2. The two builds
// ---------------------------------------------------------------------------

const require_ = createRequire(join(THEMES, "package.json"))
const tailwindEntry = require_.resolve("@tailwindcss/postcss")
const tailwindRequire = createRequire(tailwindEntry)
const postcss = (await import(pathToFileURL(tailwindRequire.resolve("postcss")))).default
const tailwindcss = (await import(pathToFileURL(tailwindEntry))).default
const tailwindVersion = JSON.parse(
  readFileSync(tailwindRequire.resolve("tailwindcss/package.json"), "utf8")
).version

/**
 * Compile `<root>/app/globals.css` as `next build` would from `<root>`.
 *
 * `base` is what the plugin otherwise takes from `process.cwd()`, and it is the
 * root of Tailwind's automatic source detection. Passing it explicitly is what
 * lets one process build two trees; getting it wrong makes both builds scan the
 * same directory and agree for the wrong reason.
 */
async function buildStylesheet(root) {
  const from = join(root, ENTRY)
  const result = await postcss([tailwindcss({ base: root })]).process(readFileSync(from, "utf8"), {
    from,
    to: join(root, "app/out.css"),
  })
  const selectors = new Set()
  let rules = 0
  postcss.parse(result.css).walkRules((rule) => {
    rules += 1
    for (const selector of rule.selectors) selectors.add(selector.trim())
  })
  return { bytes: Buffer.byteLength(result.css), rules, selectors }
}

/**
 * Every path a stylesheet in the shipped tree asks the build to go and find,
 * with what it resolves to and whether a client could reach it.
 *
 * Tailwind resolves a relative `@source` against the file that declares it, and
 * takes everything before the first wildcard as the directory to walk. A
 * directory that does not exist is not an error to Tailwind — it is simply
 * empty — which is the whole reason this defect was silent. Every `.css` file
 * is swept, not only the entry one: the next stylesheet somebody adds will be
 * written by copying this one.
 *
 * ABSOLUTE PATHS ARE UNREACHABLE EVEN WHEN THEY EXIST, and that is not a
 * pedantic point: `@source "/home/.../packages/ui/src/**\/*.{ts,tsx}"` makes
 * the two builds below agree perfectly, because they run on one machine where
 * that directory is real — and ships a client a path off their own filesystem.
 * The comparison cannot see it. This can, so it is checked separately rather
 * than inferred from the rule count.
 */
function pathInputs(root) {
  const found = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(full)
        continue
      }
      if (!entry.name.endsWith(".css")) continue
      for (const m of readFileSync(full, "utf8").matchAll(/@(source|import)\s+"([^"]+)"/g)) {
        const [, directive, target] = m
        // A bare specifier — `@import "tailwindcss"` — is resolved from
        // node_modules and travels fine.
        if (!target.startsWith(".") && !isAbsolute(target)) continue
        const literal = target.split(/[*?[{]/)[0]
        const resolved =
          directive === "source"
            ? resolve(dirname(full), literal.endsWith("/") ? literal : dirname(literal))
            : resolve(dirname(full), target)
        const outside = isAbsolute(target) || relative(root, resolved).startsWith("..")
        const why = isAbsolute(target)
          ? "is an absolute path, which means nothing on a client's filesystem"
          : outside
            ? "resolves above the repository root, where a client site has nothing"
            : "does not exist"
        found.push({ file: relative(root, full), directive, target, resolved, outside, why })
      }
    }
  }
  walk(root)
  return found
}

// ---------------------------------------------------------------------------
// 3. Coverage
// ---------------------------------------------------------------------------

/**
 * An engine package that renders markup has to be a Tailwind source.
 *
 * Comparing two builds is blind to a package no `@source` names: it contributes
 * nothing on either side, so the two agree perfectly and the classes have no
 * CSS anywhere. `apps/themes` depends on nine engine packages and two are
 * scanned; `cms`, `restaurant`, `core`, `marketing` and `integrations` are one
 * `className` away from the same silent hole, and a tenth package would arrive
 * with it built in.
 *
 * `packages/<name>/src` is read rather than the published tarball on purpose —
 * that is where a component gets written, and a package whose `files` does not
 * carry `src` is a second defect this would otherwise hide behind the first.
 */
function assertEngineCoverage(mirror, engine, sources) {
  const bare = []
  for (const dep of engine) {
    const src = join(PACKAGES, dep.slice("@be-in-digital/".length), "src")
    if (!existsSync(src)) continue

    const scanned = sources.some((s) => !relative(join(mirror, "node_modules", dep), s.resolved).startsWith(".."))
    if (scanned) continue
    if (!rendersMarkup(src)) continue
    bare.push(dep)
  }
  if (bare.length === 0) return

  for (const dep of bare) {
    console.error(`✗ ${dep} renders markup and no @source names it`)
  }
  console.error("")
  console.error(`  Its classes have no CSS in either build, so comparing the two cannot see it.`)
  console.error(`  Add to apps/themes/app/globals.css (and apps/reference's copy, which must match):`)
  for (const dep of bare) console.error(`    @source "../node_modules/${dep}/src/**/*";`)
  console.error(`  and make sure each package publishes "src" in its package.json "files".`)
  console.error("")
  fail("an engine package renders markup that no @source reaches")
}

/** Does anything under `dir` render className markup? */
function rendersMarkup(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (rendersMarkup(full)) return true
      continue
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue
    if (/className[=:\s]/.test(readFileSync(full, "utf8"))) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// 4. Compare
// ---------------------------------------------------------------------------

const work = mkdtempSync(join(tmpdir(), "beyours-mirror-css-"))
const mirror = join(work, "mirror")

try {
  log(`→ materialising the mirror tree (tailwind ${tailwindVersion})`)
  const { copied } = materializeMirror(THEMES, mirror, { prune: false })
  log(`   ${copied.length} file(s)`)

  log("→ installing a client-shaped node_modules")
  const engine = installClientModules(mirror)

  log("→ building both stylesheets")
  const monorepo = await buildStylesheet(THEMES)
  const client = await buildStylesheet(mirror)
  log(`   monorepo      ${monorepo.rules} rules, ${monorepo.bytes} bytes`)
  log(`   client clone  ${client.rules} rules, ${client.bytes} bytes`)

  const declared = pathInputs(mirror)
  assertEngineCoverage(mirror, engine, declared.filter((input) => input.directive === "source"))

  const unreachable = declared.filter((input) => input.outside || !existsSync(input.resolved))
  const missing = [...monorepo.selectors].filter((s) => !client.selectors.has(s))
  const extra = [...client.selectors].filter((s) => !monorepo.selectors.has(s))

  if (client.rules === monorepo.rules && missing.length === 0 && extra.length === 0) {
    if (unreachable.length > 0) {
      // Not belt and braces. An absolute path makes the two builds agree for
      // the worst possible reason, and a glob that resolves nowhere costs no
      // rules today but is what the next edit will be copied from.
      for (const { file, directive, target, why } of unreachable) {
        console.error(`✗ ${file}: @${directive} "${target}" ${why}`)
      }
      fail("a stylesheet in the shipped tree points at something the client repository does not contain")
    }
    log(`✓ the client stylesheet matches the monorepo build — ${monorepo.rules} rules`)
    throw new Done()
  }

  console.error("")
  console.error(`✗ the stylesheet a client builds is NOT the one this monorepo builds`)
  console.error(`  monorepo      ${monorepo.rules} rules, ${monorepo.bytes} bytes`)
  console.error(`  client clone  ${client.rules} rules, ${client.bytes} bytes`)
  console.error(`  ${missing.length} selector(s) missing from the client build, ${extra.length} extra`)

  for (const { file, directive, target, resolved, why } of unreachable) {
    console.error("")
    console.error(`  ${file}:  @${directive} "${target}"`)
    console.error(`    → ${resolved}`)
    console.error(`    ${why}: apps/themes is the repository root on a client site.`)
    console.error(`    Reach the engine through node_modules/@be-in-digital/* instead — pnpm links`)
    console.error(`    that to packages/* inside this workspace, so one path works in both layouts.`)
  }

  const sample = missing.slice(0, 25)
  if (sample.length > 0) {
    console.error("")
    console.error(`  missing from the client build${missing.length > sample.length ? ` (first ${sample.length} of ${missing.length})` : ""}:`)
    for (const selector of sample) console.error(`    ${selector}`)
  }
  if (extra.length > 0) {
    console.error("")
    console.error(`  present ONLY in the client build (first ${Math.min(10, extra.length)}):`)
    for (const selector of extra.slice(0, 10)) console.error(`    ${selector}`)
  }

  console.error("")
  fail(`apps/themes/${ENTRY} does not build the same stylesheet on a client site`)
} catch (error) {
  if (error instanceof Done) {
    // The happy path, unwound so the `finally` below actually runs.
  } else if (error instanceof CheckFailure) {
    console.error(`✗ ${error.message}`)
    process.exitCode = 1
  } else {
    throw error
  }
} finally {
  if (keep) log(`  (kept: ${work})`)
  else rmSync(work, { recursive: true, force: true })
}
