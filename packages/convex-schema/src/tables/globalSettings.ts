import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Global settings table
 * Stores default configuration inherited by all stores.
 * Individual stores can override specific values.
 */
export const globalSettingsTable = defineTable({
  // General
  currency: v.string(), // e.g. "EUR"
  timezone: v.string(), // e.g. "Europe/Paris"
  taxRate: v.number(), // e.g. 20 (percentage)

  // Services
  services: v.object({
    dineIn: v.boolean(),
    takeaway: v.boolean(),
    delivery: v.boolean(),
    clickAndCollect: v.boolean(),
  }),

  minimumOrderAmount: v.optional(v.number()), // in cents

  /**
   * The rate that applies to a delivery charge, as a percentage.
   *
   * Absent means "not decided", and the fee is then left out of the VAT
   * breakdown rather than declared at the food's rate. Which rate a delivery
   * charge carries in France depends on whether it is accessory to the meal or
   * a separate service, and it is not the engine's call to guess: guessing
   * wrong misdeclares VAT on every delivery the establishment makes.
   * `computeOrderTotals` reads this through `deliveryTaxRatePercent`.
   */
  deliveryTaxRate: v.optional(v.number()),

  /**
   * Who the seller is, on an invoice.
   *
   * WHY THIS EXISTS: nothing in the schema identified the business. `stores`
   * carries a name, a postal address used for delivery radius, a phone and an
   * email — no legal name, no legal form, no SIREN, no SIRET, no VAT number, no
   * RCS, no share capital. An invoice without those is not an invoice, so this
   * had to exist before one could be issued.
   *
   * On `globalSettings` rather than on `stores`, and that records an
   * assumption worth being able to point at: `CLAUDE.md` says one Convex
   * instance per client, and there is no company entity above `stores`, so the
   * DEPLOYMENT is the legal entity. If a client's establishments turn out to be
   * separate legal entities — a franchise, an SCI per site — this belongs per
   * entity and the invoice series splits with it. See `invoiceSequenceKey`.
   *
   * Every field optional: no deployment has any of this yet, so a required
   * field would fail `schemaValidation: true` on every existing installation.
   * `invoices.issueInvoiceForOrder` is what refuses to issue while the block is
   * incomplete — absence is caught where it matters, not by the validator.
   */
  seller: v.optional(v.object({
    /** The registered name — « SARL Chez Luigi », not the trading name. */
    legalName: v.optional(v.string()),
    /** SARL, SAS, EI, micro-entreprise… */
    legalForm: v.optional(v.string()),
    /** The registered seat, which is not necessarily any establishment. */
    address: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.optional(v.string()),
    })),
    siren: v.optional(v.string()),
    siret: v.optional(v.string()),
    /** Intra-community VAT number, e.g. FR12345678901. */
    vatNumber: v.optional(v.string()),
    /** « RCS Lyon 123 456 789 ». */
    rcs: v.optional(v.string()),
    /** Share capital in cents. */
    shareCapital: v.optional(v.number()),
    /**
     * Free-text mentions the establishment is required to carry — e.g.
     * « TVA non applicable, art. 293 B du CGI » for a micro-entreprise, or the
     * late-payment terms. Printed verbatim, in French, at the foot.
     */
    legalMentions: v.optional(v.string()),
  })),

  // Default hours (inherited by stores unless overridden)
  hours: v.array(v.object({
    day: v.number(), // 0=Sunday, 1=Monday, ..., 6=Saturday
    open: v.string(), // "09:00"
    close: v.string(), // "22:00"
    isClosed: v.boolean(),
  })),

  // Delivery settings
  delivery: v.object({
    feeMode: v.optional(v.union(v.literal("fixed"), v.literal("percentage"))),
    fee: v.optional(v.number()), // fixed fee in cents (used when feeMode = "fixed")
    percentage: v.optional(v.number()), // 1-100, % of Uber Direct cost charged to client
    maxFee: v.optional(v.number()), // max fee cap in cents (percentage mode only)
    freeAbove: v.optional(v.number()), // free delivery above this amount (cents)
    radius: v.optional(v.number()), // in km
  }),

  // Payment configuration
  payments: v.optional(v.object({
    cardProvider: v.union(v.literal("stripe"), v.literal("sumup")),
    paypal: v.boolean(),
    paypalEmail: v.optional(v.string()), // PayPal Business email used as payee
    cash: v.boolean(), // Only available for click & collect and dine-in orders
  })),

  // Integration credentials (global level)
  integrations: v.object({
    uberDirect: v.optional(v.object({
      customerId: v.optional(v.string()),
      clientId: v.optional(v.string()),
      clientSecret: v.optional(v.string()),
      apiKey: v.optional(v.string()), // deprecated, kept for backward compat
      enabled: v.boolean(),
    })),
    uberEats: v.optional(v.object({
      enabled: v.boolean(),
      priceMarkup: v.optional(v.number()), // platform price markup percentage
    })),
    deliveroo: v.optional(v.object({
      enabled: v.boolean(),
      priceMarkup: v.optional(v.number()), // platform price markup percentage
    })),
  }),

  updatedAt: v.number(),

  // ─── System control center ────────────────────────────────────────────────
  /** Snapshot of the deployed app version (runtime = source of truth) */
  deployedAppVersion: v.optional(v.string()),
  /** Backup format version for compatibility checks */
  backupFormatVersion: v.optional(v.string()),
  /** Timestamp of the last successful backup */
  lastBackupAt: v.optional(v.number()),
  /** List of applied data migrations */
  appliedMigrations: v.optional(v.array(v.object({
    id: v.string(),
    name: v.string(),
    appliedAt: v.number(),
  }))),
  /** System lock to prevent concurrent operations */
  systemLock: v.optional(v.object({
    operation: v.string(),
    lockedBy: v.string(),
    lockedAt: v.number(),
    expiresAt: v.number(),
  })),

  // ─── Personal-data retention (RGPD art. 5.1.e) ─────────────────────────────
  /**
   * How long this deployment keeps a diner's personal data.
   *
   * Deployment-wide rather than per establishment: the data controller is the
   * business, not one of its dining rooms, and a diner who ordered at two
   * locations of the same brand is one data subject with one retention clock.
   *
   * ABSENT MEANS THE DEFAULT, NOT "OFF". A client who never opens the screen
   * gets `DEFAULT_CUSTOMER_RETENTION_DAYS` — the CNIL's three years from last
   * contact — because keeping a diner's address for ever is the unlawful
   * state, not deleting it. `enabled: false` is a deliberate pause (a
   * litigation hold, a migration), and it is recorded here so that the reason
   * an establishment stopped deleting is visible rather than inferred.
   *
   * Nothing accounting-bound is lost to it: the sweep ANONYMISES an order and
   * its payments rather than deleting them, so the ten-year `pièce
   * justificative` (art. L123-22 Code de commerce) survives without the
   * customer in it. See `packages/convex-functions/src/privacy.ts`.
   */
  dataRetention: v.optional(v.object({
    /** Days from a diner's last contact. */
    customerDataDays: v.number(),
    /** False pauses the sweep. It still reports what it WOULD have done. */
    enabled: v.boolean(),
    updatedAt: v.number(),
    /** Who set it, so the audit trail can answer "who chose this window". */
    updatedBy: v.optional(v.string()),
  })),
})
