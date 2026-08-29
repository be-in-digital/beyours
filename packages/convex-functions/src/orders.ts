/**
 * Order management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 *
 * These handlers use generic DB context types since they are consumed by
 * Convex query/mutation wrappers which inject the actual typed context.
 */

import { v } from "convex/values"
import type { OrderStatus } from "@be-in-digital/convex-schema"
import {
  canTransitionOrderStatus,
  isOrderTypeOffered,
  isOrderableStore,
  isPublishedStore,
  resolveStoreServices,
} from "@be-in-digital/convex-schema"
import { create as kitchenTicketCreate } from "./kitchenTickets"
import { generateOrderNumber } from "./helpers"
import {
  resolvePromotionDiscount,
  PromotionRejectedError,
  type DiscountableLine,
  type PromotionForDiscount,
} from "./promotionDiscount"
import {
  assertQuoteApplies,
  effectiveDeliveryFeeMode,
  quotedDeliveryFee,
} from "./deliveryQuote"
import { assertMeetsMinimum, assertWithinDeliveryRadius } from "./deliveryZone"
import {
  computeOrderTotals,
  resolveTaxRatePercent,
  type TaxedLine,
} from "./orderTotals"
import { verifyOrderLine } from "./orderLine"

// === QUERIES ===

/**
 * List all orders for a store, ordered by creation date (newest first)
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: { storeId: string }) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .collect()
  },
}

/**
 * Get order by ID
 */
export const getById = {
  args: { id: v.id("orders") },
  handler: async (ctx: any, args: { id: string }) => {
    return await ctx.db.get(args.id)
  },
}

/**
 * Get orders by customer
 */
export const getByCustomer = {
  args: { customerId: v.string() },
  handler: async (ctx: any, args: { customerId: string }) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_customerId", (q: any) => q.eq("customerId", args.customerId))
      .order("desc")
      .collect()
  },
}

/**
 * Get orders by status
 */
export const getByStatus = {
  args: {
    storeId: v.id("stores"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx: any, args: { storeId: string; status: string }) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", args.status)
      )
      .order("desc")
      .collect()
  },
}

/**
 * Get orders by view token (public access for order confirmation page)
 */
/**
 * The payment state of one order, and nothing else.
 *
 * The post-payment landing page has an orderId and, on some return paths, no
 * provider reference at all — SumUp's 3-D Secure sends the browser straight to
 * the redirect URL, bypassing the widget callback that would have carried the
 * checkout id. The page used to treat that case as success: it announced
 * "votre paiement a bien été reçu" and emptied the basket without asking
 * anyone. A refused card produced a confirmation screen.
 *
 * This is the smallest honest answer to "what actually happened": the stored
 * status, the order number, and nothing that identifies a customer. The order
 * id is an opaque Convex id the caller already holds.
 */
/**
 * The live-tracking token for an order, to whoever can already see the order.
 *
 * The confirmation page fetched this from `kitchenTickets.getByOrder`, which
 * sprint 2 correctly put behind `kitchen:read`. Correct, and it broke the
 * feature for the only people who need it: a guest is refused, the token comes
 * back undefined, and the "Suivre ma commande" button never renders. The
 * `/track/[token]` route existed with nothing able to reach it.
 *
 * The fix is not to reopen the kitchen query but to serve the token from the
 * order's own read path, under the same rule that already governs the order:
 * the view token issued at checkout, or the customer who placed it.
 */
export const getTrackingToken = {
  args: {
    orderId: v.id("orders"),
    viewToken: v.optional(v.string()),
  },
  handler: async (
    ctx: any,
    args: { orderId: string; viewToken?: string }
  ) => {
    const order = await ctx.db.get(args.orderId)
    if (!order) return null

    const byToken =
      args.viewToken !== undefined && order.viewToken === args.viewToken

    let byOwner = false
    if (!byToken) {
      const identity = await ctx.auth.getUserIdentity()
      byOwner = Boolean(identity && order.customerId === identity.subject)
    }

    if (!byToken && !byOwner) return null

    const ticket = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_orderId", (q: any) => q.eq("orderId", args.orderId))
      .first()

    return ticket?.trackingToken ?? null
  },
}

export const getPaymentState = {
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx: any, args: { orderId: string }) => {
    const order = await ctx.db.get(args.orderId)
    if (!order) return null
    return {
      paymentStatus: order.paymentStatus as string,
      status: order.status as string,
      orderNumber: order.orderNumber as string,
    }
  },
}

export const getByViewToken = {
  args: {
    orderId: v.id("orders"),
    viewToken: v.string(),
  },
  handler: async (ctx: any, args: { orderId: string; viewToken: string }) => {
    const order = await ctx.db.get(args.orderId)
    if (!order) return null
    if (order.viewToken !== args.viewToken) return null
    return order
  },
}

// === MUTATIONS ===

interface OrderItemInput {
  productId?: string
  productName: string
  quantity: number
  unitPrice: number
  selectedOptions: Array<{
    optionId?: string
    optionName: string
    choiceId?: string
    choiceName?: string
    priceModifier: number
  }>
  subtotal: number
  notes?: string
  externalId?: string
}

interface CreateOrderArgs {
  storeId: string
  idempotencyKey?: string
  customerId?: string
  customerInfo: { name: string; email?: string; phone?: string }
  items: OrderItemInput[]
  type: "delivery" | "pickup" | "dine_in"
  deliveryAddress?: {
    street: string
    city: string
    postalCode: string
    country: string
    latitude?: number
    longitude?: number
    instructions?: string
  }
  notes?: string
  paymentMethod?: string
  promotionId?: string
  uberDirectEstimateId?: string
}

interface StoreDoc {
  status?: string
  address?: { latitude?: number; longitude?: number }
  settings?: { taxRate?: number }
  /** Per-store service switches, when the owner has customised them. */
  overrides?: {
    services?: {
      dineIn?: boolean
      takeaway?: boolean
      delivery?: boolean
      clickAndCollect?: boolean
    }
  }
}

interface GlobalSettingsDoc {
  taxRate?: number
  timezone?: string
  minimumOrderAmount?: number
  /** The deployment-wide service switches, written by the settings page. */
  services?: {
    dineIn?: boolean
    takeaway?: boolean
    delivery?: boolean
    clickAndCollect?: boolean
  }
  delivery?: {
    feeMode?: "fixed" | "percentage"
    fee?: number
    percentage?: number
    maxFee?: number
    freeAbove?: number
    radius?: number
  }
  /** Percentage delivery pricing is only honoured while Uber Direct can quote. */
  integrations?: {
    uberDirect?: { enabled?: boolean }
  }
}

/**
 * Create a new order
 */
export const create = {
  args: {
    storeId: v.id("stores"),
    customerId: v.optional(v.string()),
    customerInfo: v.object({
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
    }),
    items: v.array(v.object({
      productId: v.optional(v.id("products")),
      productName: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      selectedOptions: v.array(v.object({
        optionId: v.optional(v.string()),
        optionName: v.string(),
        choiceId: v.optional(v.string()),
        choiceName: v.optional(v.string()),
        priceModifier: v.number(),
      })),
      subtotal: v.number(),
      notes: v.optional(v.string()),
      externalId: v.optional(v.string()),
    })),
    type: v.union(
      v.literal("delivery"),
      v.literal("pickup"),
      v.literal("dine_in")
    ),
    deliveryAddress: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      instructions: v.optional(v.string()),
    })),
    notes: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    // NOTE: there is deliberately no `discountAmount` argument. The discount is
    // recomputed server-side from `promotionId` — see resolvePromotionDiscount.
    promotionId: v.optional(v.id("promotions")),
    // NOTE: there is deliberately no `uberDirectFee` argument. In percentage
    // mode the fee is read from the stored quote this id refers to.
    uberDirectEstimateId: v.optional(v.string()),
    // One checkout attempt, as the browser identifies it. See the handler.
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx: any, args: CreateOrderArgs) => {
    const now = Date.now()

    // A second click on "Payer" used to buy a second dinner. The button
    // re-enables in `finally` while the redirect to the payment provider is
    // still in flight, and the cart survives a Back navigation: two orders, two
    // kitchen tickets, two promotion usages. The webhook path has had a dedup
    // key since the beginning (`createFromWebhook`); the customer's own path
    // had none.
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("orders")
        .withIndex("by_storeId_idempotencyKey", (q: any) =>
          q.eq("storeId", args.storeId).eq("idempotencyKey", args.idempotencyKey)
        )
        .first()
      if (existing) return existing._id
    }

    // Get store and global settings for tax rate and delivery config
    const store = await ctx.db.get(args.storeId) as StoreDoc | null
    if (!store) throw new Error("Store not found")

    // A draft establishment is not a storefront. Keeping drafts out of
    // `stores.list` is how one stops being *reachable*; this is what stops one
    // being *ordered from* — a tab left open before the owner unpublished it, a
    // store id persisted in localStorage, or a direct call all skip the list.
    // The kitchen behind a draft is not waiting for tickets.
    if (!isPublishedStore(store)) {
      throw new Error("This store is not open for orders")
    }

    // `closed` and `temporarily_unavailable` are the two ways an owner says
    // "not tonight" from the dashboard. They keep the restaurant listed and its
    // menu readable — that is what publication buys — and the storefront
    // already greys out every button. Only the browser did: the mutation took
    // the order, and a stale tab, a cart restored from localStorage or a direct
    // call reached it with no page in between.
    if (!isOrderableStore(store)) {
      throw new Error("This store is not accepting orders right now")
    }

    // Read once, before the items: the serving window of a dish is a question
    // about the clock in the kitchen, and that clock is a global setting. So is
    // the fallback VAT rate, for a product that predates the per-product one.
    const globalSettings = await ctx.db.query("globalSettings").first() as GlobalSettingsDoc | null
    const deliveryConfig = globalSettings?.delivery

    // The four service switches were enforced nowhere. The selector treated an
    // absent store override as "offer everything", and this mutation never
    // looked at `args.type`, so a restaurant that does not deliver took
    // delivery orders — including from a cart whose type was persisted before
    // the owner turned the service off.
    if (!isOrderTypeOffered(args.type, resolveStoreServices(store, globalSettings))) {
      throw new Error(`This store does not offer ${args.type} orders`)
    }

    const taxRatePercent = resolveTaxRatePercent({
      globalTaxRate: globalSettings?.taxRate,
    })

    // Re-fetch each product from DB — never trust client prices
    const verifiedItems: OrderItemInput[] = []
    // Each line's own VAT rate, kept beside the line it belongs to: a basket
    // mixing food at 10 % and alcohol at 20 % has no single rate.
    const taxedLines: TaxedLine[] = []
    // The same lines, seen by the promotion resolver: a discount scoped to a
    // product or a category has to know what is in the basket.
    const discountableLines: DiscountableLine[] = []
    for (const item of args.items) {
      if (!item.productId) {
        throw new Error("productId is required for each item")
      }

      const product = await ctx.db.get(item.productId)
      if (!product) throw new Error(`Product not found: ${item.productId}`)
      if (product.storeId !== args.storeId) {
        throw new Error(`Product ${item.productId} does not belong to store ${args.storeId}`)
      }

      // Availability, quantity, options and price all resolve in `orderLine`,
      // pure and tested, because each refusal is the difference between an
      // order the kitchen can cook and one it cannot.
      const line = verifyOrderLine({
        product,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions,
        now,
        timezone: globalSettings?.timezone,
      })

      verifiedItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        selectedOptions: line.selectedOptions,
        subtotal: line.subtotal,
        notes: item.notes,
        externalId: item.externalId,
      })

      discountableLines.push({
        productId: item.productId,
        categoryId: product.categoryId,
        subtotal: line.subtotal,
      })

      taxedLines.push({
        subtotal: line.subtotal,
        // `products.taxRate` is required at creation and has never been read by
        // the order path. A product predating the field falls back to the rate
        // configured for the whole deployment.
        taxRatePercent:
          typeof product.taxRate === "number" ? product.taxRate : taxRatePercent,
      })
    }

    // Calculate subtotal from server-verified items
    const subtotal = verifiedItems.reduce((sum: number, item: OrderItemInput) => sum + item.subtotal, 0)

    // Two settings the dashboard writes and nothing read.
    assertMeetsMinimum({
      subtotal,
      minimumOrderAmount: globalSettings?.minimumOrderAmount,
    })

    if (args.type === "delivery") {
      assertWithinDeliveryRadius({
        radiusKm: globalSettings?.delivery?.radius,
        store: store.address,
        dropoff: args.deliveryAddress,
      })
    }

    // Calculate delivery fee based on fee mode
    // Set once a quote has been validated, so it can be stamped consumed after
    // the order exists.
    let consumedQuoteId: any = undefined
    let deliveryFee = 0
    let deliveryFeeMode: "fixed" | "percentage" | undefined = undefined

    if (args.type === "delivery" && deliveryConfig) {
      // Not `deliveryConfig.feeMode` directly: percentage mode without Uber
      // Direct has no quote to bill a share of, and asking for an estimate id
      // the storefront cannot obtain refused every delivery order at that shop.
      const feeMode = effectiveDeliveryFeeMode({
        feeMode: deliveryConfig.feeMode,
        uberDirectEnabled: globalSettings?.integrations?.uberDirect?.enabled,
      })
      deliveryFeeMode = feeMode

      const freeAbove = deliveryConfig.freeAbove
      if (freeAbove && subtotal >= freeAbove) {
        deliveryFee = 0
      } else if (feeMode === "fixed") {
        deliveryFee = deliveryConfig.fee ?? 0
      } else if (feeMode === "percentage") {
        // The Uber Direct fee used to arrive as a client argument, and a
        // percentage of whatever number was sent became the delivery charge —
        // `uberDirectFee: 0` bought free delivery. The client now sends only
        // the estimate id and the fee is read from the quote we issued.
        if (!args.uberDirectEstimateId) {
          throw new Error(
            "Un devis de livraison est requis : veuillez confirmer votre adresse."
          )
        }

        const quote = await ctx.db
          .query("deliveryQuotes")
          .withIndex("by_estimateId", (q: any) =>
            q.eq("estimateId", args.uberDirectEstimateId)
          )
          .first()

        // Existence, tenant, expiry, single use and the bond to the address
        // the quote priced — all of it lives in `deliveryQuote`, pure and
        // tested, because each refusal decides what the customer is charged.
        assertQuoteApplies({
          quote,
          storeId: args.storeId,
          dropoff: args.deliveryAddress,
          now,
        })
        consumedQuoteId = quote._id

        deliveryFee = quotedDeliveryFee({
          quote,
          percentage: deliveryConfig.percentage ?? 100,
          maxFee: deliveryConfig.maxFee,
        })
      }
    }

    // The tax is *inside* the subtotal, so it is known before the discount and
    // does not move the total. It is computed here because the promotion
    // resolver is told what the order is worth, tax included.
    const taxAmount = computeOrderTotals({
      subtotal,
      taxRatePercent,
      lines: taxedLines,
    }).taxAmount

    // Recompute the discount from the stored promotion. The client never gets a
    // say: it used to pass `discountAmount`, which was applied verbatim and let
    // a forged value produce a 0 € order that still reached the kitchen.
    let discount = 0
    // Which promotion the order ends up carrying: the coupon the customer
    // typed, or the automatic offer that applied on its own.
    let appliedPromotionId: string | undefined = undefined
    if (args.promotionId) {
      const promotion = (await ctx.db.get(args.promotionId)) as
        | PromotionForDiscount
        | null
      if (!promotion) throw new Error("Promotion not found")

      // Per-customer caps are keyed on email. `resolvePromotionDiscount`
      // refuses a capped promotion on an anonymous order rather than let the
      // cap be bypassed by omitting the field.
      let customerUsageCount = 0
      if (args.customerInfo.email && promotion.maxUsagePerCustomer !== undefined) {
        const usages = await ctx.db
          .query("promotionUsages")
          .withIndex("by_promotionId_customerEmail", (q: any) =>
            q
              .eq("promotionId", args.promotionId)
              // Normalised the same way it is written below: without this,
              // `A@b.com` and `a@b.com` are two different customers and the
              // per-customer cap is bypassed by changing the case.
              .eq("customerEmail", args.customerInfo.email!.trim().toLowerCase())
          )
          .collect()
        customerUsageCount = usages.length
      }

      const resolved = resolvePromotionDiscount({
        promotion,
        storeId: args.storeId,
        subtotal,
        deliveryFee,
        now,
        customerUsageCount,
        customerIdentified: Boolean(args.customerInfo.email),
        items: discountableLines,
        timezone: globalSettings?.timezone,
      })
      // For a free-delivery promotion the resolver returns the fee as the
      // discount. The fee stays on the order so the customer still sees the
      // "Livraison 4,90 € / Offerte −4,90 €" pair; zeroing it here as well
      // would subtract it twice.
      discount = resolved.discount
      appliedPromotionId = args.promotionId
    } else {
      // No coupon: an automatic offer may still apply. `promotions.listActiveAuto`
      // was public, complete, and called by nobody — an owner who configured an
      // "offre automatique" got a promotion that never applied to anything.
      //
      // One promotion per order. A typed coupon is the customer's explicit
      // choice and wins outright; otherwise the automatic offer worth the most
      // applies, and the ones that do not fit are passed over in silence —
      // nobody asked for them by name, so there is nobody to explain a refusal
      // to.
      const autoPromotions = (await ctx.db
        .query("promotions")
        .withIndex("by_storeId_triggerMode", (q: any) =>
          q.eq("storeId", args.storeId).eq("triggerMode", "auto")
        )
        .collect()) as PromotionForDiscount[]

      for (const promotion of autoPromotions) {
        try {
          const resolved = resolvePromotionDiscount({
            promotion,
            storeId: args.storeId,
            subtotal,
            deliveryFee,
            now,
            // An automatic offer capped per customer would need an identity the
            // customer never gave: the resolver refuses it, and the catch below
            // passes over it.
            customerIdentified: Boolean(args.customerInfo.email),
            items: discountableLines,
            timezone: globalSettings?.timezone,
          })
          if (resolved.discount > discount) {
            discount = resolved.discount
            appliedPromotionId = promotion._id
          }
        } catch (error) {
          if (!(error instanceof PromotionRejectedError)) throw error
        }
      }
    }

    const { total } = computeOrderTotals({
      subtotal,
      taxRatePercent,
      lines: taxedLines,
      deliveryFee,
      discount,
    })

    const orderNumber = generateOrderNumber()

    // Generate view token for public order confirmation access
    const viewToken = crypto.randomUUID()

    const orderId = await ctx.db.insert("orders", {
      storeId: args.storeId,
      orderNumber,
      customerId: args.customerId,
      customerInfo: args.customerInfo,
      type: args.type,
      status: "pending",
      items: verifiedItems,
      subtotal,
      taxAmount,
      deliveryFee: args.type === "delivery" && deliveryFee > 0 ? deliveryFee : undefined,
      deliveryFeeMode: args.type === "delivery" ? deliveryFeeMode : undefined,
      uberDirectEstimateId: args.uberDirectEstimateId,
      // The promotion that actually applied — the coupon, or the automatic
      // offer that won on its own.
      promotionId: appliedPromotionId as any,
      discountAmount: discount > 0 ? discount : undefined,
      total,
      deliveryAddress: args.deliveryAddress,
      paymentMethod: args.paymentMethod,
      paymentStatus: "pending",
      source: "website",
      notes: args.notes,
      viewToken,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    })

    // Count the use as soon as a promotion was applied.
    //
    // This whole block used to sit behind `&& args.customerInfo.email`, so an
    // anonymous order got the discount without ever moving the counter: a
    // promotion capped at `maxTotalUsage: 1` stayed redeemable forever. The
    // per-customer cap was closed by refusing anonymous orders, but the GLOBAL
    // cap was not — the counter simply never advanced.
    // Burn the delivery quote. One quote, one order: it used to be reusable
    // forever, so a single cheap estimate could pay for every future delivery.
    if (consumedQuoteId) {
      await ctx.db.patch(consumedQuoteId, { consumedByOrderId: orderId })
    }

    if (appliedPromotionId) {
      const promo = await ctx.db.get(appliedPromotionId)
      if (promo) {
        await ctx.db.patch(appliedPromotionId, {
          usageCount: (promo.usageCount ?? 0) + 1,
          updatedAt: now,
        })

        // The per-customer ledger is keyed on email, so it only exists for an
        // identified customer. The global counter above does not depend on it.
        if (args.customerInfo.email) {
          await ctx.db.insert("promotionUsages", {
            storeId: args.storeId,
            promotionId: appliedPromotionId as any,
            customerEmail: args.customerInfo.email.trim().toLowerCase(),
            orderId,
            usedAt: now,
          })
        }
      }
    }

    return orderId
  },
}

/**
 * Record that a cash order was paid, at the counter or at the door.
 *
 * Cash was offered at checkout, accepted, and then unreachable: nothing ever
 * wrote a `payments` row for it, so the "Espèces" filter on the payments page
 * could never match, the order stayed `paymentStatus: "pending"` for ever, and
 * there was nothing to reconcile a till against. `internalUpdatePaymentStatus`
 * exists but is reachable only from the provider actions — no card provider
 * takes cash.
 *
 * Staff-side by definition: somebody has to have taken the notes.
 */
export const markCashPaid = {
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx: any, args: { orderId: string }) => {
    const order = await ctx.db.get(args.orderId)
    if (!order) throw new Error("Order not found")

    if (order.paymentStatus === "paid") {
      // Two members of staff pressing the same button is not a second payment.
      return null
    }
    if (order.paymentStatus === "refunded" || order.paymentStatus === "partially_refunded") {
      throw new Error("Cette commande a déjà été remboursée.")
    }

    const now = Date.now()
    const globalSettings = await ctx.db.query("globalSettings").first()

    const paymentId = await ctx.db.insert("payments", {
      orderId: args.orderId,
      storeId: order.storeId,
      amount: order.total,
      currency: globalSettings?.currency ?? "EUR",
      provider: "cash" as const,
      status: "succeeded" as const,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(args.orderId, {
      paymentStatus: "paid",
      updatedAt: now,
    })

    return paymentId
  },
}

/**
 * Update order status
 */
export const updateStatus = {
  args: {
    id: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx: any, args: { id: string; status: string; cancellationReason?: string }) => {
    const order = await ctx.db.get(args.id)
    if (!order) throw new Error("Order not found")

    const from = order.status as OrderStatus
    const to = args.status as OrderStatus

    // Replaying the current status is a no-op, not an error: webhook retries
    // and double-clicked buttons both land here, and failing them would turn a
    // harmless repeat into a Deliveroo retry loop.
    if (from === to) return

    if (!canTransitionOrderStatus(from, to)) {
      throw new Error(`Invalid order status transition: ${from} -> ${to}`)
    }

    const now = Date.now()
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    }

    // Set timestamps based on status
    if (args.status === "completed") {
      updates.completedAt = now
    } else if (args.status === "cancelled") {
      updates.cancelledAt = now
      if (args.cancellationReason) {
        updates.cancellationReason = args.cancellationReason
      }

      // If the order was paid, trigger refund on linked payments
      if (order.paymentStatus === "paid") {
        updates.paymentStatus = "refunded"

        // Also mark all succeeded payments as refunded
        const payments = await ctx.db
          .query("payments")
          .withIndex("by_orderId", (q: any) => q.eq("orderId", args.id))
          .collect()

        for (const payment of payments) {
          if (payment.status === "succeeded") {
            await ctx.db.patch(payment._id as string, {
              status: "refunded",
              refundedAmount: payment.amount,
              refundReason: args.cancellationReason ?? "Order cancelled",
              updatedAt: now,
            })
          }
        }
      }
    }

    await ctx.db.patch(args.id, updates)

    // A cancelled order used to leave its ticket live: the kitchen kept cooking
    // it on the display, and `/track/[token]` kept saying "en préparation" —
    // the page's own cancelled branch was unreachable from a cancellation. The
    // sync was one-way, ticket → order, and never the other.
    if (args.status === "cancelled") {
      const tickets = await ctx.db
        .query("kitchenTickets")
        .withIndex("by_orderId", (q: any) => q.eq("orderId", args.id))
        .collect()

      for (const ticket of tickets) {
        if (ticket.status !== "cancelled" && ticket.status !== "completed") {
          await ctx.db.patch(ticket._id as string, {
            status: "cancelled",
            updatedAt: now,
          })
        }
      }
    }
  },
}

/**
 * Delete an order
 */
export const remove = {
  args: { id: v.id("orders") },
  handler: async (ctx: any, args: { id: string }) => {
    await ctx.db.delete(args.id)
  },
}

// === Webhook types ===

interface WebhookItemModifier {
  externalId: string
  name: string
  price: number
}

interface WebhookItem {
  externalId: string
  name: string
  quantity: number
  price: number
  modifiers?: WebhookItemModifier[]
}

interface CreateFromWebhookArgs {
  storeId: string
  externalOrderId: string
  platform: "uberEats" | "deliveroo"
  status: string
  type: "delivery" | "pickup" | "dine_in"
  customerName: string
  customerPhone?: string
  customerEmail?: string
  deliveryAddress?: {
    street: string
    city: string
    postalCode: string
    country: string
  }
  items: WebhookItem[]
  subtotal: number
  total: number
  notes?: string
  createdAt: number
}

/**
 * Create order from webhook (Uber Eats, Deliveroo, etc.)
 */
export const createFromWebhook = {
  args: {
    storeId: v.id("stores"),
    externalOrderId: v.string(),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    type: v.union(
      v.literal("delivery"),
      v.literal("pickup"),
      v.literal("dine_in")
    ),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    deliveryAddress: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.string(),
    })),
    items: v.array(v.object({
      externalId: v.string(),
      name: v.string(),
      quantity: v.number(),
      price: v.number(),
      modifiers: v.optional(v.array(v.object({
        externalId: v.string(),
        name: v.string(),
        price: v.number(),
      }))),
    })),
    subtotal: v.number(),
    total: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx: any, args: CreateFromWebhookArgs) => {
    const sourceMap: Record<string, "website" | "uber_eats" | "deliveroo" | "pos"> = {
      uberEats: "uber_eats",
      deliveroo: "deliveroo",
    }
    const source = sourceMap[args.platform] ?? "website"

    // Idempotency: if a webhook for this order was already processed (retry by Uber/Deliveroo),
    // return the existing id instead of creating a duplicate.
    const existing = await ctx.db
      .query("orders")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("externalOrderId"), args.externalOrderId),
          q.eq(q.field("source"), source)
        )
      )
      .first()
    if (existing) {
      // Idempotent: duplicate webhook (Uber/Deliveroo retry). Signal the caller
      // so it does NOT create a second kitchen ticket or re-run auto-accept.
      return { orderId: existing._id, created: false }
    }

    const now = Date.now()
    const orderNumber = generateOrderNumber()

    const mappedItems = args.items.map((item: WebhookItem) => {
      const modifierTotal = item.modifiers?.reduce(
        (sum: number, mod: WebhookItemModifier) => sum + mod.price,
        0
      ) ?? 0
      return {
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        selectedOptions: item.modifiers?.map((mod: WebhookItemModifier) => ({
          optionName: mod.name,
          choiceName: mod.name,
          priceModifier: mod.price,
        })) ?? [],
        subtotal: item.price * item.quantity + modifierTotal,
        externalId: item.externalId,
      }
    })

    const orderId = await ctx.db.insert("orders", {
      storeId: args.storeId,
      orderNumber,
      externalOrderId: args.externalOrderId,
      type: args.type,
      status: args.status,
      customerInfo: {
        name: args.customerName,
        phone: args.customerPhone,
        email: args.customerEmail,
      },
      deliveryAddress: args.deliveryAddress,
      items: mappedItems,
      subtotal: args.subtotal,
      taxAmount: 0, // External platforms handle tax separately
      total: args.total,
      source,
      notes: args.notes,
      paymentStatus: "paid" as const,
      createdAt: args.createdAt,
      updatedAt: now,
    })
    return { orderId, created: true }
  },
}

/**
 * Update order from webhook
 */
export const updateFromWebhook = {
  args: {
    externalOrderId: v.string(),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    cancellationReason: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx: any, args: { externalOrderId: string; platform: string; status: string; cancellationReason?: string; updatedAt: number }) => {
    // Map platform to source field (createFromWebhook stores "source" not "platform")
    const sourceMap: Record<string, string> = {
      uberEats: "uber_eats",
      deliveroo: "deliveroo",
    }
    const source = sourceMap[args.platform] ?? args.platform

    const order = await ctx.db
      .query("orders")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("externalOrderId"), args.externalOrderId),
          q.eq(q.field("source"), source)
        )
      )
      .first()

    if (!order) {
      throw new Error(`Order not found: ${args.externalOrderId}`)
    }

    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: args.updatedAt,
    }

    if (args.status === "completed") {
      updates.completedAt = args.updatedAt
    } else if (args.status === "cancelled") {
      updates.cancelledAt = args.updatedAt
      if (args.cancellationReason) {
        updates.cancellationReason = args.cancellationReason
      }
    }

    await ctx.db.patch(order._id as string, updates)
    return order._id as string
  },
}

// === ORDER + KITCHEN TICKET ORCHESTRATION ===

/**
 * Map stored order items to the kitchen ticket item shape.
 * Pure — the KDS display contract lives here, in one testable place.
 */
export function toKitchenTicketItems(
  items: OrderItemInput[]
): Array<{ productName: string; quantity: number; options: string[]; notes?: string }> {
  return items.map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
    options:
      item.selectedOptions?.map(
        (o) => `${o.optionName}: ${o.choiceName ?? ""}`
      ) ?? [],
    notes: item.notes,
  }))
}

/**
 * "A confirmed order feeds the kitchen" is a business invariant, so it lives
 * behind this seam — not in the app transport wrapper. Creates the order,
 * then its kitchen ticket, in the same mutation (one Convex transaction).
 */
export const createWithTicket = {
  args: create.args,
  handler: async (ctx: any, args: CreateOrderArgs): Promise<string> => {
    const orderId = await create.handler(ctx, args)

    const order = await ctx.db.get(orderId)
    if (!order) throw new Error("Order creation failed")

    // A replayed checkout returns the order that already exists, so the ticket
    // for it already exists too. Asking first is what keeps the kitchen from
    // plating the same dinner twice.
    const existingTicket = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_orderId", (q: any) => q.eq("orderId", orderId))
      .first()
    if (existingTicket) return orderId

    await kitchenTicketCreate.handler(ctx, {
      storeId: order.storeId,
      orderId,
      orderNumber: order.orderNumber,
      orderType: order.type,
      items: toKitchenTicketItems(order.items),
      priority: "normal",
      source: "website",
      trackingToken: crypto.randomUUID(),
      customerName: order.customerInfo?.name,
      customerPhone: order.customerInfo?.phone,
      deliveryNotes: order.notes,
    })

    return orderId
  },
}
