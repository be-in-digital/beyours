/**
 * The confirmation a diner gets when their order is paid for.
 *
 * WHY THIS EXISTS: nothing in the product ever wrote a transactional email. Five
 * SES senders ship — team invitations, marketing campaigns, maintenance notices,
 * game prizes, marketing automations — and not one of them is triggered by a
 * purchase. A guest paid and received nothing: no confirmation, no receipt, no
 * record of what they had ordered or where to collect it. `orders.ts` refuses to
 * enrol a diner as a marketing subscriber ("an order is a purchase, not
 * consent"), which is right, and which is exactly why the transactional path had
 * to be built separately rather than borrowed from the automations.
 *
 * The split here is the one `updateStatus` already uses: this layer decides WHO
 * should be reached and claims the send; scheduling needs `internal.*`, which
 * only an app has. The decision therefore lives in one place instead of in the
 * six callers that would each have to remember.
 *
 * @module orderConfirmation
 */

import type { OrderConfirmationInput } from "@be-yours/core/aws/ses/order-confirmation"
import type { NoticeFailureInput } from "@be-yours/convex-schema"

/** What the app hands to the sender. Deliberately small — the action re-reads. */
export interface OrderConfirmationDispatch {
  orderId: string
}

/**
 * Why an order gets no confirmation. Every refusal is a normal outcome, not an
 * error: most of them describe an order that was never the diner's to receive.
 */
export type ConfirmationRefusal =
  | "not_paid"
  | "cancelled"
  | "no_email"
  | "marketplace"
  | "already_dispatched"
  | "address_suppressed"

/** The order fields the decision reads. */
export interface ConfirmableOrder {
  paymentStatus?: unknown
  paymentMethod?: unknown
  status?: unknown
  source?: unknown
  customerInfo?: { email?: unknown } | null
  confirmationEmailAt?: unknown
}

/**
 * Is this order collected for at handover rather than up front?
 *
 * The same predicate `releaseToKitchen` uses, and for the same reason: cash has
 * no provider to abandon, so "not paid yet" does not mean "may never be real".
 */
export function settlesOnHandover(order: ConfirmableOrder): boolean {
  return order.paymentMethod === "cash"
}

/** How SES last found this address, when we have heard anything at all. */
export type SubscriberStanding = "bounced" | "complained" | "other" | "unknown"

/**
 * Should this order's diner be emailed?
 *
 * Pure, so the rule is testable without a database, and separate from the
 * claim below so that "who qualifies" can be read in one piece.
 *
 * The rules, and why each one is here:
 *
 *  - **not_paid** — the confirmation says the money arrived. Sending it before
 *    that is the `#136` failure in email form: a diner who closed the Stripe tab
 *    told their order is confirmed.
 *
 *    With one exception, and it is the same exception `releaseToKitchen` makes:
 *    CASH has no provider and no redirect, so it has nothing to abandon. The
 *    money is collected at handover, which is what paying cash means, and the
 *    order goes to the pass at checkout for exactly that reason — its own
 *    comment notes that in auto mode "nobody ever" opens the admin to record
 *    it. So a cash click-and-collect diner would otherwise place an order, be
 *    shown "Commande confirmée !", and hear nothing at all, possibly for ever.
 *    They get their confirmation now, saying plainly that the order is still to
 *    be paid for; `markCashPaid` later finds the claim taken and does not send
 *    a second one.
 *  - **cancelled** — an order cancelled between settlement and dispatch is not
 *    confirmed by anything.
 *  - **no_email** — guest checkout does not require one. Nothing to send to.
 *  - **marketplace** — an Uber Eats or Deliveroo diner already has the
 *    platform's own confirmation, has never given the restaurant their address,
 *    and their order carries `taxAmount: 0` because the platform accounts for
 *    the tax itself. A receipt built from those figures would not balance.
 *  - **already_dispatched** — see `orders.confirmationEmailAt`.
 *  - **address_suppressed** — SES told us this address hard-bounced or reported
 *    the sender. Sending again costs the establishment its sending reputation,
 *    and the mail will not arrive anyway.
 *
 * Note what is deliberately NOT a refusal: an `unsubscribed` marketing
 * subscriber still gets their receipt. Unsubscribing withdraws consent to be
 * *marketed to*; it does not cancel the confirmation for something they paid
 * for, which is the same distinction `orders.ts` draws when it declines to turn
 * a buyer into a subscriber.
 */
export function orderConfirmationRefusal(
  order: ConfirmableOrder,
  standing: SubscriberStanding = "unknown"
): ConfirmationRefusal | null {
  const awaitingHandover =
    settlesOnHandover(order) &&
    (order.paymentStatus === "pending" || order.paymentStatus === undefined)
  if (order.paymentStatus !== "paid" && !awaitingHandover) return "not_paid"
  if (order.status === "cancelled") return "cancelled"

  const source = order.source
  if (source === "uber_eats" || source === "deliveroo") return "marketplace"

  const email = order.customerInfo?.email
  if (typeof email !== "string" || email.trim().length === 0) return "no_email"

  if (typeof order.confirmationEmailAt === "number") return "already_dispatched"

  if (standing === "bounced" || standing === "complained") {
    return "address_suppressed"
  }

  return null
}

/** How SES last found an address, from the marketing subscriber list. */
export async function readSubscriberStanding(
  ctx: any,
  storeId: unknown,
  email: string
): Promise<SubscriberStanding> {
  const subscriber = await ctx.db
    .query("emailSubscribers")
    .withIndex("by_storeId_email", (q: any) =>
      // Normalised the same way `orders.ts` writes it: without this, `A@b.com`
      // and `a@b.com` are two different people and a suppressed address is
      // reachable again by changing the case.
      q.eq("storeId", storeId).eq("email", email.trim().toLowerCase())
    )
    .first()

  if (!subscriber) return "unknown"
  if (subscriber.status === "bounced") return "bounced"
  if (subscriber.status === "complained") return "complained"
  return "other"
}

/**
 * Decide, and claim the send in the same transaction.
 *
 * Returns what the app should schedule, or null when this order gets no
 * confirmation. The claim — writing `confirmationEmailAt` — happens here rather
 * than in the action, because a mutation is the only place it can be atomic. A
 * Stripe webhook replayed while its own success page is settling the same order
 * runs this twice; the second run reads the marker the first one wrote and
 * returns null.
 *
 * Never throws. A confirmation email is not a reason for a payment to fail, and
 * every caller is on the path that marks money as received.
 */
export async function planOrderConfirmation(
  ctx: any,
  orderId: string
): Promise<OrderConfirmationDispatch | null> {
  const order = await ctx.db.get(orderId)
  if (!order) return null

  // Cheap refusals first, so an order with no email never costs a subscriber
  // lookup.
  const provisional = orderConfirmationRefusal(order)
  if (provisional !== null && provisional !== "address_suppressed") return null

  const email = String(order.customerInfo?.email ?? "")
  const standing = await readSubscriberStanding(ctx, order.storeId, email)
  if (orderConfirmationRefusal(order, standing) !== null) return null

  // The failure goes with the claim, as on the ready notice: a new dispatch
  // supersedes whatever the last one reported (#530).
  await ctx.db.patch(orderId, {
    confirmationEmailAt: Date.now(),
    confirmationEmailFailure: undefined,
  })

  return { orderId: String(orderId) }
}

// ── Assembling the email ────────────────────────────────────────────────────

/** Chosen options as the diner would read them: "Base crème", "Sans oignon". */
function optionLabels(item: any): string[] {
  const options = Array.isArray(item?.selectedOptions) ? item.selectedOptions : []
  return options
    .map((option: any) => {
      const choice = typeof option?.choiceName === "string" ? option.choiceName : ""
      const name = typeof option?.optionName === "string" ? option.optionName : ""
      // "Taille : Grande" when both are known, otherwise whichever we have.
      if (choice && name && choice !== name) return `${name} : ${choice}`
      return choice || name
    })
    .filter((label: string) => label.length > 0)
}

/** An address only when every part of it is there. */
function readAddress(value: any) {
  if (!value || typeof value !== "object") return undefined
  const { street, city, postalCode, country, instructions } = value
  if (typeof street !== "string" || typeof city !== "string") return undefined
  return {
    street,
    city,
    postalCode: typeof postalCode === "string" ? postalCode : "",
    country: typeof country === "string" ? country : undefined,
    instructions: typeof instructions === "string" ? instructions : undefined,
  }
}

/** What the confirmation email needs, plus the bits only an action can finish. */
export interface OrderConfirmationPayload {
  /** Everything the renderer needs except the tracking link. */
  email: OrderConfirmationInput
  /** Where to send it. */
  toEmail: string
  /** The establishment's own wall clock, for "prévue pour…". */
  timeZone?: string
  /** Half of the tracking link; the action holds the other half (`SITE_URL`). */
  orderId: string
  viewToken?: string
  /** The store, so the sender can use its own verified identity. */
  storeId: string
}

/**
 * Give back a claim that was made and could not be used.
 *
 * The claim is written in the settling mutation, before the action that talks
 * to SES runs, because a mutation is the only place it can be atomic. That is
 * right for a send that was ATTEMPTED and failed — retrying a provider that has
 * already refused is how a diner gets three receipts. It is wrong when no send
 * was attempted at all: an establishment with no sender address configured
 * would have its first paid order marked as confirmed for ever, and the email
 * would never go out even after the address was set.
 *
 * So the sender releases the claim when it stops before reaching SES. Called
 * from the action through a small internal mutation, since only a mutation can
 * write.
 */
export async function releaseOrderConfirmationClaim(
  ctx: any,
  orderId: string,
  failure?: NoticeFailureInput
): Promise<void> {
  const order = await ctx.db.get(orderId)
  if (!order) return

  /*
   * The two halves are separately conditional, and that is the point (#530).
   *
   * The claim is given back only when it is held — the pre-existing guard,
   * kept. The failure is written only when the caller names one, because two of
   * the three sites that release this claim do so for an order that was
   * cancelled or deleted between the claim and the send. Nothing failed there,
   * and reporting a failed notice on an order that no longer exists would be
   * worse than silence.
   *
   * A caller that names a failure is therefore still recorded even if the claim
   * has already gone: the owner's question is "did my diner get the mail", and
   * the answer does not depend on who released what first.
   */
  const patch: Record<string, unknown> = {}
  if (typeof order.confirmationEmailAt === "number") {
    patch.confirmationEmailAt = undefined
  }
  if (failure) {
    patch.confirmationEmailFailure = { at: Date.now(), ...failure }
  }
  if (Object.keys(patch).length === 0) return
  await ctx.db.patch(orderId, patch)
}

/**
 * Read an order and render it into the shape the email builder takes.
 *
 * Reads the order as it was recorded rather than recomputing anything: the
 * stored `taxBreakdown`, the stored line subtotals, the stored total. A receipt
 * has to say what was charged, and a product repriced or deleted since must not
 * change it.
 *
 * Returns null when the order or its establishment is gone — which is the same
 * "nothing to send" answer as every refusal above, and never an error.
 */
export async function buildOrderConfirmationPayload(
  ctx: any,
  orderId: string
): Promise<OrderConfirmationPayload | null> {
  const order = await ctx.db.get(orderId)
  if (!order) return null

  // Re-read the refusal here, not only in the mutation that claimed the send.
  // The action runs afterwards, and an order cancelled and refunded in between
  // would otherwise be told, in writing, that it is confirmed. The
  // `already_dispatched` marker is the claim this very send is acting on, so it
  // is not a refusal at this point.
  const refusal = orderConfirmationRefusal({
    ...order,
    confirmationEmailAt: undefined,
  })
  if (refusal !== null) return null

  const toEmail = String(order.customerInfo?.email ?? "").trim()
  if (!toEmail) return null

  const store = await ctx.db.get(order.storeId)
  if (!store) return null

  const globalSettings = await ctx.db.query("globalSettings").first()

  const items = (Array.isArray(order.items) ? order.items : []).map((item: any) => ({
    name: String(item?.productName ?? ""),
    quantity: Number(item?.quantity ?? 0),
    subtotal: Number(item?.subtotal ?? 0),
    options: optionLabels(item),
    notes: typeof item?.notes === "string" ? item.notes : undefined,
  }))

  const email: OrderConfirmationInput = {
    orderNumber: String(order.orderNumber ?? ""),
    customerName: String(order.customerInfo?.name ?? "").trim() || "à vous",
    type: order.type === "delivery" || order.type === "dine_in" ? order.type : "pickup",
    store: {
      name: String(store.name ?? ""),
      address: readAddress(store.address),
      phone: typeof store.phone === "string" ? store.phone : undefined,
    },
    items,
    subtotal: Number(order.subtotal ?? 0),
    taxAmount: Number(order.taxAmount ?? 0),
    taxBreakdown: Array.isArray(order.taxBreakdown)
      ? order.taxBreakdown.map((entry: any) => ({
          ratePercent: Number(entry?.ratePercent ?? 0),
          taxAmount: Number(entry?.taxAmount ?? 0),
        }))
      : undefined,
    deliveryFee:
      typeof order.deliveryFee === "number" ? order.deliveryFee : undefined,
    discount:
      typeof order.discountAmount === "number" ? order.discountAmount : undefined,
    total: Number(order.total ?? 0),
    deliveryAddress: readAddress(order.deliveryAddress),
    paymentMethod:
      typeof order.paymentMethod === "string" ? order.paymentMethod : undefined,
    // A cash order-ahead is confirmed before the money changes hands, so the
    // email must not thank the diner for a payment they have not made.
    paymentPending: order.paymentStatus !== "paid" ? true : undefined,
    estimatedPrepTime:
      typeof order.estimatedPrepTime === "number"
        ? order.estimatedPrepTime
        : undefined,
    notes: typeof order.notes === "string" ? order.notes : undefined,
  }

  return {
    email,
    toEmail,
    timeZone:
      typeof globalSettings?.timezone === "string"
        ? globalSettings.timezone
        : undefined,
    orderId: String(orderId),
    viewToken: typeof order.viewToken === "string" ? order.viewToken : undefined,
    storeId: String(order.storeId),
  }
}
