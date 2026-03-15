export async function register() {
  // Skip validation during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const { getPackageEnv, getSiteEnv } = await import(
    '@beindigital-engine/core/env'
  )

  try {
    getPackageEnv()
    getSiteEnv()
    console.log('[env] All environment variables validated successfully')
  } catch (error) {
    console.error('[env] Environment validation failed:', error)
    if (process.env.NODE_ENV === 'production') {
      throw error
    }
  }
}
