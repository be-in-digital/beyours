export async function register() {
  // Skip validation during build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const { validateSiteEnv, formatSiteEnvReport } = await import('./lib/env')

  const { ok, problems } = validateSiteEnv()

  if (ok) {
    console.log('[env] apps/site environment validated')
    return
  }

  console.error(formatSiteEnvReport(problems))

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[env] ${problems.length} environment variable(s) missing or invalid. See report above.`
    )
  }
}
