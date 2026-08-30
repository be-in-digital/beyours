/**
 * The send loop, end to end, against a real backend and a real SES call.
 *
 * Everything up to now has tested the loop's DECISIONS — which variant, who is
 * held back, who has already been reached — because the loop itself calls SES
 * from a `"use node"` module that convex-test cannot execute. This drives the
 * real action in the real Convex runtime with `AWS_ENDPOINT_URL` pointed at a
 * stand-in, so what is checked is the loop actually doing it.
 */
import { ConvexHttpClient } from "convex/browser"

const CLOUD = "http://127.0.0.1:3280"
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

/**
 * Wait until the batch chain stops producing new mail.
 *
 * Requires several quiet samples in a row, not one. On a loaded machine a
 * single send — an SES call plus two mutation round-trips plus the 100 ms
 * pace — can take longer than one poll interval, so two equal readings mean
 * nothing. An earlier version of this settled after two and reported 7 of 12
 * sent; all 12 were in flight, and the database said so.
 */
async function settle(label, { timeoutMs = 120_000, quietPolls = 5 } = {}) {
  let last = -1
  let stable = 0
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await sleep(1_500)
    const now = (await sentMail()).length
    if (now === last) {
      if (++stable >= quietPolls) return now
    } else {
      stable = 0
      last = now
    }
  }
  bad(`${label}: never settled`)
  return last
}

const stamp = Date.now()

// A FIXED subject, so re-running the probe against the same deployment finds
// the same super admin. A stamped one claims the seat on the first run and is
// locked out of it on every run after.
const admin = as("probe-admin")

// The first call into a cold isolate can exceed Convex's 1s budget. Warming it
// with a query costs nothing and removes a failure that says nothing about the
// code under test.
await admin.query("userProfiles:bootstrapStatus", {}).catch(() => {})

try {
  await admin.mutation("userProfiles:claimFirstAdmin", {
    bootstrapToken: process.env.ADMIN_BOOTSTRAP_TOKEN,
  })
  ok("claimed the first super-admin seat")
} catch (error) {
  // `error.data`, not the message: Convex redacts a thrown message and puts
  // the reason in the payload. Printing the message alone said only
  // "Server Error", which hid that the bootstrap token was missing.
  const reason = error?.data?.message ?? error?.data?.code ?? String(error).slice(0, 120)
  info(`bootstrap skipped: ${reason}`)
}

const storeId = await admin.mutation("stores:create", {
  name: `Probe ${stamp}`,
  slug: `probe-${stamp}`,
  address: { street: "1 rue de la Paix", city: "Paris", postalCode: "75002", country: "France" },
})
ok(`store ${storeId}`)

// The email config the send path reads: sender, branding, and the weekly cap.
await admin.mutation("emailConfig:upsert", {
  storeId,
  senderName: "Chez Luigi",
  fromEmail: "luigi@resto.example",
  replyToEmail: "contact@resto.example",
  branding: { primaryColor: "#111111", secondaryColor: "#eeeeee" },
  unsubscribeText: "Se désabonner",
  maxEmailsPerWeek: 2,
  automationSettings: {
    welcomeEnabled: true, postOrderEnabled: false, birthdayEnabled: false,
    inactiveEnabled: false, abandonedCartEnabled: false,
  },
})
ok("email config written (maxEmailsPerWeek = 2)")

const templateId = await admin.mutation("emailTemplates:create", {
  storeId,
  name: "Brunch",
  subject: "Sujet du modèle",
  blocks: [{ id: "b1", type: "text", content: "Bonjour !" }],
  category: "marketing",
})

// Twelve subscribers, so the 40-per-batch page boundary is not in play and the
// arithmetic stays readable.
const SUBSCRIBERS = 12
for (let i = 0; i < SUBSCRIBERS; i++) {
  await admin.mutation("emailSubscribers:create", {
    storeId, email: `reader-${i}-${stamp}@example.test`, source: "manual",
  })
}
ok(`${SUBSCRIBERS} active subscribers seeded`)

// ---------------------------------------------------------------------------
// 1. A plain campaign reaches everyone, exactly once
// ---------------------------------------------------------------------------
// The catcher accumulates across runs, so every count below is a delta.
const baseline = (await sentMail()).length

const plain = await admin.mutation("emailCampaigns:create", {
  storeId, name: "Campagne 1", subject: "Notre brunch du samedi", templateId,
  abTestEnabled: false,
})
await admin.action("emailCampaignActions:send", { campaignId: plain })
await settle("plain campaign")

const mail1 = (await sentMail()).slice(baseline)
mail1.length === SUBSCRIBERS
  ? ok(`${mail1.length} emails sent — one per subscriber`)
  : bad(`expected ${SUBSCRIBERS} emails`, `got ${mail1.length}`)

const recipients = mail1.flatMap((m) => m.to)
new Set(recipients).size === recipients.length
  ? ok("no address received the campaign twice")
  : bad("a duplicate went out", JSON.stringify(recipients))

mail1.every((m) => m.subject === "Notre brunch du samedi")
  ? ok("every email carried the campaign subject")
  : bad("wrong subject on some emails")

// The headers #253 added, which nothing has yet seen leave the runtime.
const h = mail1[0]?.headers ?? {}
h["List-Unsubscribe"]?.includes("/email/unsubscribe?id=")
  ? ok(`List-Unsubscribe present — ${h["List-Unsubscribe"].slice(0, 60)}…`)
  : bad("List-Unsubscribe missing", JSON.stringify(h))
h["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click"
  ? ok("List-Unsubscribe-Post present (RFC 8058 one-click)")
  : bad("List-Unsubscribe-Post missing or wrong", h["List-Unsubscribe-Post"])
h["X-Campaign-Id"] && h["X-Subscriber-Id"] && h["X-Store-Id"]
  ? ok("correlation headers present for the SES webhook")
  : bad("correlation headers missing", JSON.stringify(h))

const status1 = await admin.query("emailCampaigns:getById", { id: plain })
status1?.status === "sent"
  ? ok('campaign finished at status "sent"')
  : bad("campaign did not finish", status1?.status)
info(`stats.sent = ${status1?.stats?.sent}`)

// ---------------------------------------------------------------------------
// 2. Re-sending must not mail anyone a second time
// ---------------------------------------------------------------------------
const before2 = (await sentMail()).length
try {
  await admin.action("emailCampaignActions:send", { campaignId: plain })
  info("re-send accepted by the action")
} catch (error) {
  info(`re-send refused: ${String(error).split("\n")[0].slice(0, 100)}`)
}
await sleep(4_000)
const after2 = (await sentMail()).length
after2 === before2
  ? ok("re-sending a finished campaign mailed nobody again")
  : bad("a re-send produced more mail", `${after2 - before2} extra`)

// ---------------------------------------------------------------------------
// 3. maxEmailsPerWeek holds people back
// ---------------------------------------------------------------------------
const second = await admin.mutation("emailCampaigns:create", {
  storeId, name: "Campagne 2", subject: "Deuxième", templateId, abTestEnabled: false,
})
await admin.action("emailCampaignActions:send", { campaignId: second })
await settle("second campaign")
const countAfterSecond = (await sentMail()).length
info(`total after two campaigns: ${countAfterSecond}`)

const third = await admin.mutation("emailCampaigns:create", {
  storeId, name: "Campagne 3", subject: "Troisième", templateId, abTestEnabled: false,
})
await admin.action("emailCampaignActions:send", { campaignId: third })
await settle("third campaign")
const countAfterThird = (await sentMail()).length

// The cap is two per subscriber per week; the third campaign must reach nobody.
countAfterThird === countAfterSecond
  ? ok(`maxEmailsPerWeek held the third campaign back entirely (${countAfterThird} total)`)
  : bad("the weekly cap did not hold", `${countAfterThird - countAfterSecond} sent past it`)

// ---------------------------------------------------------------------------
// 4. A/B variants reach the audience and are recorded
// ---------------------------------------------------------------------------
const fresh = []
for (let i = 0; i < 20; i++) {
  fresh.push(
    await admin.mutation("emailSubscribers:create", {
      storeId, email: `ab-${i}-${stamp}@example.test`, source: "manual",
    })
  )
}
const abCampaign = await admin.mutation("emailCampaigns:create", {
  storeId, name: "Campagne A/B", subject: "Sujet par défaut", templateId,
  abTestEnabled: true,
  variants: [
    { id: "a", subject: "Bras A — brunch ?", percentage: 50 },
    { id: "b", subject: "Bras B — votre table", percentage: 50 },
  ],
})
const beforeAb = (await sentMail()).length
await admin.action("emailCampaignActions:send", { campaignId: abCampaign })
await settle("A/B campaign")

const abMail = (await sentMail()).slice(beforeAb)
const subjects = new Set(abMail.map((m) => m.subject))
info(`A/B reached ${abMail.length} of the 20 fresh subscribers`)
subjects.size === 2 && subjects.has("Bras A — brunch ?") && subjects.has("Bras B — votre table")
  ? ok(`both arms went out: ${[...subjects].join(" | ")}`)
  : bad("the A/B arms were not applied", JSON.stringify([...subjects]))
!subjects.has("Sujet par défaut")
  ? ok("nobody received the campaign's default subject")
  : bad("some emails fell back to the default subject")

const events = await admin.query("emailEvents:listByCampaign", { campaignId: abCampaign })
const withVariant = (events ?? []).filter((e) => e.metadata?.variantId)
withVariant.length === abMail.length
  ? ok(`variantId recorded on all ${withVariant.length} sent events`)
  : bad("variantId missing on some events", `${withVariant.length}/${abMail.length}`)
