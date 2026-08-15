import { ZodError } from 'zod'
import { packageEnvSchema, siteEnvSchema } from './schemas'
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
 * Parses on first call, then returns cached result.
 * @throws {ZodError} if required vars are missing or invalid
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

/**
 * Validate all env vars and return a formatted report of missing/invalid ones.
 * Does NOT throw — returns { ok, missing } so callers can decide how to handle.
 */
export function validateAllEnv(): {
  ok: boolean
  missing: { name: string; message: string; tier: 'package' | 'site' }[]
} {
  const missing: { name: string; message: string; tier: 'package' | 'site' }[] = []

  const pkgResult = packageEnvSchema.safeParse(process.env)
  if (!pkgResult.success) {
    for (const issue of pkgResult.error.issues) {
      missing.push({
        name: issue.path.join('.') || 'unknown',
        message: issue.message,
        tier: 'package',
      })
    }
  }

  const siteResult = siteEnvSchema.safeParse(process.env)
  if (!siteResult.success) {
    for (const issue of siteResult.error.issues) {
      missing.push({
        name: issue.path.join('.') || 'unknown',
        message: issue.message,
        tier: 'site',
      })
    }
  }

  return { ok: missing.length === 0, missing }
}

/**
 * Format missing env vars into a human-readable report for console output.
 */
export function formatEnvReport(
  missing: { name: string; message: string; tier: 'package' | 'site' }[]
): string {
  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    '║         VARIABLES D\'ENVIRONNEMENT MANQUANTES               ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
  ]

  const packageVars = missing.filter((m) => m.tier === 'package')
  const siteVars = missing.filter((m) => m.tier === 'site')

  if (packageVars.length > 0) {
    lines.push('  ── Package-level (BeYours Platform) ──')
    for (const v of packageVars) {
      lines.push(`    ✗ ${v.name}: ${v.message}`)
    }
    lines.push('')
  }

  if (siteVars.length > 0) {
    lines.push('  ── Site-level (Per Restaurant) ──')
    for (const v of siteVars) {
      lines.push(`    ✗ ${v.name}: ${v.message}`)
    }
    lines.push('')
  }

  lines.push(`  Total: ${missing.length} variable(s) manquante(s) ou invalide(s)`)
  lines.push('  → Copiez .env.example vers .env.local et remplissez les valeurs.')
  lines.push('')

  return lines.join('\n')
}
