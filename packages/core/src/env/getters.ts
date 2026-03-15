import { packageEnvSchema, siteEnvSchema } from './schemas'
import type { PackageEnv, SiteEnv } from './schemas'

let _packageEnv: PackageEnv | null = null
let _siteEnv: SiteEnv | null = null

/**
 * Get validated BeInDigital platform env vars.
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
