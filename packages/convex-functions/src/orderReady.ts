/**
 * Telling the diner their order is ready (#96).
 *
 * WHAT WAS MISSING. The product confirmed an order and then said nothing else,
 * ever. A click-and-collect customer had no way to know when to walk over except
 * by watching the tracking page, and the dining room's wall screen only helps
 * somebody already in the room. The audit's first finding under Suivi de commande
 * was "missing status notifications and ETAs".
 *
 * ONE TRANSITION. `ready`, and nothing else — see `order-ready.ts` in
 * `@be-in-digital/core` for why an email per status change is four emails an
 * order and a spam complaint waiting to happen.
 *
 * Pure decisions here; the rendering is in `core` and the sending is an action in
 * each app. Same three-way split as the confirmation, for the same reason: the
 * claim has to be transactional, and a mutation is the only place it can be.
 */

/** Why this order gets no "it's ready" notice. `null` means it does. */
export type OrderReadyRefusal =
  | "no_email"
  | "already_dispatched"
  | "delivery_order"
  | "cancelled"
  | "address_suppressed"

/** The fields of an order this module reads. */
export interface ReadyOrderRow {
  status?: string
  type?: string
  customerInfo?: { email?: string }
  readyEmailAt?: number
}

/**
 * Decide whether this order earns the notice.
 *
 * `delivery` is refused deliberately. « Prête » on a delivery means the food has
 * left the kitchen, not that anything is expected of the diner — telling them to
 * come and collect it would be wrong, and telling them nothing is what the
 * courier's own tracking is for.
 *
 * `cancelled` is refused for the obvious reason, and it is a real race: a staff
 * member can cancel an order in the seconds between the kitchen marking it ready
 * and the scheduled action running.
 */
export function orderReadyRefusal(
  order: ReadyOrderRow,
  standing: "unknown" | "bounced" | "complained" | "other" = "unknown"
): OrderReadyRefusal | null {
  if (order.status === "cancelled") return "cancelled"
  if (order.type === "delivery") return "delivery_order"

  const email = order.customerInfo?.email
  if (typeof email !== "string" || email.trim().length === 0) return "no_email"

  if (typeof order.readyEmailAt === "number") return "already_dispatched"

  // A hard bounce says the mailbox does not exist and a complaint says this
  // person reported us. Sending either a transactional notice damages the
  // sending domain for every other diner.
  if (standing === "bounced" || standing === "complained") {
    return "address_suppressed"
  }

  return null
}

/** What the app must schedule, or null when this order gets no notice. */
export interface OrderReadyDispatch {
  orderId: string
}

/**
 * Decide, and claim the send in the same transaction.
 *
 * Exactly the shape `planOrderConfirmation` uses, and for the same reason: the
 * `ready` transition can be reached twice — a second station finishing, a staff
 * member correcting a status back and forward — and only a mutation can make the
 * claim atomic. The second run reads the marker the first one wrote and returns
 * null.
 *
 * Never throws. A notification is not a reason for a kitchen status change to
 * fail.
 */
export async function planOrderReady(
  ctx: any,
  orderId: string,
  readSubscriberStanding: (
    ctx: any,
    storeId: unknown,
    email: string
  ) => Promise<"unknown" | "bounced" | "complained" | "other">
): Promise<OrderReadyDispatch | null> {
  const order = await ctx.db.get(orderId)
  if (!order) return null

  // Cheap refusals first, so a delivery order never costs a subscriber lookup.
  const provisional = orderReadyRefusal(order)
  if (provisional !== null && provisional !== "address_suppressed") return null

  const email = String(order.customerInfo?.email ?? "")
  const standing = await readSubscriberStanding(ctx, order.storeId, email)
  if (orderReadyRefusal(order, standing) !== null) return null

  await ctx.db.patch(orderId, { readyEmailAt: Date.now() })

  return { orderId: String(orderId) }
}

/**
 * What the notice needs, assembled from the order and its establishment.
 *
 * Returns null when the order, its establishment or its address went away
 * between the claim and the action running — which is not an error, just nothing
 * to send.
 */
export async function readyPayload(
  ctx: any,
  orderId: string
): Promise<{
  orderId: string
  storeId: string
  toEmail: string
  timeZone?: string
  viewToken?: string
  email: {
    orderNumber: string
    customerName: string
    fulfilment: "delivery" | "pickup" | "dine_in"
    store: { name: string; address?: Record<string, unknown>; phone?: string }
    readyAt: number
    tableNumber?: string
  }
} | null> {
  const order = await ctx.db.get(orderId)
  if (!order) return null
  if (order.status === "cancelled") return null

  const email = String(order.customerInfo?.email ?? "")
  if (!email) return null

  const store = await ctx.db.get(order.storeId)
  if (!store) return null

  const globalSettings = await ctx.db.query("globalSettings").first()

  return {
    orderId: String(orderId),
    storeId: String(order.storeId),
    toEmail: email,
    timeZone: globalSettings?.timezone,
    viewToken: typeof order.viewToken === "string" ? order.viewToken : undefined,
    email: {
      orderNumber: String(order.orderNumber ?? ""),
      customerName: String(order.customerInfo?.name ?? "client"),
      fulfilment: (order.type ?? "pickup") as "delivery" | "pickup" | "dine_in",
      store: {
        name: String(store.name ?? ""),
        ...(store.address ? { address: store.address } : {}),
        ...(store.phone ? { phone: String(store.phone) } : {}),
      },
      // `readyAt` is the kitchen's own announcement time when a ticket carries
      // one; the order's `updatedAt` is the fallback, which is the same instant
      // to within the transaction that set it.
      readyAt: Number(order.updatedAt ?? Date.now()),
      ...(order.tableNumber ? { tableNumber: String(order.tableNumber) } : {}),
    },
  }
}

/**
 * Give the claim back.
 *
 * The action calls this when it sends nothing for a reason that may not hold
 * later — no sender address configured, which is the day-one state of a new
 * deployment. Keeping the claim would silence that establishment's notices for
 * ever, including after the address was set. Same treatment as
 * `releaseConfirmationClaim`.
 */
export async function releaseReadyClaim(ctx: any, orderId: string): Promise<void> {
  const order = await ctx.db.get(orderId)
  if (!order) return
  await ctx.db.patch(orderId, { readyEmailAt: undefined })
}
