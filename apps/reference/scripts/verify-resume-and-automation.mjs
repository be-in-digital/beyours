/**
 * The two paths the first probe did not reach.
 *
 * 1. Pause and resume — the P0 (#144) where "Relancer" restarted at the first
 *    subscriber and mailed everyone who had already received the campaign a
 *    second time. Real customers, real complaints, real SES reputation.
 * 2. The welcome automation — #257's engine, which has no live coverage at all
 *    because the step that sends lives in a `"use node"` module.
 */
import { ConvexHttpClient } from "convex/browser"

const CLOUD = "http://127.0.0.1:3280"
const SITE = "http://127.0.0.1:3281"
const CATCHER = "http://127.0.0.1:3282"

const as = (subject) => {
  const c = new ConvexHttpClient(CLOUD)
  c.setAdminAuth(process.env.CONVEX_ADMIN_KEY, {
    subject, issuer: "https://probe.local", name: subject,
    email: `${subject}@resto.example`,
  })
  return c
}

const ok = (l) => console.log(`  \x1b[32mOK\x1b[0m   ${l}`)
const bad = (l, x = "") => { console.log(`  \x1b[31mFAIL\x1b[0m ${l} ${x}`); process.exitCode = 1 }
const info = (l) => console.log(`       ${l}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sentMail = async () => (await fetch(`${CATCHER}/__sent`)).json()

const retry = async (fn, tries = 8) => {
  for (let i = 0; i < tries; i++) {
    try { return await fn() } catch (e) {
      if (!/timed out/.test(String(e)) || i === tries - 1) throw e
      await sleep(900)
    }
  }
}

async function settle(label, { timeoutMs = 240_000, quietPolls = 5 } = {}) {
  let last = -1, stable = 0
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await sleep(1_500)
    const now = (await sentMail()).length
    if (now === last) { if (++stable >= quietPolls) return now }
    else { stable = 0; last = now }
  }
  bad(`${label}: never settled`)
  return last
}

/**
 * Start a send, tolerating the local backend's 1 s function budget.
 *
 * Retrying the action blindly is not safe: `send` refuses a campaign already
 * `sending`, so a retry after a partial success would throw. What is safe is
 * to ask whether it started — the mutation that marks it commits before the
 * response is lost.
 */
async function startSend(admin, campaignId, label) {
  try {
    await admin.action("emailCampaignActions:send", { campaignId })
    return true
  } catch (error) {
    if (!/timed out/.test(String(error))) throw error
    await sleep(1_500)
    const row = await retry(() =>
      admin.query("emailCampaigns:getById", { id: campaignId })
    )
    if (row?.status === "sending" || row?.status === "sent") {
      info(`${label}: action response lost to the 1 s budget, but it started`)
      return true
    }
    bad(`${label}: send never started`, row?.status)
    return false
  }
}

const stamp = Date.now()
const admin = as("probe-admin")
await retry(() => admin.query("userProfiles:bootstrapStatus", {}))

const storeId = await retry(() => admin.mutation("stores:create", {
  name: `Resume ${stamp}`, slug: `resume-${stamp}`,
  address: { street: "1 rue de la Paix", city: "Paris", postalCode: "75002", country: "France" },
}))
await retry(() => admin.mutation("emailConfig:upsert", {
  storeId,
  senderName: "Chez Luigi", fromEmail: "luigi@resto.example", replyToEmail: "contact@resto.example",
  branding: { primaryColor: "#111111", secondaryColor: "#eeeeee" },
  unsubscribeText: "Se désabonner",
  // High, so this probe measures resumption rather than the weekly cap.
  maxEmailsPerWeek: 50,
  automationSettings: {
    welcomeEnabled: true, postOrderEnabled: false, birthdayEnabled: false,
    inactiveEnabled: false, abandonedCartEnabled: false,
  },
}))
const templateId = await retry(() => admin.mutation("emailTemplates:create", {
  storeId, name: "T", subject: "Sujet du modèle",
  blocks: [{ id: "b1", type: "text", content: "Bonjour !" }], category: "marketing",
}))
ok(`store ${storeId} ready`)

// ---------------------------------------------------------------------------
// 1. Pause mid-flight, then resume — nobody may receive it twice
// ---------------------------------------------------------------------------
const AUDIENCE = 90 // more than one 40-subscriber page, so a pause lands mid-run
for (let i = 0; i < AUDIENCE; i++) {
  await retry(() => admin.mutation("emailSubscribers:create", {
    storeId, email: `resume-${i}-${stamp}@example.test`, source: "manual",
  }))
}
ok(`${AUDIENCE} subscribers seeded (spans ${Math.ceil(AUDIENCE / 40)} batches)`)

const baseline = (await sentMail()).length
const campaignId = await retry(() => admin.mutation("emailCampaigns:create", {
  storeId, name: "Reprise", subject: "Campagne interrompue", templateId, abTestEnabled: false,
}))

await startSend(admin, campaignId, "initial send")

// Let some of it go out, then pause. The exact moment does not matter: the
// assertions below hold wherever it lands.
await sleep(3_500)
const atPause = (await sentMail()).length - baseline
try {
  await retry(() => admin.mutation("emailCampaigns:pause", { id: campaignId }))
  ok(`paused after ${atPause} of ${AUDIENCE}`)
} catch (error) {
  info(`pause refused (send may have finished): ${String(error).slice(0, 80)}`)
}

const afterPause = await settle("paused campaign", { quietPolls: 4 })
const sentWhilePaused = afterPause - baseline
info(`${sentWhilePaused} sent by the time the chain stopped`)

const paused = await retry(() => admin.query("emailCampaigns:getById", { id: campaignId }))
info(`status=${paused?.status} cursor=${paused?.sendCursor ? "kept" : "none"}`)

// "Relancer" — the exact button that used to restart at subscriber one.
await startSend(admin, campaignId, "resume")
await settle("resumed campaign")

const all = (await sentMail()).slice(baseline)
const addresses = all.flatMap((m) => m.to)
const unique = new Set(addresses)

all.length === AUDIENCE
  ? ok(`${all.length} emails for ${AUDIENCE} subscribers`)
  : bad(`expected ${AUDIENCE} emails`, `got ${all.length}`)
unique.size === addresses.length
  ? ok("resuming mailed nobody a second time — P0-20 holds")
  : bad(`${addresses.length - unique.size} duplicate(s) after resume`,
        [...addresses].filter((a, i) => addresses.indexOf(a) !== i).slice(0, 3).join(", "))

const finished = await retry(() => admin.query("emailCampaigns:getById", { id: campaignId }))
finished?.status === "sent"
  ? ok('resumed campaign finished at "sent"')
  : bad("resumed campaign did not finish", finished?.status)

// ---------------------------------------------------------------------------
// 2. The welcome automation, from the confirmation link to the email
// ---------------------------------------------------------------------------
const automationId = await retry(() => admin.mutation("emailAutomations:create", {
  storeId,
  name: "Bienvenue",
  trigger: "welcome",
  steps: [{ id: "s1", delayMinutes: 0, templateId }],
}))
await retry(() => admin.mutation("emailAutomations:activate", { id: automationId }))
ok("welcome automation created and activated")

const before = (await sentMail()).length
// The real storefront path: subscribe, then confirm with the emailed token.
const newcomer = `welcome-${stamp}@example.test`
await retry(() => admin.mutation("emailSubscribers:subscribe", { storeId, email: newcomer }))
const row = (await retry(() => admin.query("emailSubscribers:list", { storeId })))
  .find((s) => s.email === newcomer)
info(`subscriber is "${row?.status}" with a token: ${row?.doubleOptInToken ? "yes" : "no"}`)

const confirmRes = await fetch(`${SITE}/email/confirm?token=${row.doubleOptInToken}`)
confirmRes.ok
  ? ok(`confirmation page answered ${confirmRes.status}`)
  : bad("confirmation failed", confirmRes.status)

await settle("welcome automation", { quietPolls: 4 })
const welcomeMail = (await sentMail()).slice(before).filter((m) => m.to.includes(newcomer))

welcomeMail.length === 1
  ? ok(`welcome email delivered to the new subscriber (subject "${welcomeMail[0].subject}")`)
  : bad("welcome automation did not fire", `${welcomeMail.length} emails`)

if (welcomeMail[0]) {
  welcomeMail[0].headers["X-Automation-Id"] === String(automationId)
    ? ok("carries X-Automation-Id, so the SES webhook can attribute it")
    : bad("automation correlation header missing", JSON.stringify(welcomeMail[0].headers))
}

const runs = await retry(() => admin.query("emailSubscribers:list", { storeId }))
info(`store now holds ${runs.length} subscribers`)
