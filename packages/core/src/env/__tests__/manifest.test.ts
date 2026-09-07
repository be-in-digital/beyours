import { describe, it, expect } from 'vitest'
import {
  envManifest,
  optionalSiteVars,
  UNGROUPED_OPTIONAL_VARS,
} from '../manifest'
import {
  packageEnvSchema,
  siteEnvRequiredSchema,
  siteEnvOptionalSchema,
  SITE_FEATURE_GROUPS,
} from '../schemas'

/**
 * The manifest exists so `apps/themes/scripts/env.mjs` — and the boilerplate
 * generator, and `.env.example` — stop restating the variable lists by hand.
 * That only helps if the manifest itself cannot drift from the schemas, which
 * is what this file is for.
 *
 * The failure it guards against is not cosmetic. `env.mjs` carried its own
 * `CONVEX_KEYS` under "keep them in sync when the engine is updated"; nobody
 * did, and eleven keys that `convex/*.ts` reads from `process.env` were absent
 * from it. A key missing there is a Convex function reading `undefined` in
 * production — silent, and only visible when a customer's email does not send.
 */

const knownNames = new Set([
  ...Object.keys(packageEnvSchema.shape),
  ...Object.keys(siteEnvRequiredSchema.shape),
  ...Object.keys(siteEnvOptionalSchema.shape),
])

describe('envManifest.required', () => {
  it('is exactly what the two schemas refuse to boot without', () => {
    // Derived, not retyped — so this asserts the derivation, not a copy of it.
    // The site tier is required by construction; the package tier contributes
    // whatever is not wrapped in `opt()`.
    const packageRequired = Object.entries(packageEnvSchema.shape)
      .filter(([, field]) => !field.safeParse(undefined).success)
      .map(([name]) => name)

    expect(envManifest.required).toEqual([
      ...packageRequired,
      ...Object.keys(siteEnvRequiredSchema.shape),
    ])
  })

  it('names every variable CLAUDE.md tells an operator a deployment needs', () => {
    // Pinned by name rather than by count. The doc and the schema have gone
    // out of step before — four variables were documented for months that no
    // code reads at all.
    for (const name of [
      'NEXT_PUBLIC_CONVEX_URL',
      'CONVEX_SITE_URL',
      'SITE_URL',
      'BETTER_AUTH_SECRET',
      'ENCRYPTION_KEY',
      'AWS_REGION',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_S3_BUCKET_NAME',
      'AWS_SES_FROM_EMAIL',
      'OPENAI_API_KEY',
    ]) {
      expect(envManifest.required).toContain(name)
    }
  })

  it('never lists a required variable in a group as well', () => {
    // A wizard walks `required` first and then the groups. A name in both gets
    // asked for twice, and the second answer silently wins.
    const grouped = new Set(envManifest.groups.flatMap((g) => [...g.vars]))
    const both = envManifest.required.filter((name) => grouped.has(name))
    expect(both).toEqual([])
  })
})

describe('envManifest.groups', () => {
  it('names only variables one of the schemas declares', () => {
    const unknown = envManifest.groups
      .flatMap((g) => [...g.vars])
      .filter((name) => !knownNames.has(name))
    expect(unknown).toEqual([])
  })

  it('leaves no optional variable invisible to a setup wizard', () => {
    // Every optional site variable is either offered in a group or explicitly
    // named as one the wizard should not ask about. Adding one to the schema
    // and nowhere else fails here rather than quietly becoming unreachable.
    const grouped = new Set(envManifest.groups.flatMap((g) => [...g.vars]))
    const ungrouped = new Set(UNGROUPED_OPTIONAL_VARS)
    const orphans = optionalSiteVars.filter(
      (name) => !grouped.has(name) && !ungrouped.has(name)
    )
    expect(orphans).toEqual([])
  })

  it('does not list a variable in two groups', () => {
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    for (const group of envManifest.groups) {
      for (const name of group.vars) {
        if (seen.has(name)) duplicates.push(`${name} (${seen.get(name)} + ${group.feature})`)
        seen.set(name, group.feature)
      }
    }
    expect(duplicates).toEqual([])
  })

  it('carries every all-or-nothing rule the schema enforces', () => {
    // The rule lives in `siteEnvOptionalSchema.superRefine`; a wizard that did
    // not know about it would happily collect half a payment provider and let
    // the deploy fail at boot instead.
    const declared = new Set(
      envManifest.groups.flatMap((g) => [...g.requiredTogether])
    )
    const enforced = SITE_FEATURE_GROUPS.flatMap((g) => [...g.vars])
    for (const name of enforced) {
      expect(declared).toContain(name)
    }
  })

  it('marks a variable as required-together only when the schema says so', () => {
    // The other direction, and the one that matters for Stripe:
    // STRIPE_PUBLISHABLE_KEY sits in the group because a wizard should offer
    // it, and NOT in requiredTogether because no line of the product reads it.
    // Claiming otherwise would gate a deploy on a value nothing consumes.
    const enforced = new Set(SITE_FEATURE_GROUPS.flatMap((g) => [...g.vars]))
    const overclaimed = envManifest.groups
      .flatMap((g) => [...g.requiredTogether])
      .filter((name) => !enforced.has(name))
    expect(overclaimed).toEqual([])

    const stripe = envManifest.groups.find((g) => g.feature.startsWith('Stripe'))
    expect(stripe?.vars).toContain('STRIPE_PUBLISHABLE_KEY')
    expect(stripe?.requiredTogether).not.toContain('STRIPE_PUBLISHABLE_KEY')
  })
})

describe('envManifest.convexKeys', () => {
  it('names only variables one of the schemas declares', () => {
    // A key here that no schema knows about is a typo that `pnpm env:sync`
    // would push as an empty value, or silently skip.
    const unknown = envManifest.convexKeys.filter((name) => !knownNames.has(name))
    expect(unknown).toEqual([])
  })

  it('carries the eleven keys env.mjs was missing', () => {
    // The measured drift that prompted #37's second point. Named individually
    // so a future edit that drops one fails with the name in the message.
    for (const name of [
      'AWS_S3_PUBLIC_BASE_URL',
      'EMAIL_API_SECRET',
      'ADMIN_BOOTSTRAP_TOKEN',
      'AUTH_ALLOW_UNVERIFIED_EMAIL',
      'NEXT_PUBLIC_APP_URL',
      'STRIPE_BID_SECRET_KEY',
      'STRIPE_BID_WEBHOOK_SECRET',
      'STRIPE_BID_PRICE_MAINTENANCE',
      'BID_APP_URL',
      'BID_NOTIFY_EMAIL',
      'UBER_DIRECT_WEBHOOK_SECRET',
    ]) {
      expect(envManifest.convexKeys).toContain(name)
    }
  })

  it('does not ask Convex for a variable only the browser reads', () => {
    // NEXT_PUBLIC_* is inlined into the client bundle at build time. Pushing
    // one to the Convex deployment configures nothing and invites the reader
    // to think a Convex function consumes it. NEXT_PUBLIC_APP_URL is the one
    // exception, and it is deliberate: convex/*.ts reads it to build the links
    // it puts in outgoing email, where there is no browser to inline anything.
    const publicKeys = envManifest.convexKeys.filter((n) => n.startsWith('NEXT_PUBLIC_'))
    expect(publicKeys).toEqual(['NEXT_PUBLIC_APP_URL'])
  })

  it('lists no key twice', () => {
    expect(new Set(envManifest.convexKeys).size).toBe(envManifest.convexKeys.length)
  })
})
