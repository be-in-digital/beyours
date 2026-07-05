import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  /* ── Programme Apporteur d'Affaires ── */

  affiliateUsers: defineTable({
    userId: v.id("users"), // ref vers authTables.users
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
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
  }).index("by_email", ["email"]),

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
    createdAt: v.number(),
  })
    .index("by_email", ["customerEmail"])
    .index("by_status", ["status"])
    .index("by_stripeSessionId", ["stripeSessionId"]),

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
});
