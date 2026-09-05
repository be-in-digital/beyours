export async function register() {
  const { validateSiteEnv, formatSiteEnvReport, isInlinedAtBuild } = await import('./lib/env')

  const { ok, problems } = validateSiteEnv()

  /* The build phase cannot be held to the whole report: the Stripe, AWS and
     e-mail variables live on the Convex deployment and are absent from every
     build by design, and CI compiles this app against a deliberate placeholder
     Convex URL (.github/workflows/ci.yml) precisely so no real deployment gets
     inlined into a compile check.

     What it CAN be held to is the NEXT_PUBLIC_* half, because that half is
     being frozen into the client bundle right here — a boot check runs against
     an env that was read long after the bundle quoting the totals was already
     written. Reported, never fatal, for the reason above; a wrong charging
     flag also refuses the deployment at boot and refuses the sale at checkout,
     so this is the earliest warning rather than the only one. */
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    const inlined = problems.filter((p) => isInlinedAtBuild(p) && p.tier !== 'required')
    if (inlined.length > 0) {
      console.warn('[env] build : variables inlinées dans le bundle client à corriger')
      console.warn(formatSiteEnvReport(inlined))
    }
    return
  }

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
