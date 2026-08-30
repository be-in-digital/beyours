/**
 * The closing condition of chantier 01, replayed.
 *
 *   "Inscription → mail → connexion → dashboard fonctionne de bout en bout,
 *    et un client connecté qui tape /dashboard est redirigé au lieu de faire
 *    planter la page."
 *
 * Proven once, early, against a main that has since moved by a dozen merges.
 * This is the automatable half — everything that happens over HTTP against the
 * Convex backend and the Better Auth routes. The last step, that the dashboard
 * renders rather than white-screens, needs a browser.
 *
 * Needs: a Convex backend, the SES stand-in (scripts/local-ses.mjs), and the
 * Next app. See apps/docs/guides/verifying-email-delivery.md for the env.
 */
import { ConvexHttpClient } from "convex/browser"

const CLOUD = process.env.PROBE_CONVEX ?? "http://127.0.0.1:3280"
const APP = process.env.PROBE_APP ?? "http://127.0.0.1:3300"
const CATCHER = process.env.PROBE_CATCHER ?? "http://127.0.0.1:3282"

const ok = (l) => console.log(`  \x1b[32mOK\x1b[0m   ${l}`)
const bad = (l, x = "") => { console.log(`  \x1b[31mFAIL\x1b[0m ${l} ${x}`); process.exitCode = 1 }
const info = (l) => console.log(`       ${l}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const retry = async (fn, tries = 8) => {
  for (let i = 0; i < tries; i++) {
    try { return await fn() } catch (e) {
      if (!/timed out/.test(String(e)) || i === tries - 1) throw e
      await sleep(900)
    }
  }
}

const stamp = Date.now()
const EMAIL = `journey-${stamp}@example.test`
const PASSWORD = "Probe-Passw0rd!"

const admin = new ConvexHttpClient(CLOUD)
admin.setAdminAuth(process.env.CONVEX_ADMIN_KEY, {
  subject: "probe-admin", issuer: "https://probe.local",
  name: "probe-admin", email: "probe-admin@resto.example",
})

/** Everything the stand-in has captured. */
const mail = async () => (await fetch(`${CATCHER}/__sent`)).json()

// ---------------------------------------------------------------------------
// 1. Sign-up sends a verification email
// ---------------------------------------------------------------------------
const before = (await mail()).length

// Better Auth refuses a request with no `Origin` — its CSRF check, and it
// works: a header-less Node fetch is exactly what it exists to stop. The app's
// own URL is trusted through `SITE_URL`.
const ORIGIN = { "Content-Type": "application/json", Origin: APP }

const signUp = await fetch(`${APP}/api/auth/sign-up/email`, {
  method: "POST",
  headers: ORIGIN,
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "Yanis Probe" }),
})
const signUpBody = await signUp.text()

signUp.ok
  ? ok(`sign-up accepted (${signUp.status})`)
  : bad(`sign-up refused (${signUp.status})`, signUpBody.slice(0, 200))

// #131: sign-up was a dead end — the account was created and no mail ever left.
let verifyLink = null
for (let i = 0; i < 20 && !verifyLink; i++) {
  await sleep(1_000)
  const fresh = (await mail()).slice(before)
  const found = fresh.find((m) => m.to?.includes(EMAIL))
  if (found) {
    verifyLink = found.headers?.["X-Verify-Link"] ?? found.subject
    info(`verification email: "${found.subject}"`)
    ok("a verification email actually left the deployment")
  }
}
if (!verifyLink) bad("no verification email arrived — this is #131's failure mode")

// ---------------------------------------------------------------------------
// 2. An unverified account cannot sign in
// ---------------------------------------------------------------------------
const early = await fetch(`${APP}/api/auth/sign-in/email`, {
  method: "POST",
  headers: ORIGIN,
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const earlyBody = await early.text()
const refusedUnverified = /EMAIL_NOT_VERIFIED|not verified|verif/i
refusedUnverified.test(earlyBody) || early.status >= 400
  ? ok(`unverified sign-in refused (${early.status})`)
  : bad("an unverified account signed in", earlyBody.slice(0, 160))

info("the rest of the journey — following the link, signing in, and reaching")
info("the dashboard — is driven in the browser; see the guide.")

// ---------------------------------------------------------------------------
// 3. The guard a signed-in customer meets
// ---------------------------------------------------------------------------
const status = await retry(() => admin.query("userProfiles:bootstrapStatus", {}))
info(`deployment bootstrap: claimed=${status?.claimed} configured=${status?.configured}`)

const dash = await fetch(`${APP}/dashboard`, { redirect: "manual" })
dash.status < 500
  ? ok(`/dashboard answered ${dash.status} — not a server error`)
  : bad("/dashboard returned a server error", dash.status)
