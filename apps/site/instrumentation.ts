export async function register() {
  const { validateSiteEnv, formatSiteEnvReport, isInlinedAtBuild } = await import('./lib/env')

  const { ok, problems } = validateSiteEnv()

  /* Kept, but it is not what covers the build. Next 16 with Turbopack does not
     call register() during `next build` at all — measured: a full build with
     NEXT_PUBLIC_TVA_ENABLED unset emits no [env] line, with or without this
     branch. So this guard has nothing to skip today; it stays only so that a
     future Next which does invoke us mid-build reports rather than throws,
     since the Stripe, AWS and e-mail variables are absent from every build by
     design and CI compiles against a deliberate placeholder Convex URL.

     The build-time check that actually runs lives in next.config.ts, which IS
     evaluated during the build. That is the one that matters for the charging
     flag: /checkout is prerendered as static content, so its VAT branch is
     baked into HTML at build time and served from the CDN without ever booting
     a server — nothing here can stand between that page and the customer. */
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    const inlined = problems.filter((p) => isInlinedAtBuild(p) && p.tier !== 'required')
    if (inlined.length > 0) console.warn(formatSiteEnvReport(inlined))
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
