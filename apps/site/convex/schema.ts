import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  /* ── Programme Apporteur d'Affaires ── */

  affiliateUsers: defineTable({
    userId: v.id("users"), // ref to authTables.users
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    // The programme is for professionals only: SIRET required (validated when
    // the profile is completed, before signing; no payout without a SIRET).
    siret: v.optional(v.string()),
    role: v.union(v.literal("affiliate"), v.literal("admin")),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("rejected"),
    ),
    contractStatus: v.optional(
      v.union(
        v.literal("pending_contract"),
        v.literal("active"),
        v.literal("blocked_new_version"),
      ),
    ),
    requiredContractVersionId: v.optional(v.id("contractVersions")),
    acceptedContractVersionId: v.optional(v.id("contractVersions")),
    stripeConnectAccountId: v.optional(v.string()),
    stripeConnectStatus: v.union(
      v.literal("not_started"),
      v.literal("pending"),
      v.literal("active"),
      v.literal("disabled"),
    ),
    commissionOverrideCents: v.optional(v.number()),
    discountOverridePercent: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_role", ["role"])
    .index("by_contractStatus", ["contractStatus"]),

  referralCodes: defineTable({
    affiliateUserId: v.id("affiliateUsers"),
    code: v.string(),
    isCustom: v.boolean(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_affiliateUserId", ["affiliateUserId"]),

  referrals: defineTable({
    referrerId: v.id("affiliateUsers"),
    referralCodeId: v.id("referralCodes"),
    orderId: v.id("orders"),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("validated"),
      v.literal("payable"),
      /* Claimed by a payout run and not yet confirmed paid. It exists so a
         second run cannot pick the same commission up: `getPayableReferrals`
         reads `payable` only, so a claimed row is invisible to it. A run that
         fails puts the row back to `payable` — see stripeConnect.processPayouts. */
      v.literal("paying"),
      v.literal("paid"),
      v.literal("cancelled"),
      v.literal("blocked"),
    ),
    statusReason: v.optional(v.string()),
    commissionCents: v.number(),
    discountPercent: v.number(),
    discountAmountCents: v.number(),
    validatedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    blockedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    stripeTransferId: v.optional(v.string()),
    // The affiliate's invoice — mandatory before payout (art. 4.2 of the contract).
    invoiceStorageId: v.optional(v.id("_storage")),
    invoiceUploadedAt: v.optional(v.number()),
    adminNote: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_referrerId", ["referrerId"])
    .index("by_orderId", ["orderId"])
    .index("by_status", ["status"])
    .index("by_referralCodeId", ["referralCodeId"]),

  affiliateSettings: defineTable({
    defaultCommissionCents: v.number(),
    defaultDiscountPercent: v.number(),
    validationDelayDays: v.number(),
    programEnabled: v.boolean(),
    updatedAt: v.number(),
  }),

  /* ── Contrat d'apporteur d'affaires ── */

  contractVersions: defineTable({
    version: v.string(),
    title: v.string(),
    content: v.string(),
    contentHash: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("archived"),
    ),
    createdAt: v.number(),
    activatedAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_version", ["version"]),

  contractSignatures: defineTable({
    affiliateUserId: v.id("affiliateUsers"),
    contractVersionId: v.id("contractVersions"),
    yousignSignatureRequestId: v.optional(v.string()),
    yousignSignerUrl: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("signed"),
      v.literal("declined"),
      v.literal("expired"),
      v.literal("canceled"),
      v.literal("failed"),
    ),
    contractSnapshotContent: v.string(),
    contractSnapshotHash: v.string(),
    signedDocumentFileId: v.optional(v.string()),
    signerIp: v.optional(v.string()),
    signedAt: v.optional(v.number()),
    // In-house simple electronic signature (SES) — audit trail
    signerName: v.optional(v.string()),
    signerUserAgent: v.optional(v.string()),
    /* Reference printed on the « certificat de signature » page, minted before
       the PDF is drawn. It used to be the row's own `_id`, which forced the row
       to exist before the document — the ordering that produced an orphan on
       every failed attempt. See convex/affiliateSignature.ts. */
    signatureRef: v.optional(v.string()),
    signatureMethod: v.optional(
      v.union(v.literal("yousign"), v.literal("in_app_ses")),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_affiliateUserId", ["affiliateUserId"])
    .index("by_yousignSignatureRequestId", ["yousignSignatureRequestId"])
    .index("by_affiliateUserId_and_contractVersionId", [
      "affiliateUserId",
      "contractVersionId",
    ])
    .index("by_status", ["status"]),

  whitelist: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.string(),
    restaurantName: v.string(),
    city: v.string(),
    plan: v.union(v.literal("essentielle"), v.literal("premium")),
    message: v.optional(v.string()),
    createdAt: v.number(),
    /* Last time this prospect contacted us — re-submitting the form counts.
       /confidentialite publishes « Prospects : jusqu'à trois (3) ans à compter
       du dernier contact », and this is the date that sentence counts from;
       ./retention falls back to `createdAt` for the rows written before it
       existed. Optional for that reason, and no migration can invent one. */
    lastContactAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"])
    /* The sweep in ./retention.ts deletes on `lastContactAt` and must therefore
       WALK on it. Scanning `by_createdAt` and filtering on a different field
       starves: a capped page of old rows whose contact date is fresh hides every
       expired row behind it, and the run reports a clean sweep. Rows written
       before the field existed sort first, which is the right end. */
    .index("by_lastContactAt", ["lastContactAt"]),

  orders: defineTable({
    customerEmail: v.string(),
    customerFirstName: v.string(),
    customerLastName: v.string(),
    customerPhone: v.string(),
    restaurantName: v.string(),
    city: v.string(),
    buyerType: v.union(v.literal("business"), v.literal("personal")),
    siret: v.optional(v.string()),
    plan: v.union(v.literal("essentielle"), v.literal("premium")),
    orderType: v.union(v.literal("creation"), v.literal("maintenance")),
    billingPeriod: v.optional(
      v.union(v.literal("monthly"), v.literal("yearly")),
    ),
    amountCents: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    paymentMethod: v.optional(
      v.union(v.literal("card"), v.literal("alma"), v.literal("klarna")),
    ),
    stripeSessionId: v.optional(v.string()),
    /* Founders sale: creation offered (10 slots) — consumes a slot while the
       order is paid, or pending and still payable. See convex/foundersOffer.ts. */
    isFounders: v.optional(v.boolean()),
    /* ── Maintenance subscription provisioning after the 1st payment ──
       Optional/additive (no migration): absent = a legacy order, or one the
       webhook has not processed yet. "active" = the Stripe subscription was
       created; "failed" = the payment was collected but the subscription was
       NOT created → manual provisioning required (also logged in saActivity
       kind:"system"). Written by the Stripe webhook
       (internal.http.recordSubscriptionOutcome). */
    subscriptionStatus: v.optional(
      v.union(v.literal("active"), v.literal("failed")),
    ),
    /* ── art. L. 221-28: the express request for immediate performance ──
       The CGV say the withdrawal waiver is given by ticking a box at checkout,
       so the tick has to survive somewhere the company can produce it. Written
       by `createCheckoutSession`, which refuses the order without it, from
       lib/legal/withdrawal-waiver.ts — never from a caller-supplied string.

       Optional so the schema still validates the orders taken before this
       existed; those rows carry no record, which is exactly the gap, and no
       migration can invent one. Every order created from now on has it. */
    withdrawalWaiver: v.optional(
      v.object({
        /** Server clock at the moment the order was accepted. */
        consentedAt: v.number(),
        /** `WITHDRAWAL_WAIVER.version` in force when the box was ticked. */
        version: v.string(),
        /** The exact sentence the buyer was shown, stored verbatim. */
        text: v.string(),
        /** The CGV clause the tick evidences. */
        cgvClause: v.string(),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_email", ["customerEmail"])
    .index("by_status", ["status"])
    .index("by_stripeSessionId", ["stripeSessionId"])
    .index("by_isFounders_and_status", ["isFounders", "status"]),

  payments: defineTable({
    orderId: v.id("orders"),
    stripePaymentIntentId: v.string(),
    stripeSessionId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("refunded"),
    ),
    amountCents: v.number(),
    paymentMethod: v.string(),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_orderId", ["orderId"])
    .index("by_stripePaymentIntentId", ["stripePaymentIntentId"]),

  subscriptions: defineTable({
    orderId: v.id("orders"),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    customerEmail: v.string(),
    plan: v.union(v.literal("essentielle"), v.literal("premium")),
    billingPeriod: v.union(v.literal("monthly"), v.literal("yearly")),
    status: v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
      v.literal("incomplete"),
    ),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_orderId", ["orderId"])
    .index("by_stripeSubscriptionId", ["stripeSubscriptionId"])
    .index("by_customerEmail", ["customerEmail"])
    .index("by_status", ["status"]),

  invoices: defineTable({
    orderId: v.optional(v.id("orders")),
    subscriptionId: v.optional(v.id("subscriptions")),
    stripeInvoiceId: v.string(),
    /* The number PRINTED on the invoice, which is the one the law cares about
       — stripeInvoiceId is an internal handle (in_…) that appears nowhere on
       the document. Optional: invoices recorded before this was kept have
       none, and a draft has no number yet. */
    invoiceNumber: v.optional(v.string()),
    stripeCustomerId: v.string(),
    customerEmail: v.string(),
    plan: v.union(v.literal("essentielle"), v.literal("premium")),
    amountCents: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("open"),
      v.literal("paid"),
      v.literal("void"),
      v.literal("uncollectible"),
    ),
    invoicePdfUrl: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_stripeInvoiceId", ["stripeInvoiceId"])
    .index("by_customerEmail", ["customerEmail"])
    .index("by_subscriptionId_and_status", ["subscriptionId", "status"])
    .index("by_orderId", ["orderId"]),

  stripe_events: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    processed: v.boolean(),
    createdAt: v.number(),
  }).index("by_eventId", ["eventId"]),

  /* ══ Superadmin console — fleet / incidents / monitoring ══
     Tables prefixed with « sa » (self-contained, denormalised by
     customerEmail — there is no clients table: clients are derived
     from `orders`). */

  saDeployments: defineTable({
    customerEmail: v.string(),
    restaurantName: v.string(),
    city: v.string(),
    orderId: v.optional(v.id("orders")),
    name: v.string(),
    domain: v.string(),
    convexUrl: v.optional(v.string()),
    environment: v.union(v.literal("production"), v.literal("staging")),
    status: v.union(
      v.literal("provisioning"),
      v.literal("staging"),
      v.literal("live"),
      v.literal("degraded"),
      v.literal("suspended"),
      v.literal("offboarded"),
    ),
    health: v.union(
      v.literal("healthy"),
      v.literal("degraded"),
      v.literal("down"),
      v.literal("unknown"),
    ),
    region: v.string(),
    plan: v.union(v.literal("essentielle"), v.literal("premium")),
    version: v.optional(v.string()),
    latestVersion: v.optional(v.string()),
    uptime30d: v.number(),
    storeCount: v.number(),
    goLiveAt: v.optional(v.number()),
    provisionedAt: v.number(),
    lastCheckAt: v.optional(v.number()),
    lastDeployAt: v.optional(v.number()),
    integrations: v.array(
      v.object({
        key: v.union(
          v.literal("stripe"),
          v.literal("sumup"),
          v.literal("paypal"),
          v.literal("square"),
          v.literal("uber_eats"),
          v.literal("deliveroo"),
          v.literal("uber_direct"),
          v.literal("ses"),
        ),
        status: v.union(
          v.literal("connected"),
          v.literal("disconnected"),
          v.literal("error"),
          v.literal("not_configured"),
        ),
        detail: v.optional(v.string()),
      }),
    ),
    maintenance: v.object({
      status: v.union(
        v.literal("none"),
        v.literal("active"),
        v.literal("expiring_soon"),
        v.literal("expired"),
      ),
      coveredUntil: v.optional(v.number()),
      autoRenew: v.boolean(),
    }),
    /* ── Update entitlement ──
       Opaque key written into the site's .beindigital-site.json at
       provisioning. Its update scripts present it to /maintenance/status to
       learn whether the contract still covers them (convex/maintenance.ts).
       Optional: sites provisioned before the gate existed have none, and are
       treated as unregistered — allowed through, and listed as such. */
    licenseKey: v.optional(v.string()),
    /* ── Offboarding ──
       `status: "offboarded"` is a label; it revokes nothing. The deployment
       keeps whatever credentials were pushed into it at provisioning — today
       that includes the fleet-wide AWS keys (`apps/themes/scripts/env.mjs`).
       These two stamps exist so the console can tell "we marked them gone"
       apart from "they can no longer reach anything", which are not the same
       day. `accessRevokedAt` is set by `saFleet.recordAccessRevoked` once the
       steps in `tasks/client-offboarding-runbook.md` have actually been done.
       Both are cleared if the deployment comes back out of `offboarded`. */
    offboardedAt: v.optional(v.number()),
    accessRevokedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_health", ["health"])
    .index("by_licenseKey", ["licenseKey"])
    .index("by_customerEmail", ["customerEmail"]),

  saStores: defineTable({
    deploymentId: v.id("saDeployments"),
    name: v.string(),
    city: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("closed"),
      v.literal("draft"),
      v.literal("temporarily_unavailable"),
    ),
    createdAt: v.number(),
  }).index("by_deployment", ["deploymentId"]),

  saSalesSnapshots: defineTable({
    deploymentId: v.id("saDeployments"),
    customerEmail: v.string(),
    day: v.string(),
    dayTs: v.number(),
    grossCents: v.number(),
    netCents: v.number(),
    refundedCents: v.number(),
    orderCount: v.number(),
    avgOrderValueCents: v.number(),
    byType: v.object({
      delivery: v.number(),
      pickup: v.number(),
      dine_in: v.number(),
    }),
    bySource: v.object({
      website: v.number(),
      uber_eats: v.number(),
      deliveroo: v.number(),
      pos: v.number(),
    }),
    currency: v.string(),
    createdAt: v.number(),
  })
    .index("by_deployment_day", ["deploymentId", "dayTs"])
    .index("by_day", ["dayTs"]),

  saIncidents: defineTable({
    number: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    deploymentId: v.optional(v.id("saDeployments")),
    customerEmail: v.optional(v.string()),
    restaurantName: v.optional(v.string()),
    severity: v.union(
      v.literal("sev1"),
      v.literal("sev2"),
      v.literal("sev3"),
      v.literal("sev4"),
    ),
    status: v.union(
      v.literal("open"),
      v.literal("investigating"),
      v.literal("identified"),
      v.literal("monitoring"),
      v.literal("resolved"),
    ),
    area: v.array(
      v.union(
        v.literal("payments"),
        v.literal("orders"),
        v.literal("kitchen"),
        v.literal("integrations"),
        v.literal("site"),
        v.literal("delivery"),
        v.literal("auth"),
        v.literal("other"),
      ),
    ),
    detectedBy: v.union(
      v.literal("monitoring"),
      v.literal("client"),
      v.literal("team"),
    ),
    assigneeName: v.optional(v.string()),
    impact: v.optional(v.string()),
    startedAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    resolutionSummary: v.optional(v.string()),
    postmortemUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_severity", ["severity"])
    .index("by_deployment", ["deploymentId"])
    .index("by_startedAt", ["startedAt"]),

  saIncidentUpdates: defineTable({
    incidentId: v.id("saIncidents"),
    status: v.optional(
      v.union(
        v.literal("open"),
        v.literal("investigating"),
        v.literal("identified"),
        v.literal("monitoring"),
        v.literal("resolved"),
      ),
    ),
    message: v.string(),
    authorName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_incident", ["incidentId"]),

  saMonitoringChecks: defineTable({
    deploymentId: v.id("saDeployments"),
    kind: v.union(
      v.literal("http"),
      v.literal("convex"),
      v.literal("integration"),
      v.literal("webhook"),
    ),
    target: v.string(),
    status: v.union(
      v.literal("up"),
      v.literal("down"),
      v.literal("degraded"),
    ),
    latencyMs: v.optional(v.number()),
    statusCode: v.optional(v.number()),
    message: v.optional(v.string()),
    checkedAt: v.number(),
  })
    .index("by_deployment_time", ["deploymentId", "checkedAt"])
    .index("by_checkedAt", ["checkedAt"]),

  saActivity: defineTable({
    kind: v.union(
      v.literal("commerce"),
      v.literal("deployment"),
      v.literal("incident"),
      v.literal("client"),
      v.literal("system"),
    ),
    action: v.string(),
    summary: v.string(),
    deploymentId: v.optional(v.id("saDeployments")),
    customerEmail: v.optional(v.string()),
    incidentId: v.optional(v.id("saIncidents")),
    actorName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  /* Leads coming from the site's contact form (distinct from whitelist,
     which is the waitlist). Fed by contactLeads.submit. */
  contactLeads: defineTable({
    name: v.string(),
    email: v.string(),
    restaurant: v.optional(v.string()),
    message: v.string(),
    status: v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("converted"),
      v.literal("archived"),
    ),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),

  /* Fixed-window rate limit counters.

     One row per (limit, subject) — see `rateLimitKey` in ./rateLimit.ts for the
     key's shape. It backs the two mutations anybody can drive in a loop:
     `contactLeads.submit`, which schedules mail to a caller-supplied address,
     and `referrals.generateInvoiceUploadUrl`, which mints storage.

     Kept deliberately small: a row holds a window start and a count, and
     nothing else. An operator asked why a submit was refused can read the
     answer off the row. */
  rateLimits: defineTable({
    /** `<limit name>:<subject>`, e.g. `contactPerEmail:yanis@resto.example`. */
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),
});
