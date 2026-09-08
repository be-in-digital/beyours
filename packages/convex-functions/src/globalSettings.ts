/**
 * Global settings management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

import { effectiveDeliveryFeeMode } from "./deliveryQuote"
import { resolveStripeCharge } from "./stripeChargeRouting"

/**
 * Percentage delivery pricing bills a share of an Uber Direct quote. Stored
 * without the integration, it leaves the shop unable to take a delivery order
 * at all: `orders.create` asks for an estimate id the storefront has no way to
 * obtain, and every delivery customer is turned away with "un devis de
 * livraison est requis".
 *
 * The settings page already refuses to offer the mode while Uber Direct is
 * off. This closes the other door — the one an owner walks through by
 * configuring percentage mode and then switching the integration off, which
 * leaves the mode behind with nothing to price it.
 *
 * Coerced, not refused: an owner switching Uber Direct off must be able to
 * switch it off. What survives is the mode the shop can still honour.
 */
function honourableDelivery(
  delivery: { feeMode?: string } | undefined,
  integrations: { uberDirect?: { enabled?: boolean } } | undefined
) {
  if (!delivery || delivery.feeMode !== "percentage") return delivery
  const mode = effectiveDeliveryFeeMode({
    feeMode: delivery.feeMode,
    uberDirectEnabled: integrations?.uberDirect?.enabled,
  })
  return mode === "percentage" ? delivery : { ...delivery, feeMode: "fixed" }
}

// === QUERIES ===

/**
 * Get the global settings (there's only one row)
 */
export const get = {
  args: {},
  handler: async (ctx: any) => {
    const settings = await ctx.db.query("globalSettings").first()
    return settings
  },
}

/**
 * Which provider takes a card payment — or `none`, when the establishment does
 * not accept cards at all.
 *
 * `none` is stored, chosen by the owner in Réglages → Paiements. It is not a
 * fallback for a missing value: an unset `payments` block still means "Stripe,
 * not yet configured", which reads as unavailable through the key check below.
 */
export type CardProvider = "stripe" | "sumup" | "none"

/** Read a stored `cardProvider` as one of the three, defaulting to Stripe. */
export function normalizeCardProvider(value: unknown): CardProvider {
  return value === "sumup" || value === "none" ? value : "stripe"
}

/**
 * Can this deployment actually take a card right now?
 *
 * `payments.cardProvider` declares WHICH provider, never WHETHER it works: the
 * signal that decides whether a card attempt can succeed is the platform key
 * (Stripe) or the connection row (SumUp), and neither reaches the storefront.
 * So the checkout pre-selected a card tile every fresh deployment could not
 * serve, and the natural first journey was a failed card submit (#374).
 *
 * Pure so the rule can be pinned without a ctx; the def below is what the
 * apps mount. It answers exactly the checks the charge-starting actions make:
 * `createCheckoutSession` refuses without `STRIPE_SECRET_KEY` and on a
 * connection state `resolveStripeCharge` will not honour; SumUp's
 * `createCheckout` refuses unless the connection is `connected` with a stored
 * token. Keep the two in step — a tile offered here and refused there is this
 * defect again.
 */
export function resolveCardPaymentAvailability(input: {
  cardProvider: CardProvider
  stripeSecretKeyPresent: boolean
  connection: { status: string; encryptedAccessToken?: string } | null
  /**
   * What the provider said last time anything asked it — see
   * `globalSettings.cardProviderHealth`. Absent means nobody has asked, which
   * is not the same as a refusal and must not read as one.
   */
  providerHealth?: { provider: string; usable: boolean } | null
}): boolean {
  // The owner's own answer, and the only one no amount of detection can
  // infer: a cash-only establishment with Stripe perfectly well connected.
  if (input.cardProvider === "none") return false

  // A verdict the PROVIDER gave, and the only thing that can answer the
  // question `startsWith("sk_")` was pretending to answer: whether the
  // credentials work. A well-formed key that Stripe rejects — revoked, rolled,
  // belonging to another account — armed the tile and sent every diner into
  // the redacted "Server Error" #374 removed (#411). Read before the provider
  // branches because it applies to both, and only when it is about the
  // provider actually in use: a leftover Stripe verdict must not disarm a
  // deployment that has since moved to SumUp.
  //
  // It does NOT catch a test key on a live deployment. Stripe accepts an
  // `sk_test_` key and answers 200, so no health check can see that; it is a
  // different question and nothing here asks it.
  if (
    input.providerHealth &&
    input.providerHealth.provider === input.cardProvider &&
    !input.providerHealth.usable
  ) {
    return false
  }

  if (input.cardProvider === "sumup") {
    return (
      input.connection?.status === "connected" &&
      Boolean(input.connection?.encryptedAccessToken)
    )
  }
  if (!input.stripeSecretKeyPresent) return false
  try {
    resolveStripeCharge(input.connection)
    return true
  } catch {
    return false
  }
}

/**
 * The query def behind the storefront's `paymentAvailability.get`.
 *
 * Answers two booleans — deliberately no more: this is readable before any
 * sign-in, and the key itself, the connection row and its token never leave
 * the server.
 *
 *   `card`        — can a card be taken right now? What stops the checkout
 *                   pre-selecting a dead tile (#374).
 *   `cardOffered` — does this establishment take cards at all? An owner's
 *                   public business decision, not configuration: a cash-only
 *                   food truck needs the tile GONE, not greyed out under
 *                   « Indisponible pour le moment », which reads as a fault
 *                   that might clear (#376).
 */
export const cardPaymentAvailability = {
  args: {},
  handler: async (
    ctx: any
  ): Promise<{ card: boolean; cardOffered: boolean }> => {
    const settings = await ctx.db.query("globalSettings").first()
    // `none` is a third answer, not an absent one. This used to read
    // `=== "sumup" ? "sumup" : "stripe"`, which folded every other value —
    // including an owner's explicit "we do not take cards" — onto Stripe.
    const cardProvider = normalizeCardProvider(settings?.payments?.cardProvider)
    const cardOffered = cardProvider !== "none"
    // No provider means no connection row to look for.
    const connection = cardOffered
      ? await ctx.db
          .query("paymentConnections")
          .withIndex("by_provider", (q: any) => q.eq("provider", cardProvider))
          .first()
      : null
    // Mirrors `getSiteEnv()`'s own validation, which the charge action reads
    // the key through: a pasted publishable `pk_…` key makes that call throw,
    // so a key that does not start with `sk_` must read as unavailable here —
    // not as an active tile in front of a redacted crash.
    const stripeKey = process.env.STRIPE_SECRET_KEY
    return {
      card: resolveCardPaymentAvailability({
        cardProvider,
        stripeSecretKeyPresent:
          typeof stripeKey === "string" && stripeKey.startsWith("sk_"),
        connection,
        // The shape check above says the string LOOKS like a key. Only the
        // provider can say whether it works, so what it said is read here.
        providerHealth: cardOffered
          ? await readCardProviderHealth(ctx, cardProvider)
          : null,
      }),
      cardOffered,
    }
  },
}

/** How much of a provider's refusal message is worth keeping. */
export const MAX_HEALTH_DETAIL_CHARS = 500

/**
 * Read the stored verdict for one card provider, if there is one.
 *
 * Its own table, not a field on `globalSettings` — see
 * `packages/convex-schema/src/tables/cardProviderHealth.ts` for why both
 * halves of that mattered.
 */
export async function readCardProviderHealth(
  ctx: any,
  provider: string
): Promise<{ provider: string; usable: boolean } | null> {
  return await ctx.db
    .query("cardProviderHealth")
    .withIndex("by_provider", (q: any) => q.eq("provider", provider))
    .first()
}

/**
 * Write down what the card provider said about our credentials.
 *
 * WHY THIS EXISTS: `cardPaymentAvailability` is a query and a query cannot
 * call Stripe, so the only check it could make was on the SHAPE of the key —
 * `startsWith("sk_")`. A well-formed key the API rejects passed that, armed
 * the checkout's card tile, and sent the diner into the redacted "Server
 * Error" that #374 exists to remove (#411). The verdict has to be recorded by
 * something that CAN ask, and read here.
 *
 * Two writers, deliberately. The hourly probe asks on purpose, which is what
 * bounds RECOVERY: once a verdict disarms the tile, no diner can reach the
 * checkout path, so the checkout cannot be what discovers that the key has
 * been put right. The checkout is what bounds DETECTION — it reports what it
 * learnt for free, so a key revoked between two probes costs one diner rather
 * than an hour of them.
 *
 * ONLY ON A CHANGE. `globalSettings` and this table are read on the order
 * path, and Convex conflicts a write with every concurrent transaction that
 * read the document: rewriting a row on every successful checkout would make
 * a busy service lose OCC rounds over bookkeeping. So `checkedAt` means "when
 * this verdict was recorded", which is when it last moved — the probe proves
 * freshness by running, not by writing.
 *
 * Never throws. Its callers are a money path and a cron, and neither may fail
 * over bookkeeping about a check.
 */
export const recordCardProviderHealth = {
  args: {
    provider: v.union(v.literal("stripe"), v.literal("sumup")),
    usable: v.boolean(),
    detail: v.optional(v.string()),
  },
  handler: async (
    ctx: any,
    args: { provider: string; usable: boolean; detail?: string }
  ): Promise<void> => {
    try {
      const existing = await ctx.db
        .query("cardProviderHealth")
        .withIndex("by_provider", (q: any) => q.eq("provider", args.provider))
        .first()

      const detail = args.detail
        ? args.detail.slice(0, MAX_HEALTH_DETAIL_CHARS)
        : undefined

      if (existing) {
        // Same answer as last time: say nothing. See the docblock — this row
        // is read on the order path.
        if (existing.usable === args.usable && existing.detail === detail) {
          return
        }
        await ctx.db.patch(existing._id, {
          usable: args.usable,
          checkedAt: Date.now(),
          detail,
        })
        return
      }

      await ctx.db.insert("cardProviderHealth", {
        provider: args.provider,
        usable: args.usable,
        checkedAt: Date.now(),
        ...(detail ? { detail } : {}),
      })
    } catch (failure) {
      console.error(
        "[globalSettings] could not record card provider health:",
        failure
      )
    }
  },
}

// === MUTATIONS ===

/**
 * Create or update global settings
 * Uses upsert pattern: if settings exist, patch them; otherwise create new
 */
export const upsert = {
  args: {
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    services: v.optional(v.object({
      dineIn: v.boolean(),
      takeaway: v.boolean(),
      delivery: v.boolean(),
      clickAndCollect: v.boolean(),
    })),
    minimumOrderAmount: v.optional(v.number()),
    hours: v.optional(v.array(v.object({
      day: v.number(),
      open: v.string(),
      close: v.string(),
      isClosed: v.boolean(),
    }))),
    delivery: v.optional(v.object({
      feeMode: v.optional(v.union(v.literal("fixed"), v.literal("percentage"))),
      fee: v.optional(v.number()),
      percentage: v.optional(v.number()),
      maxFee: v.optional(v.number()),
      freeAbove: v.optional(v.number()),
      radius: v.optional(v.number()),
    })),
    payments: v.optional(v.object({
      // `none` — the establishment does not take cards. See the schema.
      cardProvider: v.union(
        v.literal("stripe"),
        v.literal("sumup"),
        v.literal("none")
      ),
      paypal: v.boolean(),
      paypalEmail: v.optional(v.string()),
      cash: v.boolean(),
    })),
    // The fiscal identity invoices are issued under — the exact shape the
    // schema declares. Until #375 no mutation accepted it, so
    // `seller_incomplete` was permanent on every deployment: the settings
    // screen collects it now, and this is the validator that lets the save
    // through. Absence stays legal — `invoices.sellerIsComplete` is what
    // decides completeness, not this validator.
    seller: v.optional(v.object({
      legalName: v.optional(v.string()),
      legalForm: v.optional(v.string()),
      address: v.optional(v.object({
        street: v.string(),
        city: v.string(),
        postalCode: v.string(),
        country: v.optional(v.string()),
      })),
      siren: v.optional(v.string()),
      siret: v.optional(v.string()),
      vatNumber: v.optional(v.string()),
      rcs: v.optional(v.string()),
      shareCapital: v.optional(v.number()),
      legalMentions: v.optional(v.string()),
    })),
    integrations: v.optional(v.object({
      uberDirect: v.optional(v.object({
        customerId: v.optional(v.string()),
        clientId: v.optional(v.string()),
        clientSecret: v.optional(v.string()),
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
    })),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.query("globalSettings").first()
    if (existing) {
      const updates: Record<string, unknown> = { updatedAt: Date.now() }
      for (const [key, value] of Object.entries(args)) {
        if (value === undefined) continue
        // `integrations` is patched platform by platform, not as one blob.
        //
        // `ctx.db.patch` replaces a whole object field, so a caller sending
        // only `{ uberDirect }` erased the Uber Eats and Deliveroo settings
        // beside it — a tab saving its own section took out the others. Each
        // platform is still replaced whole, so clearing a field inside one
        // works: absent means "not this tab's business", not "keep this".
        if (key === "integrations" && existing.integrations) {
          updates.integrations = { ...existing.integrations, ...(value as object) }
          continue
        }
        updates[key] = value
      }
      // Read back what this write actually leaves behind — `delivery` is
      // replaced whole, `integrations` merged above — so turning Uber Direct
      // off in the integrations tab drops the orphaned percentage mode with it,
      // even though that save never mentioned delivery.
      const writtenDelivery = (updates.delivery ?? existing.delivery) as
        | { feeMode?: string }
        | undefined
      const resolvedDelivery = honourableDelivery(
        writtenDelivery,
        (updates.integrations ?? existing.integrations) as
          | { uberDirect?: { enabled?: boolean } }
          | undefined
      )
      // A new object only comes back when the mode was actually dropped, so an
      // unrelated save leaves `delivery` untouched instead of rewriting it.
      if (resolvedDelivery !== writtenDelivery) updates.delivery = resolvedDelivery

      await ctx.db.patch(existing._id, updates)
      return existing._id
    }
    // Create with defaults
    return await ctx.db.insert("globalSettings", {
      currency: args.currency ?? "EUR",
      timezone: args.timezone ?? "Europe/Paris",
      taxRate: args.taxRate ?? 20,
      services: args.services ?? {
        dineIn: true,
        takeaway: true,
        delivery: false,
        clickAndCollect: false,
      },
      minimumOrderAmount: args.minimumOrderAmount,
      hours: args.hours ?? [
        { day: 0, open: "00:00", close: "00:00", isClosed: true },
        { day: 1, open: "09:00", close: "22:00", isClosed: false },
        { day: 2, open: "09:00", close: "22:00", isClosed: false },
        { day: 3, open: "09:00", close: "22:00", isClosed: false },
        { day: 4, open: "09:00", close: "22:00", isClosed: false },
        { day: 5, open: "09:00", close: "23:00", isClosed: false },
        { day: 6, open: "09:00", close: "23:00", isClosed: false },
      ],
      delivery: honourableDelivery(
        args.delivery ?? { feeMode: "fixed", radius: 10, fee: 350, freeAbove: 3000 },
        args.integrations
      ),
      payments: args.payments ?? { cardProvider: "stripe", paypal: false, cash: false },
      seller: args.seller,
      integrations: args.integrations ?? {},
      updatedAt: Date.now(),
    })
  },
}
