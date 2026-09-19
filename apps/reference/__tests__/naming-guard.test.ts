import { describe, expect, test } from 'vitest'

import {
  checkNaming,
  FROZEN,
  NOT_EVIDENCE,
  SCOPES,
} from '../../../scripts/lib/naming.mjs'

/**
 * The guard behind README.md § Naming.
 *
 * That section is a page of identifiers registered with AWS SES, Uber Eats,
 * Unsplash and the app stores, or living in diners' browsers, under the
 * heading **Never run a global find-and-replace** — and until this guard
 * nothing enforced a line of it. Two sweeps in one week proved the gap: the
 * scope move was first written against the wrong half of the new name, and the
 * hand-run correction then hyphenated the frozen domain in 27 places, one of
 * them the `mentions legales` address. Every other suite was green over both,
 * because none of them knows which domain we own.
 *
 * So these tests run the guard in BOTH directions. A guard only ever tested on
 * a clean tree is indistinguishable from one that returns "fine".
 */

type File = { rel: string; text: string }
type Manifest = { rel: string; name: string }

/** A tree that satisfies every rule: one occurrence of each frozen id, correct scopes. */
function cleanTree(): { files: File[]; manifests: Manifest[] } {
  return {
    files: FROZEN.map((f, i) => ({ rel: `src/frozen-${i}.ts`, text: `const x = "${f.id}"\n` })),
    manifests: [
      { rel: 'packages/core/package.json', name: '@be-yours/core' },
      { rel: 'apps/themes/package.json', name: '@beyours/themes' },
    ],
  }
}

describe('the clean tree', () => {
  test('passes every rule', () => {
    const { files, manifests } = cleanTree()
    const r = checkNaming(files, manifests)
    expect(r).toEqual({ missing: [], forbidden: [], miscoped: [] })
  })
})

describe('frozen identifiers, checked by presence', () => {
  test('each one disappearing is reported, with the reason', () => {
    for (const target of FROZEN) {
      const { files, manifests } = cleanTree()
      const swept = files.filter((f) => !f.text.includes(target.id))
      const r = checkNaming(swept, manifests)
      expect(r.missing.map((m) => m.id)).toEqual([target.id])
      expect(r.missing.map((m) => m.why)).toEqual([target.why])
    }
  })

  test('a PARTIAL sweep passes, and that is the stated limit of this rule', () => {
    // Two of three call sites renamed. The rule is "still occurs somewhere",
    // so this passes — see the FROZEN docblock for why the stronger rule was
    // not taken. The per-line NEVER rule is what covers partial damage.
    const [target, ...rest] = FROZEN
    if (!target) throw new Error('FROZEN is empty')
    const { manifests } = cleanTree()
    const files: File[] = [
      { rel: 'a.ts', text: 'swept\n' },
      { rel: 'b.ts', text: 'swept\n' },
      { rel: 'c.ts', text: `const x = "${target.id}"\n` },
      ...rest.map((f, i) => ({ rel: `keep-${i}.ts`, text: f.id })),
    ]
    expect(checkNaming(files, manifests).missing).toEqual([])
  })

  test('README alone does not satisfy the rule — the table must not guard itself', () => {
    const [readme] = [...NOT_EVIDENCE]
    if (!readme) throw new Error('NOT_EVIDENCE is empty')
    const { manifests } = cleanTree()
    const onlyDocumented: File[] = [
      { rel: readme, text: FROZEN.map((f) => f.id).join('\n') },
    ]
    const r = checkNaming(onlyDocumented, manifests)
    expect(r.missing).toHaveLength(FROZEN.length)
  })
})

describe('spellings that are never correct', () => {
  test('the hyphenated domain is caught, with file and line', () => {
    const { files, manifests } = cleanTree()
    files.push({
      rel: 'apps/site/lib/legal/company.ts',
      text: 'export const COMPANY = {\n  email: "hello@be-yours.fr",\n}\n',
    })
    const r = checkNaming(files, manifests)
    expect(r.forbidden.map((f) => `${f.rel}:${f.line}`)).toEqual([
      'apps/site/lib/legal/company.ts:2',
    ])
  })

  test('the correct domain is not caught — the rule is the hyphen, not the word', () => {
    const { files, manifests } = cleanTree()
    files.push({ rel: 'apps/site/lib/site-config.ts', text: 'export const SITE_EMAIL = "hello@beyours.fr"\n' })
    expect(checkNaming(files, manifests).forbidden).toEqual([])
  })
})

describe('the two-scope split', () => {
  test('a package under the apps scope is refused', () => {
    const { files } = cleanTree()
    const r = checkNaming(files, [{ rel: 'packages/core/package.json', name: '@beyours/core' }])
    expect(r.miscoped.map((m) => m.expected)).toEqual(['@be-yours/'])
  })

  test('an app under the packages scope is refused', () => {
    const { files } = cleanTree()
    const r = checkNaming(files, [{ rel: 'apps/themes/package.json', name: '@be-yours/themes' }])
    expect(r.miscoped.map((m) => m.expected)).toEqual(['@beyours/'])
  })

  test('an unscoped nested manifest is not this rule\'s business', () => {
    const { files } = cleanTree()
    const r = checkNaming(files, [{ rel: 'apps/themes/demos/package.json', name: 'beyours-demos' }])
    expect(r.miscoped).toEqual([])
  })

  test('both sides of the split are declared, and they differ by exactly one hyphen', () => {
    const scopes = SCOPES.map((s) => s.scope)
    expect(scopes).toEqual(['@be-yours/', '@beyours/'])
    expect(scopes.map((x) => x.replace('-', ''))).toEqual(['@beyours/', '@beyours/'])
  })
})
