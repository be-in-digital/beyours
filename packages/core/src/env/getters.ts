import type { ZodIssue } from 'zod'
import {
  packageEnvSchema,
  siteEnvSchema,
  siteEnvRequiredSchema,
  siteEnvOptionalSchema,
} from './schemas'
import type { PackageEnv, SiteEnv } from './schemas'

let _packageEnv: PackageEnv | null = null
let _siteEnv: SiteEnv | null = null

/**
 * Get validated BeYours platform env vars.
 * Parses on first call, then returns cached result.
 * @throws {ZodError} if required vars are missing or invalid
 */
export function getPackageEnv(): PackageEnv {
  if (!_packageEnv) {
    _packageEnv = packageEnvSchema.parse(process.env)
  }
  return _packageEnv
}

/**
 * Get validated per-restaurant site env vars.
 *
 * Reads through the lenient schema: every field comes back possibly
 * `undefined`. Whether a deployment is allowed to boot at all is decided once,
 * by `validateAllEnv()` — not here, on the hot path of a customer order.
 *
 * Parses on first call, then returns cached result.
 */
export function getSiteEnv(): SiteEnv {
  if (!_siteEnv) {
    _siteEnv = siteEnvSchema.parse(process.env)
  }
  return _siteEnv
}

/**
 * Reset cached env (for testing only).
 */
export function _resetEnvCache(): void {
  _packageEnv = null
  _siteEnv = null
}

/** Which tier a configuration problem belongs to. */
export type EnvTier = 'package' | 'site' | 'feature'

export interface EnvProblem {
  name: string
  message: string
  tier: EnvTier
}

/**
 * Zod says "Invalid input: expected string, received undefined" for a variable
 * that simply is not there. The operator reading the boot log needs the plainer
 * word, and needs it distinguished from a value that IS set but malformed.
 */
function describe(issue: ZodIssue, source: Record<string, unknown>): string {
  const name = issue.path[0]
  const raw = typeof name === 'string' ? source[name] : undefined

  if (raw === undefined || raw === '') return 'non définie'
  return issue.message
}

function collect(
  issues: readonly ZodIssue[],
  tier: EnvTier,
  source: Record<string, unknown>
): EnvProblem[] {
  return issues.map((issue) => ({
    name: issue.path.join('.') || 'unknown',
    message: describe(issue, source),
    tier,
  }))
}

/**
 * Validate every tier and return what is missing or malformed.
 * Does NOT throw — returns { ok, missing } so callers decide how to handle it.
 */
export function validateAllEnv(): { ok: boolean; missing: EnvProblem[] } {
  const source = process.env as Record<string, unknown>
  const missing: EnvProblem[] = []

  const pkg = packageEnvSchema.safeParse(source)
  if (!pkg.success) missing.push(...collect(pkg.error.issues, 'package', source))

  const required = siteEnvRequiredSchema.safeParse(source)
  if (!required.success) missing.push(...collect(required.error.issues, 'site', source))

  // Optional tier: shape errors AND the all-or-nothing feature-group rules.
  // A half-configured payment provider reports here, not as a missing var.
  const optional = siteEnvOptionalSchema.safeParse(source)
  if (!optional.success) {
    for (const issue of optional.error.issues) {
      missing.push({
        name: issue.path.join('.') || 'unknown',
        message: issue.code === 'custom' ? issue.message : describe(issue, source),
        tier: issue.code === 'custom' ? 'feature' : 'site',
      })
    }
  }

  return { ok: missing.length === 0, missing }
}

const SECTIONS: { tier: EnvTier; title: string }[] = [
  { tier: 'package', title: '── Package-level (plateforme BeYours) ──' },
  { tier: 'site', title: '── Site-level (par restaurant) ──' },
  { tier: 'feature', title: '── Fonctionnalité configurée à moitié ──' },
]

/**
 * Format the problems into a human-readable report for console output.
 */
export function formatEnvReport(missing: EnvProblem[]): string {
  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    "║        VARIABLES D'ENVIRONNEMENT À CORRIGER                  ║",
    '╚══════════════════════════════════════════════════════════════╝',
    '',
  ]

  for (const { tier, title } of SECTIONS) {
    const vars = missing.filter((m) => m.tier === tier)
    if (vars.length === 0) continue

    lines.push(`  ${title}`)
    for (const v of vars) lines.push(`    ✗ ${v.name}: ${v.message}`)
    lines.push('')
  }

  lines.push(`  Total: ${missing.length} variable(s) à corriger`)
  lines.push('  → Copiez .env.example vers .env.local et remplissez les valeurs.')
  lines.push('')

  return lines.join('\n')
}
