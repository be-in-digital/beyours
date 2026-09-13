/**
 * Order management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 *
 * These handlers use generic DB context types since they are consumed by
 * Convex query/mutation wrappers which inject the actual typed context.
 */

import { v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import type {
  BusinessHours,
  OrderStatus,
  OrderType,
} from "@be-in-digital/convex-schema"
import {
  isWithinBusinessHours,
  resolveStoreHours,
} from "@be-in-digital/convex-schema"
import {
  MAX_TABLE_NUMBER_LENGTH,
  isValidTableNumber,
  normalizeTableNumber,
} from "@be-in-digital/core/dining"
import {
  assertDayStarts,
  computeDashboardStats,
  dashboardWindowStart,
  type DashboardStats,
} from "./dashboardStats"
import { clampPagination, clampPageSize } from "./pagination"
import { refusePlatformStatus } from "./platformWebhook"
import { assertFieldLengths, consumeRateLimit } from "./rateLimit"

/**
 * Most lines one order may carry. A large catering basket is dozens; five
 * hundred is a script building one enormous document a line at a time.
 */
const MAX_ORDER_LINES = 100
import {
  canTransitionOrderStatus,
  isOrderTypeOffered,
  isOrderableStore,
  isPublishedStore,
  resolveStoreServices,
} from "@be-in-digital/convex-schema"
import { create as kitchenTicketCreate } from "./kitchenTickets"
import {
  customerKey,
  recordOrder as recordCustomerOrder,
  reverseOrder as reverseCustomerOrder,
} from "./customers"
import {
  reverseMetadataIncremental,
  updateMetadataIncremental,
} from "./emailSubscribers"
import { allocateOrderNumber } from "./numbering"
import { isMarketplaceOrder } from "./orderSource"
import {
  planOrderConfirmation,
  readSubscriberStanding,
  type OrderConfirmationDispatch,
} from "./orderConfirmation"
import { planOrderReady } from "./orderReady"
import { issueInvoiceForOrder } from "./invoices"
import { collectionOnOrder } from "./paymentLedger"
import {
  assertOrderHasNoInvoice,
  assertOrderHasNoLivePayment,
  deleteOrderDependents,
  releasePromotionForOrder,
} from "./orderCascade"
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
import { verifyOrderLine, MAX_LINE_QUANTITY } from "./orderLine"
import { stockPatch, type ProductStockCount } from "./products"
import { requireStorePermission } from "./auth"
import { RefusalError } from "./refusal"

/* ------------------------------------------------------------------ */
/* Refusing an order                                                   */
/* ------------------------------------------------------------------ */

/**
 * Why the order as a whole was refused.
 *
 * The per-line reasons are `LineRejectionReason`; the delivery ones are
 * `ZoneRejectionReason` and `QuoteRejectionReason`; the coupon's are
 * `PromotionRejectionReason`. These are the refusals that belong to the order
 * itself — the establishment, the service, the shape of the basket.
 */
export type OrderRefusalCode =
  | "store_not_found"
  | "too_many_lines"
  | "store_not_published"
  | "store_not_accepting"
  | "outside_opening_hours"
  | "service_not_offered"
  | "line_without_product"
  | "product_not_found"
  | "product_wrong_store"
  | "quote_required"
  | "promotion_not_found"

/**
 * An order the establishment cannot take, refused so the diner can read why.
 *
 * Every message here used to be a plain `throw new Error`, which Convex redacts
 * in production: the checkout rendered "Server Error" at the moment of payment,
 * for every one of them. See `refusal.ts`. Three of them were also written in
 * English — they are the only copy on this path a diner could ever be shown, so
 * they are French now, like the rest of the storefront.
 */
export class OrderRefusedError extends RefusalError<OrderRefusalCode> {
  readonly reason: OrderRefusalCode

  constructor(
    reason: OrderRefusalCode,
    message: string,
    details?: Record<string, string | number>
  ) {
    super("OrderRefusedError", reason, message, details)
    this.reason = reason
  }
}

/**
 * Move the tracked stock an order's lines account for, by `direction`.
 *
 * `-1` sells it, `+1` gives it back. Both ends of the same rule, because they
 * have to agree about which lines count and how the same dish appearing on two
 * of them adds up: a basket holding one pizza with extra cheese and one without
 * is two lines and two portions.
 *
 * Only `stock.tracked` products, only one patch each, and never below zero.
 * `stockPatch` carries the auto-disable rule with it, so the last portion sold
 * takes the dish off the menu and the first one returned puts it back.
 */
async function moveTrackedStock(
  ctx: any,
  lines: Array<{ productId?: string; quantity: number }>,
  direction: 1 | -1,
  now: number
): Promise<void> {
  const byProduct = new Map<string, number>()
  for (const line of lines) {
    if (!line.productId) continue
    byProduct.set(line.productId, (byProduct.get(line.productId) ?? 0) + line.quantity)
  }

  for (const [productId, quantity] of byProduct) {
    const product = await ctx.db.get(productId)
    if (!product?.stock?.tracked) continue
    await ctx.db.patch(productId, {
      ...stockPatch(product, Math.max(0, product.stock.quantity + direction * quantity)),
      updatedAt: now,
    })
  }
}

/**
 * Did this order move stock the delivery platforms show as availability?
 *
 * `stock.quantity` is what `isProductOutOfStock` reads before suspending an
 * item on Uber Eats and what the Deliveroo availability delta is built from.
 * The Inventaire screen has booked a platform push on every stock edit since
 * the beginning; the order path started moving the same number and told nobody,
 * so a dish sold out on the restaurant's own site stayed orderable on the
 * platforms until some unrelated catalogue write happened to book a sync — and
 * there is no sweep to catch it, so that window has no end.
 *
 * Asked rather than assumed: most baskets hold no tracked dish at all, and a
 * full menu upload per order is a full menu upload per order.
 *
 * It lives here because the products are here; the push itself is booked by the
 * app wrapper, which is the only layer that can reach `internal.*`.
 */
export async function orderMovedTrackedStock(
  ctx: any,
  orderId: string
): Promise<boolean> {
  const order = await ctx.db.get(orderId)
  // A marketplace order never took any — see the cancellation branch.
  if (!order || isMarketplaceOrder(order.source)) return false

  const seen = new Set<string>()
  for (const line of order.items ?? []) {
    if (!line.productId || seen.has(line.productId)) continue
    seen.add(line.productId)
    const product = await ctx.db.get(line.productId)
    if (product?.stock?.tracked) return true
  }
  return false
}

/** The service, as a French sentence names it. */
const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  delivery: "la livraison",
  pickup: "le retrait sur place",
  dine_in: "la commande sur place",
}

// === QUERIES ===

/* ------------------------------------------------------------------ */
/* Who may read one order                                              */
/* ------------------------------------------------------------------ */

/**
 * The permission that already means "may read this store's orders".
 *
 * `list` and `getByStatus` are both wrapped in `storeQuery({ permission:
 * "orders:read" })` and both return whole order documents. Reusing the same
 * string here is the point: the staff branch of `getById` must not be able to
 * answer for anyone `list` would refuse, and must not need a permission of its
 * own that the role table would then have to grow.
 */
export const ORDER_READ_PERMISSION = "orders:read" as const

/**
 * Does the caller work at this restaurant, with the right to read its orders?
 *
 * WHY THIS EXISTS. `orders.getById` granted access on two questions only — "do
 * you hold this order's view token" and "did you place this order" — and had no
 * branch at all for the people who cook it. A guest order carries no
 * `customerId` (checkout stores `session?.user?.id`, which is `undefined` for a
 * guest), so both questions answered no for every member of staff, and
 * `/dashboard/orders/<id>` rendered "Commande introuvable" for the majority of
 * a restaurant's orders. Access was decided by "did you place this order",
 * never by "do you work here".
 *
 * It asks `requireStorePermission` rather than re-deriving the answer, so the
 * staff branch inherits the whole existing chain unchanged: the profile lookup,
 * the super admin's bypass, the `storeIds` membership check that keeps one
 * restaurant out of another's orders, the RBAC table, and the module
 * narrowing an owner sets on the invite dialog. A second implementation of that
 * chain is a second thing to keep in step, and the one place it would first
 * drift is the store scoping.
 *
 * Soft, like `isStaff`: `requireStorePermission` throws, which is right for a
 * screen that belongs to the administration and wrong for a query the storefront
 * shares. A guest reading their own order is not an error, so the refusal has to
 * come back as `false` and let the caller fall through to `null`. Every failure
 * — no session, no profile, wrong store, wrong role, module withheld — is a no.
 */
export async function mayReadStoreOrders(
  ctx: any,
  storeId: string
): Promise<boolean> {
  try {
    await requireStorePermission(ctx, storeId, ORDER_READ_PERMISSION)
    return true
  } catch {
    // Fail closed. Anything that is not an explicit grant is a refusal.
    return false
  }
}

/** Every status an order can hold, as the queries below accept it. */
const ORDER_STATUS = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("preparing"),
  v.literal("ready"),
  v.literal("out_for_delivery"),
  v.literal("delivered"),
  v.literal("completed"),
  v.literal("cancelled")
)

/**
 * One page of a store's orders, newest first, narrowed by status where asked.
 *
 * WHY IT IS PAGINATED. This returned every order the establishment had ever
 * taken, and it was the query behind both `/dashboard` and `/dashboard/orders`.
 * Measured on a seeded store: 5,000 orders in the table, 5,000 rows returned,
 * 3.07 MB on the wire. Convex aborts a transaction that reads more than 16,384
 * documents, so the two screens an owner opens most were on a path to throwing
 * on every load, permanently, with no admin action able to clear it. Worse,
 * both are live subscriptions: every new order re-serialised the restaurant's
 * whole order history to every open admin tab.
 *
 * `status` is an equality on `by_storeId_status_createdAt`, so the filter costs
 * the rows it returns rather than the rows it rejects, and both branches order
 * by the same field — a status tab that ordered by `_creationTime` printed a
 * Date column that was not monotonic as soon as a platform webhook arrived
 * late. `getByStatus` was this read with the filter mandatory and no caller; it
 * is folded in here rather than left as a second unbounded doorway onto the
 * same table.
 */
export const list = {
  args: {
    storeId: v.id("stores"),
    status: v.optional(ORDER_STATUS),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (
    ctx: any,
    args: {
      storeId: string
      status?: string
      paginationOpts: { numItems: number; cursor: string | null }
    }
  ) => {
    const page = clampPagination(args.paginationOpts)

    if (args.status) {
      return await ctx.db
        .query("orders")
        .withIndex("by_storeId_status_createdAt", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", args.status)
        )
        .order("desc")
        .paginate(page)
    }

    return await ctx.db
      .query("orders")
      .withIndex("by_storeId_createdAt", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .paginate(page)
  },
}

/**
 * The most orders `dashboardStats` will read in one transaction.
 *
 * The window is the real bound — the aggregates cover a month, not a lifetime —
 * and this is the ceiling under it, so an establishment that takes more orders
 * in a month than Convex will read in one transaction still gets a dashboard.
 * Ordered newest-first, so what a truncated read loses is the far end of the
 * 30-day breakdown; the today, yesterday and seven-day figures are the newest
 * rows and stay exact. The answer says `truncated` when it happens.
 */
export const DASHBOARD_ORDER_SCAN_LIMIT = 5_000

/**
 * The most customer rows « Taux de retour » will read in one transaction.
 *
 * One per distinct diner over the period, so far below the order cap: an
 * establishment taking 5,000 orders in a month has nothing like 5,000 separate
 * regulars. It is here so the two reads together stay well inside Convex's
 * 16,384-document ceiling however either of them grows.
 */
export const DASHBOARD_CUSTOMER_SCAN_LIMIT = 2_000

/**
 * Everything `/dashboard` renders, aggregated on the server.
 *
 * The page used to subscribe to `orders.list` — every order ever — and do this
 * arithmetic in the browser. See `dashboardStats.ts` for why the day boundaries
 * arrive as an argument rather than being derived here.
 */
export const dashboardStats = {
  args: {
    storeId: v.id("stores"),
    /** Local-midnight boundaries, ascending; the last one is today. */
    dayStarts: v.array(v.number()),
    /** Tomorrow's local midnight — the exclusive end of today. */
    todayEnd: v.number(),
    /** Start of the wider window the type/source breakdowns cover. */
    breakdownSince: v.number(),
  },
  handler: async (
    ctx: any,
    args: {
      storeId: string
      dayStarts: number[]
      todayEnd: number
      breakdownSince: number
    }
  ): Promise<DashboardStats> => {
    assertDayStarts(args.dayStarts, args.todayEnd)
    const windowStart = dashboardWindowStart(args)

    const rows = await ctx.db
      .query("orders")
      .withIndex("by_storeId_createdAt", (q: any) =>
        q.eq("storeId", args.storeId).gte("createdAt", windowStart)
      )
      .order("desc")
      .take(DASHBOARD_ORDER_SCAN_LIMIT + 1)

    const truncated = rows.length > DASHBOARD_ORDER_SCAN_LIMIT

    /*
     * The diners who ordered over the period, for « Taux de retour ».
     *
     * A SECOND READ RATHER THAN A DERIVATION FROM THE ORDERS. Whether a diner
     * came back is a question about their FIRST EVER order, which the orders in
     * this window cannot answer — a regular of two years and somebody's first
     * visit look identical inside a 30-day read. `customers.firstOrderAt` is
     * the fact, and `customers` is the table #364 built to hold it.
     *
     * BOUNDED TWICE, AND THE INDEX IS WHAT MAKES THE BOUND CHEAP. The range on
     * `by_storeId_lastOrderAt` already narrows the read to the diners who
     * ordered inside the period — that is what `lastOrderAt >= periodStart`
     * means — so `.take()` is a ceiling on a set that is already the right one,
     * not a sample of the whole book. A busy period reads as many customer rows
     * as there were distinct diners in it, and never more than the cap.
     */
    const periodStart = args.dayStarts[0] as number
    const customerRows = await ctx.db
      .query("customers")
      .withIndex("by_storeId_lastOrderAt", (q: any) =>
        q.eq("storeId", args.storeId).gte("lastOrderAt", periodStart)
      )
      .take(DASHBOARD_CUSTOMER_SCAN_LIMIT)

    return computeDashboardStats(
      rows.slice(0, DASHBOARD_ORDER_SCAN_LIMIT),
      { ...args, now: Date.now() },
      truncated,
      customerRows
    )
  },
}

/** How many orders the dashboard's "Dernières commandes" table shows. */
export const RECENT_ORDERS_LIMIT = 10

/**
 * The last handful of orders, for the dashboard's recent-orders table.
 *
 * The table used to be `orders.slice(0, 10)` over the entire history the page
 * had already downloaded. Ten rows are ten rows; this reads ten.
 */
export const recent = {
  args: { storeId: v.id("stores"), limit: v.optional(v.number()) },
  handler: async (ctx: any, args: { storeId: string; limit?: number }) => {
    // `clampPageSize` rather than `Math.min(Math.max(...))`: `v.number()`
    // accepts NaN over the wire, and NaN survives both of those to reach
    // `.take()`, which refuses it with an error naming an argument the caller
    // never sent.
    const limit = clampPageSize(args.limit, RECENT_ORDERS_LIMIT, 50)
    return await ctx.db
      .query("orders")
      .withIndex("by_storeId_createdAt", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .take(limit)
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

// REMOVED: `getByCustomer` collected one customer's entire order history from
// `by_customerId` with no window and no limit, and — like the app-level
// wrapper deleted before it — had no caller. The account page reads
// `getMyOrders`, which derives the customer from the session and pages.

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
  /** The VAT rate this line was priced at, as a percentage. */
  taxRatePercent?: number
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
  /** Dine-in only; rejected on the other two types. */
  tableNumber?: string
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
  /**
   * The weekly schedule, and whether this location follows the global one.
   *
   * Both were absent from this interface, which is how the order path came to
   * ignore them: the mutation could not read a field it had never declared.
   */
  hours?: BusinessHours[]
  useGlobalHours?: boolean
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
  /**
   * The rate a delivery charge carries. Unset means "not decided", and the fee
   * is then left out of the VAT breakdown rather than declared at the food's
   * rate — see `orderTotals.deliveryTaxRatePercent`.
   */
  deliveryTaxRate?: number
  timezone?: string
  /** The deployment-wide week, for every location on `useGlobalHours`. */
  hours?: BusinessHours[]
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
    /**
     * Which table a `dine_in` order is served to.
     *
     * Optional even for `dine_in`: the platform webhooks forward `dine_in`
     * orders that carry no table of their own, and refusing those would lose
     * the order. The storefront makes it required, because that is the one
     * place a diner is demonstrably sitting at a table.
     */
    tableNumber: v.optional(v.string()),
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
      if (existing) {
        // A retry on the same attempt may carry a different payment method:
        // the natural first-order path on a store with no card provider is a
        // failed card submit followed by a cash confirmation, and the reuse
        // used to keep "card". From there nothing could ever settle the order
        // — release refused it as an unpaid card order, and the admin's cash
        // button only shows for cash — so a confirmed diner sat in front of an
        // accepted order the kitchen never saw (#374). The diner's last
        // confirmed choice is the truth, but only while the payment is still
        // pending: once money has moved (paid, refunded, even failed), the
        // stored method describes what actually happened and stays.
        // `createWithTicket` re-runs `releaseToKitchen` right after this
        // returns, which is what re-applies the method-dependent release rule
        // to the reused order.
        if (
          args.paymentMethod &&
          args.paymentMethod !== existing.paymentMethod &&
          (existing.paymentStatus === "pending" ||
            existing.paymentStatus === undefined)
        ) {
          // …but never once the pass has seen it. A cash order releases its
          // ticket at creation, so a stale tab retrying the same attempt as
          // card would flip a cooking, unpaid order to a method whose release
          // is refused and whose cash button is gone — the very strand this
          // branch exists to remove, rebuilt in the other direction. The
          // method the kitchen was fed under is the one that stands; a diner
          // who really wants to switch can retry again while nothing cooks.
          const ticket = await ctx.db
            .query("kitchenTickets")
            .withIndex("by_orderId", (q: any) => q.eq("orderId", existing._id))
            .first()
          if (!ticket) {
            await ctx.db.patch(existing._id, {
              paymentMethod: args.paymentMethod,
              updatedAt: now,
            })
          }
        }
        return existing._id
      }
    }

    // Get store and global settings for tax rate and delivery config
    const store = await ctx.db.get(args.storeId) as StoreDoc | null
    if (!store) {
      throw new OrderRefusedError(
        "store_not_found",
        "Ce restaurant n'existe plus. Rechargez la page pour en choisir un autre."
      )
    }

    // Public by design — a guest checks out without a session — and until now
    // nothing bounded it: `customerInfo.name` and the two `notes` fields were
    // unbounded strings, so one request could store a megabyte. Checked here,
    // before any of the work below, because rejecting an oversized payload
    // should cost nothing.
    assertFieldLengths({
      name: args.customerInfo.name,
      email: args.customerInfo.email,
      phone: args.customerInfo.phone,
      // `orderNote`, not `message`: the note is a sentence to a cook printed
      // on an 80mm slip, not a contact-form body. It was capped at the
      // latter's 5 000 characters because this mutation had no cap of its own
      // and there was no field on the storefront that could reach it.
      orderNote: args.notes,
    })

    // Every other string a caller controls. The four above were capped first
    // and the rest were not, which left the megabyte they were meant to stop
    // arriving through `deliveryAddress.street` and `items[].notes` instead —
    // measured at just over 1 MB per stored row. `items` is itself an
    // unbounded array, so the cap on it is what stops 500 lines becoming one
    // enormous document; `productName` is re-read from the catalogue below and
    // never trusted, but it is bounded here so the argument cannot be the
    // payload either.
    if (args.items.length > MAX_ORDER_LINES) {
      throw new OrderRefusedError(
        "too_many_lines",
        `Une commande ne peut pas dépasser ${MAX_ORDER_LINES} lignes.`
      )
    }
    if (args.deliveryAddress) {
      assertFieldLengths({
        street: args.deliveryAddress.street,
        city: args.deliveryAddress.city,
        postalCode: args.deliveryAddress.postalCode,
        country: args.deliveryAddress.country,
        instructions: args.deliveryAddress.instructions,
      })
    }
    for (const line of args.items) {
      assertFieldLengths({ name: line.productName, lineNote: line.notes })
    }

    // A draft establishment is not a storefront. Keeping drafts out of
    // `stores.list` is how one stops being *reachable*; this is what stops one
    // being *ordered from* — a tab left open before the owner unpublished it, a
    // store id persisted in localStorage, or a direct call all skip the list.
    // The kitchen behind a draft is not waiting for tickets.
    if (!isPublishedStore(store)) {
      throw new OrderRefusedError(
        "store_not_published",
        "Ce restaurant ne prend pas encore de commandes en ligne."
      )
    }

    // `closed` and `temporarily_unavailable` are the two ways an owner says
    // "not tonight" from the dashboard. They keep the restaurant listed and its
    // menu readable — that is what publication buys — and the storefront
    // already greys out every button. Only the browser did: the mutation took
    // the order, and a stale tab, a cart restored from localStorage or a direct
    // call reached it with no page in between.
    if (!isOrderableStore(store)) {
      throw new OrderRefusedError(
        "store_not_accepting",
        "Ce restaurant ne prend pas de commandes pour le moment."
      )
    }

    // Read once, before the items: the serving window of a dish is a question
    // about the clock in the kitchen, and that clock is a global setting. So is
    // the fallback VAT rate, for a product that predates the per-product one.
    const globalSettings = await ctx.db.query("globalSettings").first() as GlobalSettingsDoc | null
    const deliveryConfig = globalSettings?.delivery

    // The weekly schedule, enforced for the first time. `isOrderableStore`
    // above answers only for the status an owner set by hand; the hours are the
    // gate restaurants actually rely on, and until now the only thing honouring
    // them was a `toast.error` on the checkout page. A tab left open past
    // closing, a cart restored from localStorage or a direct call each bought a
    // kitchen ticket at 4 a.m. in an empty building.
    //
    // Read here, after `globalSettings`, because both halves of the answer live
    // there: which week governs (`useGlobalHours` may point at the global one)
    // and the clock it is read on. `isWithinBusinessHours` is the same function
    // the storefront's `useStoreStatus` calls, so the two cannot drift.
    if (
      !isWithinBusinessHours(
        resolveStoreHours(store, globalSettings),
        now,
        globalSettings?.timezone
      )
    ) {
      throw new OrderRefusedError(
        "outside_opening_hours",
        "Ce restaurant est fermé pour le moment. Revenez à ses heures d'ouverture."
      )
    }

    // The four service switches were enforced nowhere. The selector treated an
    // absent store override as "offer everything", and this mutation never
    // looked at `args.type`, so a restaurant that does not deliver took
    // delivery orders — including from a cart whose type was persisted before
    // the owner turned the service off.
    if (!isOrderTypeOffered(args.type, resolveStoreServices(store, globalSettings))) {
      throw new OrderRefusedError(
        "service_not_offered",
        `Ce restaurant ne propose pas ${ORDER_TYPE_LABEL[args.type]}.`,
        { orderType: args.type }
      )
    }

    // A table number belongs to a dine-in order and nowhere else. Rejecting it
    // on the other two types is not pedantry: it catches the order whose type
    // was switched after the table was entered, which would otherwise print a
    // table on a delivery ticket and send a courier looking for it.
    const tableNumber = normalizeTableNumber(args.tableNumber)
    if (tableNumber !== undefined && args.type !== "dine_in") {
      throw new Error("A table number can only be set on a dine_in order")
    }
    if (!isValidTableNumber(tableNumber)) {
      throw new Error(
        `Table number must be at most ${MAX_TABLE_NUMBER_LENGTH} characters`
      )
    }

    // Only now, past every reason an order can be refused. The window is the
    // restaurant's, and a slot spent on a request that was never going to
    // become an order would let a loop of invalid ones exhaust it and refuse
    // the real customer behind them — turning a limiter meant to protect the
    // restaurant into a way to close its till. So it is consumed once the
    // order is admissible and about to do work, and a generous window at that:
    // prices, options and discounts are already recomputed server-side, so
    // what is left to bound is database and kitchen-ticket noise, not value.
    // After the idempotency check too, so a retried checkout spends nothing.
    await consumeRateLimit(ctx, "orderPerStore", args.storeId)

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
    // Every tracked dish this basket takes, and how many of it.
    //
    // Two lines can name the same product — one pizza with extra cheese, one
    // without — and each was verified on its own against the stored quantity,
    // so a stock of 3 accepted 2 + 2. The running total is what the guard is
    // checked against below, and what is sold off the counter after the insert.
    const soldStock = new Map<
      string,
      {
        product: { _id: unknown; stock: ProductStockCount; isActive: boolean }
        ordered: number
      }
    >()
    // How long this basket takes to cook — the longest line, not the sum,
    // because a kitchen cooks in parallel. Same rule as `summariseOrderLines`,
    // accumulated here because this loop already has every product in hand and
    // a second pass would be one `db.get` per line for a number we can add up
    // as we go.
    //
    // It goes on the ORDER, not only on the kitchen ticket. The confirmation
    // email reads `order.estimatedPrepTime` and the ticket is a different
    // document, so « Prête dans environ 20 minutes » had never once printed —
    // for any order, since the line was written (#413).
    let longestPrepTime = 0
    for (const item of args.items) {
      if (!item.productId) {
        throw new OrderRefusedError(
          "line_without_product",
          "Votre Box contient un article invalide. Videz-la et recommencez."
        )
      }

      // The ids stay in `details`, out of the sentence: they are for a log, and
      // a customer cannot act on one.
      const product = await ctx.db.get(item.productId)
      if (!product) {
        throw new OrderRefusedError(
          "product_not_found",
          "Un article de votre Box n'existe plus. Retirez-le pour continuer.",
          { productId: item.productId }
        )
      }
      if (product.storeId !== args.storeId) {
        throw new OrderRefusedError(
          "product_wrong_store",
          "Votre Box contient un article d'un autre restaurant. Videz-la et recommencez.",
          { productId: item.productId }
        )
      }

      // What is left of this dish once the earlier lines of this same basket
      // have taken their share. Without it the sold-out guard is per line, and
      // a basket is not a line.
      const alreadySold = soldStock.get(item.productId)?.ordered ?? 0
      const remaining =
        product.stock?.tracked && alreadySold > 0
          ? {
              ...product,
              stock: {
                ...product.stock,
                quantity: product.stock.quantity - alreadySold,
              },
            }
          : product

      // Availability, quantity, options and price all resolve in `orderLine`,
      // pure and tested, because each refusal is the difference between an
      // order the kitchen can cook and one it cannot.
      const line = verifyOrderLine({
        product: remaining,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions,
        now,
        timezone: globalSettings?.timezone,
      })

      if (product.stock?.tracked) {
        soldStock.set(item.productId, {
          product,
          ordered: alreadySold + line.quantity,
        })
      }

      if (typeof product.preparationTime === "number") {
        longestPrepTime = Math.max(longestPrepTime, product.preparationTime)
      }

      verifiedItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        selectedOptions: line.selectedOptions,
        subtotal: line.subtotal,
        // The rate this line was actually taxed at, kept on the line. It was
        // read from `products.taxRate` and never recorded, so a product retaxed
        // afterwards would restate the VAT on an invoice already issued.
        taxRatePercent:
          typeof product.taxRate === "number" ? product.taxRate : taxRatePercent,
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
          throw new OrderRefusedError(
            "quote_required",
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
      if (!promotion) {
        throw new OrderRefusedError(
          "promotion_not_found",
          "Ce code promo n'existe pas."
        )
      }

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

    // What is charged, and what of it is tax. One call, after the discount is
    // known.
    //
    // The tax used to be computed twice — once before the discount for a
    // `taxAmount` that was stored, and again afterwards for the `total`. The
    // comment on the first call said it ran early "because the promotion
    // resolver is told what the order is worth, tax included", and the resolver
    // takes `subtotal`; nothing read the early figure but the database. So the
    // order recorded the VAT contained in the FULL basket while the customer
    // paid the discounted one — an over-declaration, harmless on a summary and
    // not harmless on the invoice now issued from it.
    //
    // The breakdown is kept as well as the total. It was computed and thrown
    // away, which left the order unable to say what it had charged at each
    // rate — the one thing a receipt and an invoice both have to state.
    const { total, taxAmount, taxBreakdown } = computeOrderTotals({
      subtotal,
      taxRatePercent,
      lines: taxedLines,
      deliveryFee,
      deliveryTaxRatePercent: globalSettings?.deliveryTaxRate,
      discount,
    })

    // Sequential, per establishment, per year — and allocated inside this
    // mutation, which is what makes it gapless: if anything below throws, the
    // whole transaction is discarded and the number goes to the next order
    // rather than being burned.
    const orderNumber = await allocateOrderNumber(ctx, args.storeId, {
      now,
      timezone: globalSettings?.timezone,
    })

    // Generate view token for public order confirmation access
    const viewToken = crypto.randomUUID()

    const orderId = await ctx.db.insert("orders", {
      storeId: args.storeId,
      orderNumber,
      customerId: args.customerId,
      customerInfo: args.customerInfo,
      /* The key the customer book is written under (#364).
       *
       * Derived rather than a second copy of the truth: `customerInfo.email`
       * stays exactly as the diner typed it, because that is what a
       * confirmation is sent to and what an invoice shows. An index is on
       * stored bytes, so a lookup by the normalised key needs the normalised
       * key stored. `undefined` when the order carries no e-mail — a cash
       * walk-in is not a person the book can hold. */
      customerEmailKey: customerKey(args.customerInfo.email) ?? undefined,
      type: args.type,
      tableNumber,
      status: "pending",
      items: verifiedItems,
      subtotal,
      taxAmount,
      // Empty when nothing is taxed; stored as undefined rather than [] so
      // "no rate applied" and "written before the field existed" read alike.
      taxBreakdown: taxBreakdown.length > 0 ? taxBreakdown : undefined,
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
      // Undefined when no product in the basket declares one: the email then
      // prints no timing row, which is honest, rather than "environ 0 minutes".
      estimatedPrepTime: longestPrepTime > 0 ? longestPrepTime : undefined,
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
    // Sell the stock this order just took.
    //
    // `orderLine` has refused a sold-out dish since P0-09, and the refusal was
    // unreachable: NOTHING moved `stock.quantity` except an owner retyping it
    // in the Inventaire screen. A restaurant tracking ten portions of the daily
    // special sold fifty and found out in the kitchen. `autoDisableWhenEmpty`
    // hung off the same manual mutation, so a dish that ran out never came off
    // the menu on its own either — hence `stockPatch`, shared with `updateStock`
    // so the rule has one implementation.
    //
    // Here rather than in a scheduled job: a Convex mutation is one
    // transaction, so the order, its kitchen ticket and this decrement commit
    // together or not at all, and two checkouts racing for the last portion are
    // serialised by the same read-write conflict that protects the promotion
    // counter below. Split across transactions, both would read 1 and both
    // would sell it.
    //
    // Floored at zero: the guard above makes an oversell unreachable, and a
    // negative count would read as "minus two portions" on every screen that
    // shows it if it ever became reachable again.
    await moveTrackedStock(
      ctx,
      [...soldStock.entries()].map(([productId, { ordered }]) => ({
        productId,
        quantity: ordered,
      })),
      -1,
      now
    )

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
      // Two members of staff pressing the same button is not a second payment,
      // and not a second receipt either.
      return { paymentId: null, confirmation: null }
    }
    if (order.paymentStatus === "refunded" || order.paymentStatus === "partially_refunded") {
      throw new Error("Cette commande a déjà été remboursée.")
    }
    // `refund_pending` means the order was paid and then cancelled: the money
    // is owed back and the real refund has not been made yet. Taking cash again
    // would insert a second payment and reset the flag to "paid", quietly
    // erasing the refund the customer is still waiting for.
    if (order.paymentStatus === "refund_pending") {
      throw new Error(
        "Cette commande est annulée et en attente de remboursement."
      )
    }

    // The order's own status is not the whole truth, and this is the third
    // writer that used to trust it alone. A settlement writes the payment row
    // and the order status in two transactions, so between them an order reads
    // `pending` with a `succeeded` row already against it — and the four
    // checks above would wave the notes through, leaving one meal collected
    // twice with nothing anywhere saying so (#411). `collectionOnOrder` asks
    // the ledger, which is where the answer actually is.
    const alreadyCollected = await collectionOnOrder(ctx, args.orderId)
    if (alreadyCollected) {
      throw new Error(
        `Cette commande a déjà été encaissée (${alreadyCollected.provider}).`
      )
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

    // Cash is a payment path like any other, and the kitchen learns about an
    // order when it is paid for. Missing this call is how the cash branch used
    // to be the one that never reached the pass.
    await releaseToKitchen(ctx, args.orderId)

    // The sale is definitive, so it gets its invoice — in this transaction,
    // which is what keeps the series gapless.
    await issueInvoiceForOrder(ctx, args.orderId, { now })

    // And so does the diner. Same seam, same reason: the confirmation belongs
    // where "this order has been paid for" is decided, not in each wrapper.
    const confirmation = await planOrderConfirmation(ctx, args.orderId)

    return { paymentId, confirmation }
  },
}

/**
 * Record a payment outcome, and let the kitchen know when it is good news.
 *
 * Every card path lands here — the Stripe webhook, the Stripe success-page
 * verify, the PayPal capture, the SumUp verify — which is precisely why the
 * release lives here rather than in four wrappers that each have to remember.
 * Both apps' `internalUpdatePaymentStatus` are transport over this.
 */
export const recordPaymentStatus = {
  args: {
    id: v.id("orders"),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      // Mirrors the `orders.paymentStatus` union in the shared schema. Money
      // owed back that has not moved yet — see `tables/orders.ts`.
      //
      // Not decorative: the four provider paths ask
      // `paymentStatusAfterSettlement` what a settlement should do to the
      // order, and it answers `"refund_pending"` whenever the money arrives
      // for an order that has already been cancelled. That value is handed
      // straight to this validator. Omitting the literal would reject the
      // call, which for the Stripe webhook is a 500 and three days of retries,
      // and for a guest on the success page is an error on their own
      // confirmation screen — over an order the code had understood correctly.
      v.literal("refund_pending"),
      v.literal("refunded"),
      v.literal("partially_refunded")
    ),
  },
  handler: async (
    ctx: any,
    args: { id: string; paymentStatus: string }
  ): Promise<OrderConfirmationDispatch | null> => {
    await ctx.db.patch(args.id, {
      paymentStatus: args.paymentStatus,
      updatedAt: Date.now(),
    })

    if (args.paymentStatus !== "paid") return null

    await releaseToKitchen(ctx, args.id)

    // Every card path lands here, so the invoice is issued here rather than in
    // the four provider wrappers. Idempotent through `order.invoiceId`, which
    // is what a replayed webhook racing the success page needs it to be, and
    // allocated inside this transaction so a failure burns no number.
    await issueInvoiceForOrder(ctx, args.id)

    // The diner gets told at the same seam the kitchen does, and for the same
    // reason: four provider paths land here, and a rule that lives in one
    // caller is a rule the other three skip.
    //
    // Returned rather than sent: this layer has no `internal.*` to schedule
    // with. `planOrderConfirmation` has already claimed the send on the order,
    // so a replayed webhook reaching here a second time returns null and the
    // diner gets one confirmation, not one per settlement attempt.
    return await planOrderConfirmation(ctx, args.id)
  },
}

// `isMarketplaceOrder` and the source list it reads now live in
// `./orderSource`, so `invoices.ts` can ask the same question without the two
// files importing each other. Re-exported here because that is where every
// caller and the package barrel already look for it.
export { MARKETPLACE_ORDER_SOURCES, isMarketplaceOrder } from "./orderSource"


/**
 * What cancelling an order must write to `paymentStatus` — or nothing at all.
 *
 * `refund_pending` means one thing: the restaurant is holding money it owes
 * back. Only a paid DIRECT order qualifies. Cancelling a marketplace order used
 * to raise the same flag, so the admin showed the restaurant an amber
 * "remboursement dû" banner and a refund button for money it never received and
 * cannot send — while Deliveroo had already refunded the customer itself.
 *
 * Both cancellation paths ask this function, so they cannot drift apart again.
 */
export function cancellationPaymentStatus(order: {
  source?: unknown
  paymentStatus?: unknown
}): "refund_pending" | undefined {
  if (order.paymentStatus !== "paid") return undefined
  if (isMarketplaceOrder(order.source)) return undefined
  return "refund_pending"
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

      // Give the kitchen back what the order took.
      //
      // `orders.create` sells tracked stock now, and until this existed the
      // sale was one-way: a restaurant that cancelled three orders was left
      // showing three portions it still had, and `autoDisableWhenEmpty` could
      // leave the dish off the menu with a full tray behind the counter.
      //
      // Once only, and this is why `cancelled` being terminal matters: it is
      // reachable from `pending` and `confirmed` alone, a replayed status
      // returns above before reaching here, and nothing leaves it. Marketplace
      // orders are skipped because they never took any — `createFromWebhook`
      // has no stock path, the platform keeps its own count, and crediting one
      // here would invent stock the restaurant does not have.
      if (!isMarketplaceOrder(order.source)) {
        await moveTrackedStock(ctx, order.items ?? [], 1, now)
      }

      // Give the coupon back too. The stock was restored here and the promotion
      // was not, so a cancelled couponed order burned the diner's one use and a
      // slot of the campaign's budget on an order that did not happen — with no
      // screen anywhere to correct either number.
      //
      // Once only, for the same reason the stock restore is: `cancelled` is
      // terminal, reachable from `pending` and `confirmed` alone, and a replayed
      // status returns above before reaching here. A marketplace order carries
      // no promotion — `createFromWebhook` has no promotion path — so this is a
      // no-op there rather than a special case.
      await releasePromotionForOrder(ctx, order, now)

      // Cancelling an order does not move money, and must not claim to.
      //
      // This block used to set the order AND every succeeded payment to
      // "refunded" with a bare `ctx.db.patch` — no Stripe, SumUp or PayPal call
      // anywhere. The restaurant read "remboursé", the customer was never paid
      // back, and the gap only surfaced at reconciliation or in a dispute.
      //
      // It was also irreversible. `planRefund` accepts only "succeeded" and
      // "partially_refunded", so once the payment had been faked to "refunded"
      // the real action — `payments.refundPayment` — threw `not_settled` and
      // the money could never be returned at all. The fake refund permanently
      // blocked the real one. And `orders:update_status` is held by the KITCHEN
      // and DELIVERY roles, so a line cook could trigger it.
      //
      // The payment rows are therefore left exactly as they are: `succeeded`,
      // refundable, and still true. The order is flagged `refund_pending` —
      // which records that money is owed back, not that it was sent — and an
      // operator drives the real refund through `payments.refundPayment`, which
      // calls the provider first and records the outcome only once the money
      // has actually moved.
      //
      // No auto-refund is scheduled here on purpose. Refunding is a decision
      // (full or partial, which payment, out-of-band cash) and it carries
      // `payments:refund`, which the roles that cancel orders do not hold.
      //
      // And only for an order the restaurant was actually paid for. A rejected
      // Deliveroo order reaches this exact line — `deliverooWebhook`'s
      // auto-reject calls `internalUpdateStatus` — and it has no `payments`
      // row at all, because Deliveroo took the money and Deliveroo gives it
      // back. Flagging that one `refund_pending` demanded a refund the
      // restaurant could not send.
      const owed = cancellationPaymentStatus(order)
      if (owed) {
        updates.paymentStatus = owed
      }
    }

    await ctx.db.patch(args.id, updates)

    // Staff accepting the order *is* the manual confirmation workflow, so this
    // releases it whatever `orderConfirmation` says — the setting describes
    // what happens without a human, and a human has just acted.
    //
    // `confirmed` is reachable exactly once, and only from `pending`, so this
    // cannot double-release; `releaseToKitchen` refuses a second time anyway.
    if (args.status === "confirmed") {
      await releaseToKitchen(ctx, args.id, { force: true })
    }

    if (args.status === "cancelled") {
      await cancelKitchenTicketsForOrder(ctx, args.id, now)
    }

    // Carry the order through to the marketing side.
    //
    // `updateMetadataIncremental` was written for exactly this and had no
    // caller anywhere — so `totalOrders`, `totalSpent` and `lastOrderAt` were
    // never written, and a segment built on order history matched nobody. The
    // owner could save "clients ayant dépensé plus de 100 €", attach it to a
    // campaign and send to zero people, with no error to explain it.
    //
    // Here rather than in an app wrapper, for the same reason
    // `createWithTicket` puts the kitchen ticket here: nearly every path into a
    // status change goes through this handler — the admin, the payment
    // confirmation, the schedulers — and a rule that lives in one caller is a
    // rule the others skip.
    //
    // The exception, and it is the one that bit: `updateFromWebhook` is a
    // SEPARATE handler. A platform cancellation never reaches this code. This
    // comment used to name "the Deliveroo webhooks" among the callers, which
    // was simply untrue, and the cost of believing it was a kitchen ticket that
    // stayed live on the pass after Uber cancelled the order — the kitchen
    // cooking and bagging something that no longer existed. Ticket cancellation
    // is now `cancelKitchenTicketsForOrder`, called from both.
    //
    /*
     * « Votre commande est prête » (#96).
     *
     * HERE, NOT IN A CALLER, for the reason the block above gives: nearly every
     * path into a status change goes through this handler, and a rule that lives
     * in one caller is a rule the others skip. The kitchen display marks a ticket
     * ready through `kitchenTickets`, which advances the order through here.
     *
     * `planOrderReady` claims the send transactionally, so the `ready`
     * transition being reached twice — a second station finishing, a status
     * corrected back and forward — puts one email in the inbox and not two. It
     * refuses a delivery order outright: « prête » there means the food left the
     * kitchen, and telling the diner to come and collect it would be wrong.
     *
     * `readSubscriberStanding` is passed in rather than imported by `orderReady`
     * so that module stays free of any dependency on the marketing tables' shape
     * — the same split `planOrderConfirmation` uses.
     */
    const readyDispatch =
      to === "ready"
        ? await planOrderReady(ctx, args.id, readSubscriberStanding)
        : null

    // Counted on entering `confirmed`, which the state machine allows exactly
    // once and only from `pending`, so no retry double-counts. Given back on
    // `confirmed -> cancelled`, which it also allows.
    const postOrder = await syncSubscriberOrderMetadata(ctx, order, from, to, now)

    // Both, because a status change can owe two different sends and the wrapper
    // is the only place that can name a function to schedule. `undefined` on
    // either side is the ordinary case.
    if (readyDispatch) {
      return { ...(postOrder ?? {}), ready: readyDispatch } as PostOrderDispatch & {
        ready: { orderId: string }
      }
    }
    return postOrder
  },
}

/**
 * Update the denormalised order history for a status change.
 *
 * TWO BOOKS, AND THE DIFFERENCE BETWEEN THEM IS CONSENT (#364).
 *
 * `emailSubscribers.metadata` is the MARKETING history, and it is silent for
 * anyone who is not a subscriber — the lookup inside
 * `updateMetadataIncremental` skips them, and this must never create one: an
 * order is a purchase, not consent to be marketed to. `source: "order"` exists
 * in the schema for that decision; taking it is not this function's to make.
 *
 * `customers` is the establishment's own book of who bought from it, and that
 * one IS created here. It records a fact the restaurant already holds in
 * `orders` — this person, this often, this much — which is the trade record
 * every business keeps. It creates no subscriber, it is not a segment, and the
 * campaign sender does not read it.
 *
 * Both on the same transitions, from the same caller, so the two cannot answer
 * the same question differently.
 *
 * Silent for an order with no e-mail, in both books. A cash walk-in who gave a
 * first name has no contact, and an address-book entry that cannot be addressed
 * is worse than an honest count — `customers.anonymousOrderCount` is how the
 * screen says how many those are.
 */
async function syncSubscriberOrderMetadata(
  ctx: any,
  order: any,
  from: OrderStatus,
  to: OrderStatus,
  now: number
): Promise<PostOrderDispatch | undefined> {
  const email = order.customerInfo?.email
  if (!email) return undefined

  const productIds = (order.items ?? [])
    .map((item: { productId?: string }) => item.productId)
    .filter((id: string | undefined): id is string => Boolean(id))

  if (to === "confirmed") {
    /*
     * Stamp the derived key here rather than only at creation.
     *
     * `customerKey` is what the customer detail view looks an order up by, and
     * writing it at the two `insert("orders", …)` sites means it is correct
     * only for as long as nobody adds a third. A platform order arriving from
     * the Uber Eats or Deliveroo webhook path, a seed, a manual repair — each
     * one is an order the Clients screen would show a total for and no orders
     * behind it, which reads as data loss rather than as a missing field.
     *
     * Every order that counts passes through this transition, so stamping it
     * here is the one place that cannot be forgotten. It is a no-op when the
     * key is already right, which is the ordinary case.
     */
    const key = customerKey(email)
    if (key && order.customerEmailKey !== key) {
      await ctx.db.patch(order._id, { customerEmailKey: key })
    }

    await recordCustomerOrder.handler(ctx, {
      storeId: order.storeId,
      email,
      name: order.customerInfo?.name,
      phone: order.customerInfo?.phone,
      orderAmount: order.total,
      orderType: order.type,
      productIds,
      orderedAt: now,
    })
    await updateMetadataIncremental.handler(ctx, {
      storeId: order.storeId,
      email,
      orderAmount: order.total,
      orderType: order.type,
      productIds,
      orderedAt: now,
    })

    // Who the post-order automation should reach, if anyone. Returned rather
    // than scheduled here: this package has no `_generated`, so a shared
    // handler cannot name a function to schedule. The app wrapper does that —
    // the same split `confirmDoubleOptIn` uses.
    const subscriber = await ctx.db
      .query("emailSubscribers")
      .withIndex("by_storeId_email", (q: any) =>
        q.eq("storeId", order.storeId).eq("email", email.toLowerCase())
      )
      .first()

    return subscriber
      ? {
          storeId: order.storeId as string,
          subscriberId: subscriber._id as string,
          orderId: String(order._id),
        }
      : undefined
  }

  if (from === "confirmed" && to === "cancelled") {
    await reverseCustomerOrder.handler(ctx, {
      storeId: order.storeId,
      email,
      orderAmount: order.total,
    })
    await reverseMetadataIncremental.handler(ctx, {
      storeId: order.storeId,
      email,
      orderAmount: order.total,
    })
  }

  return undefined
}

/** Whom a confirmed order should start a post-order automation for. */
export interface PostOrderDispatch {
  storeId: string
  subscriberId: string
  orderId: string
}

/**
 * Delete an order, and everything that only existed because of it.
 *
 * This was `ctx.db.delete(args.id)` with nothing else in the handler, against a
 * row three tables reference REQUIRED. What it refuses, what it carries away
 * and why each is on the side it is on: `orderCascade.ts`.
 *
 * No screen calls this today. That is the reason to guard it now rather than
 * later — it is live under `orders:delete`, and the person who wires the first
 * button to it will not be reading this file.
 */
export const remove = {
  args: { id: v.id("orders") },
  handler: async (ctx: any, args: { id: string }) => {
    const order = await ctx.db.get(args.id)
    // Already gone. Not an error: a retried call must not fail louder than the
    // first one succeeded.
    if (!order) return

    await assertOrderHasNoInvoice(ctx, order)
    await assertOrderHasNoLivePayment(ctx, order)

    await deleteOrderDependents(ctx, order, Date.now())
    await ctx.db.delete(args.id)
  },
}

// === Webhook types ===

interface WebhookItemModifier {
  externalId: string
  name: string
  price: number
  /** "double cheese" is one modifier at quantity 2. Absent means 1. */
  quantity?: number
}

interface WebhookItem {
  externalId: string
  name: string
  quantity: number
  price: number
  modifiers?: WebhookItemModifier[]
  /** Special instructions and allergies, as the platform's mapper found them. */
  notes?: string
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
        // "double cheese" is one modifier at quantity 2. Absent means 1. The
        // validator had no field for it, so the quantity was dropped at the
        // door and the extra was charged once however many were ordered.
        quantity: v.optional(v.number()),
      }))),
      // "allergie arachides — sauce à part". The Uber Eats mapper computes
      // this (`uber-eats/mappers.ts`, `special_instructions` then
      // `customer_request.allergy.instructions`), and a validator with no
      // field for it rejected the whole call — so the webhook passed
      // `notes: undefined` instead and the kitchen never saw it. This is a
      // food-safety path.
      notes: v.optional(v.string()),
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
    //
    // Read through `by_external_order`, never `.filter()`. A filter is a full
    // table scan, and Convex aborts a transaction that reads more than ~16k
    // documents: past that many orders every delivery webhook would start
    // failing at once, permanently, with no alert. The index narrows this to
    // the handful of rows sharing one external id, so the source check below
    // runs over 1-2 documents rather than the whole table.
    const existing =
      (
        await ctx.db
          .query("orders")
          .withIndex("by_external_order", (q: any) =>
            q.eq("externalOrderId", args.externalOrderId)
          )
          .collect()
      ).find((o: any) => o.source === source) ?? null
    if (existing) {
      // Idempotent: duplicate webhook (Uber/Deliveroo retry). Signal the caller
      // so it does NOT create a second kitchen ticket or re-run auto-accept.
      return { orderId: existing._id, created: false }
    }

    const now = Date.now()
    const globalSettings = await ctx.db.query("globalSettings").first()
    const orderNumber = await allocateOrderNumber(ctx, args.storeId, {
      now,
      timezone: globalSettings?.timezone,
    })

    const mappedItems = args.items.map((item: WebhookItem) => {
      const modifierTotal = item.modifiers?.reduce(
        (sum: number, mod: WebhookItemModifier) =>
          sum + mod.price * Math.max(0, Math.trunc(mod.quantity ?? 1)),
        0
      ) ?? 0
      // A platform is not a trusted source of arithmetic any more than a
      // browser is. `MAX_LINE_QUANTITY` is the same ceiling the storefront uses.
      const safeQuantity = Math.min(
        MAX_LINE_QUANTITY,
        Math.max(0, Math.trunc(item.quantity))
      )
      return {
        productName: item.name,
        quantity: safeQuantity,
        unitPrice: item.price,
        selectedOptions: item.modifiers?.map((mod: WebhookItemModifier) => ({
          optionName: mod.name,
          choiceName: mod.name,
          priceModifier: mod.price,
        })) ?? [],
        // Modifiers are priced PER UNIT, then multiplied — the same arithmetic
        // `verifyOrderLine` applies to a storefront line. Two of a burger with
        // cheese is two lots of cheese.
        //
        // This used to read `item.price * item.quantity + modifierTotal`, which
        // charged for exactly one modifier however many units were ordered, so
        // the identical basket cost less through Uber Eats than through the
        // website. The test that covered it asserted the wrong total.
        //
        // The clamps match `verifyOrderLine` too, and for its reasons: a
        // removal discount ("sans fromage, −0,50 €") larger than the dish would
        // otherwise make the line negative and pay for the rest of the basket,
        // and a non-integer or absurd quantity would price straight through.
        // The storefront refused all three; this path did not, so the same
        // hostile input was worth more coming from a platform.
        subtotal: Math.max(0, item.price + modifierTotal) * safeQuantity,
        externalId: item.externalId,
        notes: item.notes,
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
      // A platform order carries a person too — Uber Eats and Deliveroo both
      // send one — so it belongs in the book on the same terms.
      customerEmailKey: customerKey(args.customerEmail) ?? undefined,
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

    // Indexed, for the same reason as `createFromWebhook`: a status update
    // arrives for every order on every platform, so a scan here is the busiest
    // scan in the product.
    const order =
      (
        await ctx.db
          .query("orders")
          .withIndex("by_external_order", (q: any) =>
            q.eq("externalOrderId", args.externalOrderId)
          )
          .collect()
      ).find((o: any) => o.source === source) ?? null

    if (!order) {
      throw new Error(`Order not found: ${args.externalOrderId}`)
    }

    const from = order.status as OrderStatus
    const to = args.status as OrderStatus

    // What the platform is telling us, and whether it can be acted on.
    //
    // Two different mistakes were possible here and the first version made the
    // second one. Writing every status unconditionally dragged live orders
    // backwards. Applying the outbound transition table to an inbound
    // notification silently dropped genuine cancellations for anything past
    // `confirmed`. `refusePlatformStatus` separates the two: a cancellation is
    // a fact the platform is reporting, everything else is a move the order
    // lifecycle governs.
    //
    // A refusal is a logged no-op, never a throw: throwing returns 500 and the
    // platform then retries the same impossible change seven times.
    const refusal = refusePlatformStatus(from, to)
    if (refusal) {
      if (refusal !== "no_change") {
        console.warn(
          `[webhook] refusing ${args.platform} ${from} -> ${to} for ${args.externalOrderId} (${refusal})`
        )
        // A cancellation that arrived too late is somebody's refund. It is kept
        // rather than dropped, because HTTP 200 and silence is how the previous
        // version lost them.
        await ctx.db.insert("platformWebhookFailures", {
          platform: args.platform,
          externalOrderId: args.externalOrderId,
          reason: "processing_failed" as const,
          detail: `Refused ${from} -> ${to} (${refusal})`,
          receivedAt: Date.now(),
        })
      }
      return order._id as string
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

      // The same rule `updateStatus` applies, asked here too.
      //
      // These are the two ways a platform cancellation reaches the database —
      // `deliverooWebhook` auto-reject goes through `internalUpdateStatus`,
      // its `order.status_update` and Uber's `orders.failure` come here — and
      // they used to answer differently: one raised `refund_pending`, the other
      // left the order at `paid`. One platform, one cancellation, two payment
      // states depending on which webhook happened to carry it.
      //
      // For a marketplace order this still writes nothing, which is the right
      // answer. What changed is that it is now the SAME function deciding, so
      // the two paths cannot drift apart again — and a direct order that ever
      // reached this handler would be flagged here as well.
      const owed = cancellationPaymentStatus(order)
      if (owed) {
        updates.paymentStatus = owed
      }

      // The promotion, released here as well. `updateStatus` is a SEPARATE
      // handler and a platform cancellation never reaches it — the comment
      // further down records what believing otherwise already cost once, a
      // kitchen ticket left live on the pass. A marketplace order carries no
      // promotion today, so this is a no-op; it is here so that a direct order
      // that ever reached this handler is not the exception that gets it wrong.
      await releasePromotionForOrder(ctx, order, args.updatedAt)
    }

    await ctx.db.patch(order._id as string, updates)

    // The platform said the order is off. Take it off the pass too, or the
    // kitchen keeps cooking it.
    if (args.status === "cancelled") {
      await cancelKitchenTicketsForOrder(ctx, order._id as string, args.updatedAt)
    }

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
 * Map a platform order's lines to the kitchen ticket item shape.
 *
 * The Uber Eats and Deliveroo webhooks build this by hand, identically, in two
 * byte-identical files — and that is where the customer's instruction was lost:
 * `notes: undefined`, hard-coded, one line after the mapper had extracted it
 * from `special_instructions` and `customer_request.allergy`. A note on that
 * path can be an allergy, so the drop was a food-safety defect, not a cosmetic
 * one.
 *
 * Lifted here so there is one mapping, in the package that owns the ticket
 * contract, with a test across the seam rather than one on each side of it.
 */
export function toKitchenTicketItemsFromPlatform(
  items: Array<{
    name: string
    quantity: number
    modifiers?: Array<{ name: string }>
    notes?: string
  }>
): Array<{ productName: string; quantity: number; options: string[]; notes?: string }> {
  return items.map((item) => ({
    productName: item.name,
    quantity: item.quantity,
    options: item.modifiers?.map((mod) => mod.name) ?? [],
    notes: item.notes,
  }))
}

/**
 * Resolve which station each line of an order belongs to.
 *
 * The mapping is per establishment and keyed on category, because that is the
 * unit an owner thinks in — "les pizzas au four, les salades au froid" — and
 * the unit the catalogue already carries. A category nobody mapped resolves to
 * `undefined`, which is one undifferentiated ticket: exactly what every
 * establishment gets today, so turning the feature on is opt-in and turning it
 * off is not a data migration.
 */
export async function resolveStations(
  ctx: any,
  storeId: string,
  items: OrderItemInput[]
): Promise<Array<string | undefined>> {
  const store = await ctx.db.get(storeId)
  const mapping: Array<{ categoryId: string; station: string }> =
    store?.stationMapping ?? []
  if (mapping.length === 0) return items.map(() => undefined)

  const byCategory = new Map(mapping.map((m) => [String(m.categoryId), m.station]))

  return Promise.all(
    items.map(async (item) => {
      if (!item.productId) return undefined
      const product = await ctx.db.get(item.productId)
      if (!product?.categoryId) return undefined
      return byCategory.get(String(product.categoryId))
    })
  )
}

/**
 * The allergens carried by the products in an order, and the time they need.
 *
 * `kitchenTickets.allergens` had exactly one writer — the demo seed — so the
 * "ALLERGÈNES" block on the printed slip could only ever fire on fake data,
 * while every product in the catalogue carried the field. `estimatedPrepTime`
 * had the same shape of hole: `getOverdueCount` compares `estimatedReadyAt`,
 * which is derived from a prep time nothing ever passed, so the overdue alarm
 * could not fire for any real order.
 *
 * Prep time is the longest line, not the sum: a kitchen cooks in parallel.
 */
export async function summariseOrderLines(
  ctx: any,
  items: OrderItemInput[]
): Promise<{ allergens: string[]; estimatedPrepTime?: number }> {
  const allergens = new Set<string>()
  let longest = 0

  for (const item of items) {
    if (!item.productId) continue
    const product = await ctx.db.get(item.productId)
    if (!product) continue

    for (const allergen of product.allergens ?? []) allergens.add(allergen)
    if (typeof product.preparationTime === "number") {
      longest = Math.max(longest, product.preparationTime)
    }
  }

  return {
    allergens: [...allergens],
    estimatedPrepTime: longest > 0 ? longest : undefined,
  }
}

/**
 * Put an order's slips on the pass, once.
 *
 * This is the seam #136 was about. The ticket used to be created inside
 * `createWithTicket`, in the same transaction as the order and *before* any
 * provider redirect: a customer who reached Stripe and closed the tab left a
 * slip on the pass, the kitchen cooked a €60 order nobody had paid for, and
 * nothing retracted it. The kitchen also had no way to tell paid from unpaid,
 * because every order looked the same to it.
 *
 * So the rule is now "a *paid* order feeds the kitchen", and it lives here
 * rather than in any one caller — the same argument `updateStatus` makes about
 * subscriber metadata. Every *card* path reaches it: Stripe's webhook, Stripe's
 * success-page verify, the PayPal capture and the SumUp verify all confirm
 * through `internalUpdatePaymentStatus`, which is transport over
 * `recordPaymentStatus`. Cash reaches it from `markCashPaid`.
 *
 * The two platform paths do NOT come through here and are not meant to:
 * `createFromWebhook` writes an order that Uber Eats or Deliveroo has already
 * collected for, and the Uber Eats webhook creates its ticket itself so the
 * slip can carry the platform's own display id — the number the kitchen matches
 * against the tablet on the wall. (Deliveroo creates no ticket at all; that is
 * P0-10's, not this seam's.)
 *
 * `store.orderConfirmation` decides *when*: "auto" releases on payment,
 * "manual" holds the order until staff accept it. That setting was withdrawn
 * in #242 for promising a workflow nothing implemented — this is the
 * implementation, which is why it is back.
 *
 * Idempotent: a replayed webhook, a success page racing its own webhook, and a
 * second staff click all find the tickets already there and change nothing.
 * Returns the number of tickets created — 0 is a normal answer.
 */
/**
 * Take an order's tickets off the pass when the order is cancelled.
 *
 * The counterpart to `releaseToKitchen`, and it exists for the same reason:
 * there is more than one way an order gets cancelled, and until now only one of
 * them cancelled the ticket. `updateStatus` — the staff path — did it inline.
 * `updateFromWebhook` — the path an Uber Eats or Deliveroo cancellation takes —
 * did not, so the customer cancelled, the platform told us, the order went to
 * `cancelled`, and the kitchen carried on cooking it because the ticket on the
 * display never moved.
 *
 * Already-cancelled and completed tickets are left alone: a completed ticket is
 * food that was actually made, and rewriting it would lose that.
 */
export async function cancelKitchenTicketsForOrder(
  ctx: any,
  orderId: string,
  now: number
): Promise<number> {
  const tickets = await ctx.db
    .query("kitchenTickets")
    .withIndex("by_orderId", (q: any) => q.eq("orderId", orderId))
    .collect()

  let cancelled = 0
  for (const ticket of tickets) {
    if (ticket.status !== "cancelled" && ticket.status !== "completed") {
      await ctx.db.patch(ticket._id as string, {
        status: "cancelled",
        updatedAt: now,
      })
      cancelled++
    }
  }
  return cancelled
}

export async function releaseToKitchen(
  ctx: any,
  orderId: string,
  options: { force?: boolean } = {}
): Promise<number> {
  const order = await ctx.db.get(orderId)
  if (!order) return 0

  // Never twice. This is the guard that survived from `createWithTicket`, and
  // it is the one that keeps the kitchen from plating the same dinner twice.
  const existing = await ctx.db
    .query("kitchenTickets")
    .withIndex("by_orderId", (q: any) => q.eq("orderId", orderId))
    .first()
  if (existing) return 0

  // A cancelled order has nothing to cook.
  if (order.status === "cancelled") return 0

  // The payment gate is about ABANDONMENT, and only a provider can be abandoned.
  //
  // #136 was a customer who reached Stripe and closed the tab: the order exists,
  // the money never will, and the kitchen cooked it anyway. So a card or PayPal
  // order waits for its provider to confirm, and `force` does not skip that —
  // staff clicking "Accepter la commande" on an abandoned checkout must not
  // start a meal nobody is paying for.
  //
  // Cash has no provider and no redirect, so it has nothing to abandon. The
  // checkout's cash branch shows "Commande confirmée !" and changes nothing
  // server-side, which meant an order-ahead cash order — a food truck, a
  // click-and-collect — sat invisible to the kitchen until somebody happened to
  // open the admin and record the money. In auto mode nobody ever does, because
  // auto mode is the promise that no human step is needed. The diner read
  // "confirmée" while the pass stayed empty (NEW2-JOURNEY-4).
  //
  // So cash skips the payment gate and falls through to `orderConfirmation`
  // below, like any other order: "auto" sends it to the pass now, "manual"
  // holds it for staff. The money is collected at handover, which is what
  // paying cash means. `markCashPaid` still records the till, and finds the
  // ticket already there.
  const settlesOnHandover = order.paymentMethod === "cash"

  if (!settlesOnHandover && order.paymentStatus !== "paid") return 0

  // `force` is staff accepting the order by hand: that IS the manual workflow,
  // so it skips the setting describing what happens without a human — and
  // nothing else.
  //
  // A status past `pending` counts the same way, and has to. Staff who accept a
  // phone order before the payment lands hit `updateStatus(confirmed)` while it
  // is still unpaid; the payment check above refuses, correctly. But `confirmed`
  // is reachable exactly once and only from `pending`, so when the money then
  // arrived the release ran WITHOUT `force`, the manual gate held it, and the
  // order was stranded: paid, accepted, and no ticket, with no button left to
  // press. Remembering that a human already accepted it is what closes that.
  const alreadyAccepted = options.force || order.status !== "pending"

  if (!alreadyAccepted) {
    const store = await ctx.db.get(order.storeId)
    // Absent means "auto": every establishment on the product today has the
    // field unset and expects its paid orders to reach the kitchen.
    if ((store?.orderConfirmation ?? "auto") === "manual") return 0
  }

  const items: OrderItemInput[] = order.items ?? []
  const stations = await resolveStations(ctx, order.storeId, items)

  // One token for the whole order, shared by its station tickets.
  //
  // `/track/[token]` follows a token, and a token per station meant the
  // customer followed whichever one `getTrackingToken` happened to return
  // first: the cold station finishes the salad and the page says "prête" while
  // the pizza is still in the oven. `getByTrackingToken` reads all the tickets
  // sharing the token and answers for the slowest.
  const trackingToken = crypto.randomUUID()

  // One ticket per station the order touches, so the cold station is not handed
  // a slip for a pizza. With no mapping configured every line lands on the same
  // `undefined` key, which is the single ticket every establishment has today.
  const byStation = new Map<string | undefined, OrderItemInput[]>()
  items.forEach((item, index) => {
    const station = stations[index]
    const bucket = byStation.get(station)
    if (bucket) bucket.push(item)
    else byStation.set(station, [item])
  })

  let created = 0
  for (const [station, stationItems] of byStation) {
    // Per station, not per order: a slip lists the allergens and the prep time
    // of the food printed on it. Handing the cold station the pizza's gluten
    // makes a cook read a warning for a dish they cannot see, next to items
    // that do not carry it.
    const summary = await summariseOrderLines(ctx, stationItems)

    await kitchenTicketCreate.handler(ctx, {
      storeId: order.storeId,
      orderId,
      orderNumber: order.orderNumber,
      orderType: order.type,
      items: toKitchenTicketItems(stationItems),
      station,
      priority: "normal",
      source: order.source ?? "website",
      estimatedPrepTime: summary.estimatedPrepTime,
      trackingToken,
      customerName: order.customerInfo?.name,
      customerPhone: order.customerInfo?.phone,
      tableNumber: order.tableNumber,
      deliveryNotes: order.notes,
      allergens: summary.allergens.length > 0 ? summary.allergens : undefined,
    })
    created++
  }

  return created
}

/**
 * Storefront checkout.
 *
 * Creates the order and nothing else. The kitchen hears about it when the
 * payment does — see `releaseToKitchen`. The name is kept because both apps'
 * transport wrappers and their tests refer to it, and because the seam it
 * names is still the seam: what a confirmed order does is decided here, in the
 * defs layer, not in an app wrapper.
 */
export const createWithTicket = {
  args: create.args,
  handler: async (ctx: any, args: CreateOrderArgs): Promise<string> => {
    const orderId = await create.handler(ctx, args)

    // Card and PayPal orders leave here `pending` and release on provider
    // confirmation; a cash order settles on handover, so this call is what
    // puts it on the pass in auto mode. It also runs on an idempotent reuse,
    // deliberately: a retry that switched the method to cash (#374) releases
    // here, and every path is safe to re-ask because `releaseToKitchen`
    // refuses a second ticket.
    await releaseToKitchen(ctx, orderId)

    return orderId
  },
}

/**
 * The Stripe Checkout Session of an order that is no longer a card order.
 *
 * WHY THIS EXISTS: #374 lets a diner who abandoned Stripe confirm « Espèces »
 * on the same checkout attempt, and re-methods the reused order to cash. Stripe
 * was never told. The session stayed payable for ~24 h behind the tab the diner
 * had left open, so once the counter had taken the notes the SAME order could
 * still be collected a second time by card — one meal, charged twice (#378).
 *
 * Expiring it is the fix that stops that happening at all, rather than catching
 * it afterwards. A mutation cannot call Stripe, so this answers with the id and
 * the wrapper schedules the action — the same division `planOrderConfirmation`
 * makes, and for the same reason: this layer has no `internal.*` of its own.
 *
 * `stripeCheckoutSessionId` is deliberately LEFT ON THE ORDER. It is the only
 * pointer `reconcilePendingCheckouts` has, and the one case where expiry fails
 * is a session Stripe refuses to expire because it has already been paid —
 * exactly the case where that pointer is what recovers the money. The cost is
 * that a diner who retries the same attempt again books a second expiry call,
 * which Stripe answers as a no-op.
 *
 * Answers null for every order that never had a session: cash from the start,
 * PayPal, and every platform order.
 */
export const abandonedCheckoutSession = async (
  ctx: any,
  orderId: string
): Promise<string | null> => {
  const order = await ctx.db.get(orderId)
  if (!order) return null

  const sessionId = order.stripeCheckoutSessionId
  if (typeof sessionId !== "string" || sessionId.trim() === "") return null

  // "card" is the only method that session settles, so it is the only method
  // that still needs it. An order carrying no method at all is a platform
  // order, which never had one.
  if (!order.paymentMethod || order.paymentMethod === "card") return null

  return sessionId
}

/**
 * How far back the ticketless sweep looks.
 *
 * Long enough to cover a platform outage and the night after it; short enough
 * that the sweep never walks a deployment's whole history. A platform order
 * older than this that still has no slip is not going to be cooked.
 */
export const TICKETLESS_LOOKBACK_MS = 24 * 60 * 60 * 1000

/** One sweep's ceiling, so a backlog cannot monopolise the backend. */
const TICKETLESS_SCAN_LIMIT = 200

/**
 * Platform orders that reached the kitchen nowhere, given a slip.
 *
 * WHY THIS EXISTS. An Uber Eats or Deliveroo order is written to `orders` and a
 * kitchen ticket is created for it in a SEPARATE step, inside a `try`. When
 * that step throws — a validation error on one malformed item, a transient
 * failure — the order exists, the platform got its 200, and there is no slip on
 * the pass: no screen, no printer, and the accept button unreachable because it
 * acts on a ticket. The food is never cooked and nobody is told.
 *
 * The webhooks now repair this on a redelivery, which is the fast path and the
 * one that usually fires. This is the backstop for when it does not: a platform
 * that retries once and gives up, a failure that outlives the retry window, a
 * handler that returned before the repair. None of the eleven other crons
 * looked for this — a ticketless order was, until now, permanently invisible.
 *
 * ONLY `uber_eats` and `deliveroo`. A `website` order gets its ticket from the
 * settlement path and a `pos` order from the counter; giving either one a slip
 * from here would put unpaid orders on the pass.
 *
 * CANCELLED ORDERS ARE SKIPPED, and so are orders whose status has already
 * moved past the kitchen — a slip for something the restaurant has finished
 * with is worse than none.
 */
export const sweepTicketlessPlatformOrders = {
  args: {},
  handler: async (
    ctx: any
  ): Promise<{ examined: number; repaired: number; failed: number }> => {
    const since = Date.now() - TICKETLESS_LOOKBACK_MS
    let examined = 0
    let repaired = 0
    let failed = 0

    for (const source of ["uber_eats", "deliveroo"] as const) {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_source", (q: any) => q.eq("source", source))
        .order("desc")
        .take(TICKETLESS_SCAN_LIMIT)

      for (const order of orders) {
        // The index carries no timestamp, so the window is applied here. Taking
        // the newest first and stopping at the first one outside the window
        // keeps this bounded on a busy deployment.
        if (order.createdAt < since) break
        if (["cancelled", "completed", "delivered"].includes(order.status)) continue
        examined++

        const tickets = await ctx.db
          .query("kitchenTickets")
          .withIndex("by_orderId", (q: any) => q.eq("orderId", order._id))
          .take(1)
        if (tickets.length > 0) continue

        try {
          await kitchenTicketCreate.handler(ctx, {
            storeId: order.storeId,
            orderId: order._id,
            orderNumber: order.orderNumber,
            orderType: order.type === "dine_in" ? "dine_in" : order.type,
            items: toKitchenTicketItems(order.items ?? []),
            priority: "normal" as const,
            source,
            // Distinct from the webhook's own token, and it does not need to
            // match: the token addresses the ticket, and this ticket is new.
            trackingToken: `rec-${String(order._id).slice(-8)}-${Date.now().toString(36)}`,
            customerName: order.customerInfo?.name ?? `Client ${source}`,
            customerPhone: order.customerInfo?.phone,
            deliveryNotes: order.notes,
          })
          repaired++
        } catch {
          // Counted rather than thrown: one unmappable order must not stop the
          // sweep from repairing the rest. The count is what the caller logs.
          failed++
        }
      }
    }

    return { examined, repaired, failed }
  },
}
