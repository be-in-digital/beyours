/**
 * Sandbox-vs-production resolution for the third-party integrations.
 *
 * Three variables decide whether an order, a menu push or a payment capture
 * goes to a test host or to the live one:
 *
 *   UBER_EATS_SANDBOX_MODE · DELIVEROO_IS_SANDBOX · PAYPAL_SANDBOX_MODE
 *
 * They used to be read as `site.X === "true"`, inline, in 43 places. That
 * expression has one property that makes it the wrong default: an UNSET
 * variable is `undefined`, `undefined === "true"` is `false`, and `false`
 * means PRODUCTION. A deployment that never heard of the variable pointed its
 * sandbox credentials at the live Uber Eats, the live Deliveroo and the live
 * PayPal — and nothing in the boot sequence said so.
 *
 * This module inverts that. Production is now the value you have to ask for.
 *
 *   "false"            → production
 *   "true"             → sandbox
 *   unset / '' / junk  → sandbox, with one warning per flag
 *
 * The asymmetry is deliberate. A deployment wrongly in sandbox takes no real
 * order and charges no real card; the failure is visible within minutes and
 * costs nothing to undo. A deployment wrongly in production publishes test
 * menus to a live storefront and settles real money against test credentials.
 * Only one of those two is recoverable, so only one of them can be the default.
 *
 * Being explicit is still REQUIRED: `checkSandboxFlags()` below is run by
 * `validateAllEnv()` at startup, and a deployment that configures an
 * integration without declaring its mode fails to boot. The fail-safe default
 * exists for the place that check cannot reach — the Convex deployment, which
 * carries its own env store and runs no boot validation of its own.
 *
 * Read from `process.env` rather than through `getSiteEnv()` on purpose. The
 * reader parses the WHOLE environment, so routing this through it would make
 * the sandbox decision throw on an unrelated malformed variable — inside a
 * webhook, where a throw is a lost order.
 */

/** The integrations that have a sandbox host of their own. */
export type SandboxPlatform = 'uberEats' | 'deliveroo' | 'paypal'

/** Which environment variable each platform reads. */
export const SANDBOX_FLAGS = {
  uberEats: 'UBER_EATS_SANDBOX_MODE',
  deliveroo: 'DELIVEROO_IS_SANDBOX',
  paypal: 'PAYPAL_SANDBOX_MODE',
} as const satisfies Record<SandboxPlatform, string>

/** The three variable names, as a union. */
export type SandboxFlagName = (typeof SANDBOX_FLAGS)[SandboxPlatform]

/** Flags already warned about, so a webhook loop does not flood the log. */
const warned = new Set<SandboxFlagName>()

/**
 * Is this platform talking to its sandbox?
 *
 * Production requires the exact string `"false"`. Everything else — unset, an
 * empty value from a copied template, a typo like `"False"` or `"no"` —
 * resolves to sandbox and says so once in the log.
 */
export function isSandbox(platform: SandboxPlatform): boolean {
  const flag = SANDBOX_FLAGS[platform]
  const raw = process.env[flag]?.trim()

  if (raw === 'false') return false
  if (raw === 'true') return true

  if (!warned.has(flag)) {
    warned.add(flag)
    console.warn(
      raw === undefined || raw === ''
        ? `[env] ${flag} non définie — bascule en SANDBOX par sécurité. ` +
            `Posez "false" pour passer en production.`
        : `[env] ${flag}="${raw}" n'est ni "true" ni "false" — bascule en ` +
            `SANDBOX par sécurité.`
    )
  }

  return true
}

/**
 * An integration whose mode must be declared once it is configured at all.
 *
 * The credentials live in two different tiers — the Uber Eats and Deliveroo
 * app credentials are platform-level (`packageEnvSchema`), the flags are
 * site-level — so this rule cannot be expressed as a Zod refinement on either
 * schema alone. `validateAllEnv()` holds `process.env` and applies it there.
 */
export interface SandboxFlagRule {
  /** Human name, for the boot report. */
  feature: string
  flag: SandboxFlagName
  /** Any one of these being set means the integration is in use. */
  enabledBy: readonly string[]
}

export const SANDBOX_FLAG_RULES: readonly SandboxFlagRule[] = [
  {
    feature: 'Uber Eats',
    flag: 'UBER_EATS_SANDBOX_MODE',
    enabledBy: [
      'UBER_EATS_CLIENT_ID',
      'UBER_EATS_CLIENT_SECRET',
      'UBER_EATS_WEBHOOK_SECRET',
    ],
  },
  {
    feature: 'Deliveroo',
    flag: 'DELIVEROO_IS_SANDBOX',
    // DELIVEROO_BRAND_ID / DELIVEROO_SITE_ID are deliberately absent: they are
    // e2e fixtures, a live deployment reads them off its stored connection, and
    // gating a deploy on them would fire on a machine that only runs the
    // Deliveroo scenarios. The credentials are what "Deliveroo is in use" means.
    enabledBy: [
      'DELIVEROO_CLIENT_ID',
      'DELIVEROO_CLIENT_SECRET',
      'DELIVEROO_WEBHOOK_SECRET',
    ],
  },
  {
    feature: 'PayPal',
    flag: 'PAYPAL_SANDBOX_MODE',
    enabledBy: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  },
]

/** One missing or malformed sandbox declaration. */
export interface SandboxFlagProblem {
  name: SandboxFlagName
  message: string
}

const present = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() !== ''

/**
 * Which sandbox flags a deployment owes an answer on.
 *
 * Silent while an integration is switched off entirely: demanding
 * `PAYPAL_SANDBOX_MODE` from a restaurant that does not take PayPal is noise,
 * and noise is what gets suppressed. The moment any credential of the
 * integration is set, the mode becomes required.
 */
export function checkSandboxFlags(
  source: Record<string, unknown>
): SandboxFlagProblem[] {
  const problems: SandboxFlagProblem[] = []

  for (const { feature, flag, enabledBy } of SANDBOX_FLAG_RULES) {
    const configured = enabledBy.filter((name) => present(source[name]))
    if (configured.length === 0) continue

    const raw = present(source[flag])
      ? String(source[flag]).trim()
      : undefined

    if (raw === 'true' || raw === 'false') continue

    problems.push({
      name: flag,
      message:
        raw === undefined
          ? `requise dès que ${feature} est configuré (${configured.join(', ')} ` +
            `déjà posée${configured.length === 1 ? '' : 's'}) : posez "true" ` +
            `pour le bac à sable, "false" pour la production`
          : `valeur "${raw}" invalide — attendu "true" ou "false"`,
    })
  }

  return problems
}

/** Clear the one-warning-per-flag memory (for testing only). */
export function _resetSandboxWarnings(): void {
  warned.clear()
}
