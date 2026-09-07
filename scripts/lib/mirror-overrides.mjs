/**
 * The `pnpm.overrides` a client site installs against.
 *
 * WHY THIS EXISTS. pnpm honours `pnpm.overrides` from the WORKSPACE ROOT only.
 * Inside this repository that root is `/package.json`, so its 22 entries apply
 * to every importer, `apps/themes` included — which is why
 * `pnpm audit --prod --audit-level high` is green here.
 *
 * A client repository has a different root. `publish-mirror.mjs` copies
 * `apps/themes/package.json` onto the mirror, where it BECOMES the root, and
 * that file carried one override. `pnpm install --lockfile-only` then ran in
 * the mirror clone against 1 override instead of 22: every client site resolved
 * without the nineteen security floors this repository judged worth fixing —
 * `undici`, `dompurify`, `postcss`, `nanoid`, `qs`, `body-parser`, `sharp`,
 * `hono`, `kysely`, `fast-xml-parser`, `brace-expansion`, `picomatch`,
 * `linkify-it`, `ip-address`, `fast-uri`, `@hono/node-server`, `@babel/core`,
 * `browserslist` (#289).
 *
 * Nothing broke, which is why it went unseen for as long as it did: the mirror
 * installed, the site built, CI was green on both sides. Only the resolved
 * versions differed, and nothing compared them.
 *
 * THE ROOT WINS, and that is not a preference. Inside this workspace the root's
 * entry is what pnpm applies and the template's own block is inert wherever the
 * two name the same key. Making the root win on the mirror is therefore the
 * only rule under which the mirror resolves what this repository resolves —
 * which is the whole invariant. A key the root does not name is the template's
 * alone and is carried through untouched.
 *
 * WHAT IS DELIBERATELY NOT CARRIED:
 *
 *   - `pnpm.auditConfig.ignoreGhsas`. It silences GHSA-qq9h-g4jm-xgf3 here on
 *     an assessment of THIS repository's auth configuration (see
 *     security.yml). Carrying it would silence the same advisory in a client's
 *     repository without the client ever seeing it. A floor protects them; a
 *     suppression only protects our own CI from going red.
 *   - `pnpm.onlyBuiltDependencies`. It is an allow-list of packages permitted
 *     to run install scripts — arbitrary code on a client's machine — so
 *     widening it automatically is the wrong default. The two lists are
 *     identical today and `divergentBuildAllowList` below fails the sync if
 *     they ever stop being, so the drift cannot be silent even though the
 *     carrying is not automatic.
 *
 * Everything here is pure: `publish-mirror.mjs` supplies the files. It also
 * imports no third-party module, deliberately — the mirror job runs
 * `pnpm/action-setup` and `setup-node` and never `pnpm install`, so it has no
 * `node_modules` to resolve one from.
 */

/** `pnpm.overrides` from a parsed manifest, always an object. */
const overridesOf = (manifest) => manifest?.pnpm?.overrides ?? {}

/**
 * The overrides block the mirror's root `package.json` should carry.
 *
 * @returns {{
 *   overrides: Record<string, string>,
 *   carried: string[],
 *   overruled: Array<{ key: string, root: string, template: string }>,
 * }}
 *   `carried` are keys the template did not have — the floors that were being
 *   lost. `overruled` are keys where the two disagreed and the root won; each
 *   is a line in `apps/themes/package.json` that this workspace already
 *   ignores, so it is dead configuration worth deleting rather than an error.
 */
export function mergeOverrides(rootManifest, templateManifest) {
  const root = overridesOf(rootManifest)
  const template = overridesOf(templateManifest)

  const carried = []
  const overruled = []

  for (const [key, value] of Object.entries(root)) {
    if (!(key in template)) {
      carried.push(key)
      continue
    }
    if (template[key] !== value) overruled.push({ key, root: value, template: template[key] })
  }

  return { overrides: { ...template, ...root }, carried, overruled }
}

/**
 * Where the two `onlyBuiltDependencies` lists disagree, in both directions.
 *
 * Not merged, on purpose — see the header. Reported so that a package gaining
 * the right to run install scripts here cannot quietly fail to gain it on a
 * client site, or the reverse.
 *
 * @returns {{ rootOnly: string[], templateOnly: string[] }}
 */
export function divergentBuildAllowList(rootManifest, templateManifest) {
  const root = new Set(rootManifest?.pnpm?.onlyBuiltDependencies ?? [])
  const template = new Set(templateManifest?.pnpm?.onlyBuiltDependencies ?? [])

  return {
    rootOnly: [...root].filter((name) => !template.has(name)).sort(),
    templateOnly: [...template].filter((name) => !root.has(name)).sort(),
  }
}

/**
 * The `overrides:` map pnpm recorded at the top of a lockfile.
 *
 * pnpm writes the root's `pnpm.overrides` into the lockfile verbatim, whether
 * or not each entry matches anything in the tree — the root lockfile lists all
 * 22 while only 20 resolve. So this is the lockfile saying which override block
 * it was generated from, which is exactly the claim worth checking after
 * `pnpm install --lockfile-only` runs in the mirror clone.
 *
 * Hand-rolled rather than parsed as YAML because this module may not import a
 * third-party package (see the header). The shape it has to read is narrow: a
 * top-level `overrides:` key, then two-space-indented `key: value` pairs.
 * Both halves may be single-quoted — pnpm quotes a key starting with `@` — and
 * a key may itself contain spaces and colons (`brace-expansion@>=3.0.0 <5.0.9`),
 * so the split is on the LAST `": "` in the line.
 */
export function parseLockfileOverrides(lockfile) {
  const lines = lockfile.split(/\r?\n/)
  const start = lines.findIndex((line) => line === "overrides:")
  if (start === -1) return {}

  const unquote = (value) => value.replace(/^(['"])([\s\S]*)\1$/, "$2")
  const parsed = {}

  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") continue
    if (!line.startsWith("  ")) break

    const entry = /^ {2}(.*):[ \t]+(\S.*)$/.exec(line)
    if (!entry) continue
    parsed[unquote(entry[1].trim())] = unquote(entry[2].trim())
  }

  return parsed
}

/**
 * Which of the overrides the mirror was written with did not reach its lockfile.
 *
 * The gap #289 describes is silent by construction — a mirror resolved against
 * the wrong override set installs and builds exactly the same. This is the
 * comparison nothing was making.
 *
 * @returns {Array<{ key: string, expected: string, actual: string | null }>}
 */
export function missingFromLockfile(expected, lockfileOverrides) {
  return Object.entries(expected)
    .filter(([key, value]) => lockfileOverrides[key] !== value)
    .map(([key, value]) => ({ key, expected: value, actual: lockfileOverrides[key] ?? null }))
}

/** The failure message for a mirror lockfile that did not take the overrides. */
export function describeMissing(missing) {
  const lines = [
    `${missing.length} override(s) did not reach the mirror's lockfile.`,
    "",
    "The mirror's root package.json was written with them, so pnpm either did",
    "not read the file this script wrote or rewrote the block. A client site",
    "installing from that lockfile resolves without these floors — which is",
    "#289, and it is silent: the mirror still installs and still builds.",
    "",
  ]

  for (const entry of missing) {
    const actual = entry.actual ?? "nothing"
    lines.push(`  ${entry.key}  expected ${entry.expected}, lockfile has ${actual}`)
  }

  return lines.join("\n")
}
