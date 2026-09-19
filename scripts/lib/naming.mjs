/**
 * The naming rules README.md § Naming states, made executable.
 *
 * That section is a page of identifiers that "must survive", under the heading
 * **Never run a global find-and-replace** — and nothing enforced it. The cost
 * of that gap is on the record twice in one week. The scope move was first
 * written against `beyours` and every one of its 3 041 occurrences was wrong;
 * correcting it by hand then over-reached onto the frozen domain in 27 places
 * across five mailboxes, one of them the `mentions legales` address of
 * apps/site, and under-reached on eight owner slugs. `pnpm type-check`,
 * `pnpm test` and every other `check:*` were green over all of it, because no
 * suite knows which domain we own or which organisation registered which
 * identifier.
 *
 * Three rules, each read off README's own text rather than invented here.
 */

/**
 * Identifiers registered with a system outside this repository, or persisted
 * in a browser or a deployed site. Renaming one does not relabel a thing — it
 * points at a thing that does not exist, or abandons data that does.
 *
 * Checked by PRESENCE: each must still occur SOMEWHERE in the tree. That is
 * deliberately the weaker of the two possible rules, and worth stating rather
 * than discovering. It catches the global find-and-replace the README names,
 * because a global one takes every occurrence; it does NOT catch a hand edit
 * that renames two of an identifier's three call sites. Pinning a count or a
 * file list would catch that too and would go stale on every ordinary edit,
 * and a guard people learn to override is worth less than one with a stated
 * limit. The per-line NEVER rule below is what covers partial damage.
 *
 * README.md is excluded from the count on purpose. It is where the table
 * lives, so counting it would let the documentation satisfy the rule while the
 * code it documents was swept away — the table guarding itself.
 */
export const FROZEN = [
  { id: "be-in-digital/beyours-boilerplate", why: "the mirror repository clients clone from — it lives in the agency's org" },
  { id: "TURBO_TEAM: be-in-digital", why: "the Turborepo remote-cache team slug, registered under that name" },
  { id: "--scope be-in-digital", why: "the Vercel team slug, registered under that name" },
  { id: ".beindigital-site.json", why: "the init sentinel present in every deployed site" },
  { id: "beindigital-addresses", why: "a localStorage key — renaming it wipes end customers' saved addresses" },
  { id: "beindigital-favorites", why: "a localStorage key — renaming it wipes end customers' favourites" },
  { id: "beindigital-email-tracking", why: "a Configuration Set that exists in AWS SES" },
  { id: 'integrator_brand_id: "beindigital"', why: "an identifier registered with Uber Eats" },
  { id: "utm_source=beindigital", why: "Unsplash attribution must match the registered app name" },
  { id: "com.beindigital.", why: "the bundle identifier, frozen once the app is published to the stores" },
  { id: "beindigital.fr", why: "the domain does belong to the agency" },
]

/**
 * Spellings that are never correct, whichever hand wrote them.
 *
 * `beyours.fr` is the domain and `be-yours` is the owner; the hyphen belongs
 * to one and not the other, and `be-yours.fr` is nobody's. Nothing else in CI
 * can see it — to every suite in this repository it is just a string.
 */
export const NEVER = [
  { pattern: /be-yours\.fr/, why: "the domain is `beyours.fr` — the hyphen belongs to the owner, not to the domain" },
]

/**
 * Two scopes, one hyphen apart, and the manifests are the authority.
 *
 * GitHub Packages requires the scope to be exactly the login of the owning
 * organisation, so the ten published packages are `@be-yours/*`. The apps are
 * never published, nothing forces them to match, and they do not. Reading the
 * manifests rather than grepping means a cross-wiring is caught where it would
 * actually break: `@beyours/core` names a scope no account owns and would fail
 * at `changeset publish`, after the merge.
 */
export const SCOPES = [
  { dir: "packages/", scope: "@be-yours/", why: "published to GitHub Packages, which requires the owning org's login" },
  { dir: "apps/", scope: "@beyours/", why: "never published, so nothing forces it to match the packages" },
]

/**
 * Files that quote these spellings in order to forbid them. Keep it short: a
 * file here is no longer guarded, which is right for the three that state the
 * rules and wrong for anything else.
 *
 * README.md is one of them, and it is the interesting case. It states the
 * table, so it has to be able to name a forbidden spelling in prose — and for
 * the same reason it must not COUNT as an occurrence of a frozen identifier,
 * which is what NOT_EVIDENCE says below. Exempt from the rules it declares;
 * never the evidence that they hold.
 */
export const DECLARES_THE_RULES = new Set([
  "README.md",
  "scripts/lib/naming.mjs",
  "apps/reference/__tests__/naming-guard.test.ts",
])

/** README states the rules; it must not be what satisfies them. */
export const NOT_EVIDENCE = new Set(["README.md"])

/**
 * @typedef {{ rel: string, text: string }} TextFile
 * @typedef {{ rel: string, name: string }} Manifest
 * @typedef {{ id: string, why: string }} Missing
 * @typedef {{ rel: string, line: number, text: string, why: string }} Forbidden
 * @typedef {{ rel: string, name: string, expected: string, why: string }} Miscoped
 *
 * @param {TextFile[]} files  tracked text files
 * @param {Manifest[]} manifests  workspace package.json names
 * @returns {{ missing: Missing[], forbidden: Forbidden[], miscoped: Miscoped[] }}
 */
export function checkNaming(files, manifests) {
  /** @type {Missing[]} */
  const missing = []
  for (const { id, why } of FROZEN) {
    const seen = files.filter((f) => !NOT_EVIDENCE.has(f.rel) && !DECLARES_THE_RULES.has(f.rel) && f.text.includes(id))
    if (seen.length === 0) missing.push({ id, why })
  }

  /** @type {Forbidden[]} */
  const forbidden = []
  for (const f of files) {
    if (DECLARES_THE_RULES.has(f.rel)) continue
    const lines = f.text.split("\n")
    for (let i = 0; i < lines.length; i += 1) {
      for (const rule of NEVER) {
        if (rule.pattern.test(lines[i])) {
          forbidden.push({ rel: f.rel, line: i + 1, text: lines[i].trim(), why: rule.why })
        }
      }
    }
  }

  /** @type {Miscoped[]} */
  const miscoped = []
  for (const { rel, name } of manifests) {
    if (!name.startsWith("@")) continue // an unscoped nested package is not this rule's business
    const rule = SCOPES.find((s) => rel.startsWith(s.dir))
    if (!rule) continue
    if (!name.startsWith(rule.scope)) {
      miscoped.push({ rel, name, expected: rule.scope, why: rule.why })
    }
  }

  return { missing, forbidden, miscoped }
}
