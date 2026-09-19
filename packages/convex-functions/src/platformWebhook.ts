/**
 * The decisions a delivery-platform webhook has to make before it touches the
 * database — what the event is, which establishment the order belongs to,
 * whether the status may be applied, and what a line actually costs.
 *
 * All of it is pure, and all of it lives here rather than in the two apps.
 * `apps/reference/convex/uberEatsWebhook.ts` and its `apps/themes` twin were
 * byte-identical, which meant every fault below existed twice and any check
 * that compared the two apps was blind to all of them. There is now one copy,
 * with a test surface, and the apps are transport over it.
 */

import { canTransitionOrderStatus } from "@be-yours/convex-schema"
import type { OrderStatus } from "@be-yours/convex-schema"

// ---------------------------------------------------------------------------
// Uber Eats event identity
// ---------------------------------------------------------------------------

/**
 * What an Uber webhook actually is.
 *
 * The handler used to match `orders.cancel`, `orders.scheduled` and
 * `eats.order.status_update`. Uber sends none of those. Its catalogue is
 * `orders.notification`, `orders.scheduled.notification`,
 * `orders.cancel.notification`, `orders.release.notification`,
 * `store.provisioned` and `store.deprovisioned` — so a customer cancelling
 * fell through to "unknown event, acknowledge 200" and the kitchen carried on
 * cooking an order that no longer existed.
 *
 * `eats.order.status_update` is not an Uber event at all; the branch that
 * handled it, and its status map, were dead from the day they were written.
 */
export type UberEventKind =
  | "new_order"
  | "scheduled_order"
  | "cancel"
  | "release"
  | "fulfillment_issues_resolved"
  | "store_provisioned"
  | "store_deprovisioned"
  | "report"
  | "unknown"

/**
 * Reduce an Uber `event_type` to what it means.
 *
 * Uber suffixes its order events with `.notification`. Both the suffixed and
 * bare spellings are accepted: the suffixed one is what Uber sends, the bare
 * one is what older integrations and our own fixtures used, and treating them
 * as the same event costs nothing while getting it wrong costs a cancellation.
 */
export function classifyUberEvent(rawEventType: string | undefined | null): UberEventKind {
  if (!rawEventType) return "unknown"
  const canonical = rawEventType.trim().toLowerCase().replace(/\.notification$/, "")

  switch (canonical) {
    case "orders":
      // `orders.notification` — a new order. The bare `orders` spelling only
      // ever arises from stripping the suffix.
      return "new_order"
    case "orders.scheduled":
      return "scheduled_order"
    case "orders.cancel":
    case "orders.failure":
      // `orders.failure` is not in Uber's published catalogue, but the previous
      // handler accepted it and a failed order is cancelled from the kitchen's
      // point of view. Keeping it is free; dropping it would silently change
      // behaviour for anyone already sending it.
      return "cancel"
    case "orders.release":
      return "release"
    case "orders.fulfillment_issues.resolved":
      return "fulfillment_issues_resolved"
    case "store.provisioned":
      return "store_provisioned"
    case "store.deprovisioned":
      return "store_deprovisioned"
    case "eats.report.success":
    case "eats.report.failure":
      return "report"
    default:
      return "unknown"
  }
}

// ---------------------------------------------------------------------------
// Which establishment does this order belong to?
// ---------------------------------------------------------------------------

/** The part of a store integration record this module needs. */
export interface PlatformStoreIntegration {
  platformStoreId: string
}

export type StoreResolutionFailure =
  /** No enabled integration exists for this platform at all. */
  | "no_integrations"
  /** The event carried no usable store reference — we cannot know where it goes. */
  | "unidentified_store"
  /** The event named a store we do not have an enabled integration for. */
  | "unknown_store"
  /** More than one enabled integration claims this store id. */
  | "ambiguous_store"

export type StoreResolution<T> =
  | { ok: true; integration: T }
  | { ok: false; reason: StoreResolutionFailure }

/**
 * Find the integration an order belongs to, or refuse.
 *
 * The old code read
 *
 * ```ts
 * const integration = unifiedOrder
 *   ? allIntegrations.find(i => i.platformStoreId === unifiedOrder.storeExternalId)
 *   : allIntegrations[0]
 * ```
 *
 * `unifiedOrder` is null whenever the follow-up fetch to Uber fails — a 429, a
 * 5xx, a timeout, or the very common case of sandbox credentials meeting a
 * production order. On a multi-location account that fallback sent **every**
 * order from **every** location to whichever establishment happened to sort
 * first, with a total of 0 and a single line reading "Commande Uber Eats", and
 * printed the ticket in that kitchen. One owner's orders appeared in another
 * owner's restaurant.
 *
 * There is no safe guess here. An order we cannot place is refused and kept for
 * a human, which is why every failure below is a distinct reason rather than a
 * boolean.
 */
export function resolveStoreIntegration<T extends PlatformStoreIntegration>(
  integrations: readonly T[],
  storeExternalId: unknown
): StoreResolution<T> {
  if (integrations.length === 0) {
    return { ok: false, reason: "no_integrations" }
  }

  // Deliberately not `storeExternalId?.trim()`. A payload is not a contract:
  // Uber sending `store: { id: 12345 }` made that call throw
  // `trim is not a function`, which reached the handler's outer catch as a 500
  // with nothing recorded — the platform retried seven times and the order was
  // gone. An unusable id is an unidentified store, not a crash.
  const wanted = typeof storeExternalId === "string" ? storeExternalId.trim() : ""
  if (!wanted) {
    return { ok: false, reason: "unidentified_store" }
  }

  const [only, ...rest] = integrations.filter((i) => i.platformStoreId === wanted)
  if (!only) {
    return { ok: false, reason: "unknown_store" }
  }

  // "Does exactly one match?", not "does one match?". Nothing stops an owner
  // pasting the same Uber store id onto a second location — `storeIntegrations`
  // is unique on (storeId, platform), not on platformStoreId — and asking only
  // whether *a* match exists routes every order from both restaurants to
  // whichever happens to sort first, with no signal anywhere. A router that is
  // 50% wrong in silence is worse than one that refuses.
  if (rest.length > 0) {
    return { ok: false, reason: "ambiguous_store" }
  }

  return { ok: true, integration: only }
}

/**
 * A store integration seen through a menu event, which may name a brand
 * instead of a site.
 */
export interface PlatformBrandIntegration extends PlatformStoreIntegration {
  brandId?: string
}

/**
 * Find the integration a MENU event belongs to, or refuse.
 *
 * Menu webhooks are the one platform event that may identify their target by
 * brand rather than by site, and the Deliveroo handler took that as licence to
 * try both in turn:
 *
 * ```ts
 * let integration = args.siteId
 *   ? allIntegrations.find(i => i.platformStoreId === args.siteId)
 *   : undefined
 * if (!integration && args.brandId) {
 *   integration = allIntegrations.find(i => i.brandId === args.brandId)
 * }
 * ```
 *
 * Two defects, both of the class the order path's own comment names.
 *
 * **A site id that matches nothing fell through to the brand.** A brand covers
 * every location of a chain, so the fallback then picked whichever of them
 * sorted first — and wrote `menuSyncStatus` there. The event said "site 42's
 * menu failed validation"; the screen said the Boulevard branch's menu had
 * failed, and the Boulevard branch's owner went looking for an error in a menu
 * that uploaded cleanly. A named site we do not know is an **unknown** site,
 * not an invitation to guess a sibling: when the event identifies a site, that
 * answer is final.
 *
 * **The brand match asked "does one match?"** For a single-site client that is
 * the same question as "does exactly one match?". For every client with two
 * locations it is not, and that is the client this product is sold to — the
 * business model is one owner, one to unbounded establishments. `.find()` on a
 * brand is therefore wrong on exactly the accounts where it matters, silently,
 * half the time.
 *
 * A status written onto the wrong establishment is worse than none: the
 * failure is invisible on the site that has it and fictional on the site that
 * does not. Refuse, and let the caller record and retry.
 */
export function resolveMenuStoreIntegration<T extends PlatformBrandIntegration>(
  integrations: readonly T[],
  siteId: unknown,
  brandId: unknown
): StoreResolution<T> {
  if (integrations.length === 0) {
    return { ok: false, reason: "no_integrations" }
  }

  // A site reference is the specific one. Its verdict stands whatever the
  // brand says — including `unknown_store`.
  const site = typeof siteId === "string" ? siteId.trim() : ""
  if (site) {
    return resolveStoreIntegration(integrations, site)
  }

  // Same defensive read as the site id: a payload is not a contract.
  const brand = typeof brandId === "string" ? brandId.trim() : ""
  if (!brand) {
    return { ok: false, reason: "unidentified_store" }
  }

  const [only, ...rest] = integrations.filter((i) => i.brandId === brand)
  if (!only) {
    return { ok: false, reason: "unknown_store" }
  }
  if (rest.length > 0) {
    // The normal shape of a chain, not an edge case. One brand, four
    // restaurants, and nothing in the event to say which.
    return { ok: false, reason: "ambiguous_store" }
  }

  return { ok: true, integration: only }
}

// ---------------------------------------------------------------------------
// Platform status -> our status
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// May a platform's status actually be applied?
// ---------------------------------------------------------------------------

/** Why an inbound platform status was not written. */
export type PlatformStatusRefusal =
  /** Same status again — a webhook retry, not a change. */
  | "no_change"
  /** The move is not one the order lifecycle allows. */
  | "illegal_transition"
  /** The food was delivered. A cancellation now is a refund, not a kitchen event. */
  | "already_delivered"

/** Statuses after which a cancellation can no longer stop anything. */
const CANCELLATION_TOO_LATE: readonly string[] = ["delivered", "completed", "cancelled"]

/**
 * Why an inbound platform status may NOT be written — `null` when it may.
 *
 * Returns the reason rather than a tagged union on purpose: this package
 * compiles with `strict: false`, where a boolean discriminant does not narrow,
 * and a shape that needs no narrowing cannot be got wrong by a caller.
 *
 * A cancellation from a platform is a **fact, not a request**, and that
 * distinction is the whole of this function.
 *
 * `ORDER_STATUS_TRANSITIONS` stops the cancellation window at `confirmed`, and
 * its comment says why: Deliveroo refuses to cancel an order already being
 * made, so offering it *outbound* would desync the two systems. Applying that
 * same rule to an *inbound* notification was a category error — and an
 * expensive one. A customer cancelling an order that had reached `preparing`
 * produced HTTP 200, no change, no `cancelledAt`, no dead letter, and a kitchen
 * that carried on cooking. It is the exact harm the cancellation defect was
 * about, in a narrower window, and it was invisible.
 *
 * So a cancellation is honoured from any status where stopping still means
 * something. Past `delivered` it does not: the food was handed over, and
 * rewriting the order would lose that. Those are refused explicitly, with a
 * reason, so somebody can deal with the refund.
 */
export function refusePlatformStatus(
  from: string,
  to: string
): PlatformStatusRefusal | null {
  if (from === to) return "no_change"

  if (to === "cancelled") {
    return CANCELLATION_TOO_LATE.includes(from) ? "already_delivered" : null
  }

  return canTransitionOrderStatus(from as OrderStatus, to as OrderStatus)
    ? null
    : "illegal_transition"
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** A line as the platform mappers produce it. */
export interface PlatformOrderLine {
  externalId: string
  name: string
  quantity: number
  /** Price of ONE unit, excluding modifiers, in integer cents. */
  unitPrice: number
  /** `(unitPrice + modifiers) * quantity`, in integer cents. */
  totalPrice: number
  notes?: string
  /** `quantity` is per line, not per unit: "double cheese" is quantity 2. */
  modifiers?: Array<{ externalId: string; name: string; price: number; quantity?: number }>
}

/** A line in the shape `createFromWebhook` accepts. */
export interface WebhookOrderLine {
  externalId: string
  name: string
  quantity: number
  /** `createFromWebhook` treats this as a UNIT price and multiplies by quantity. */
  price: number
  modifiers?: Array<{ externalId: string; name: string; price: number; quantity?: number }>
  notes?: string
}

/**
 * Map platform lines onto the `createFromWebhook` argument shape.
 *
 * The bug this exists to prevent: the webhook passed `item.totalPrice` — which
 * the mapper had already computed as `(unitPrice + modifiers) * quantity` —
 * into `price`, a slot `createFromWebhook` treats as a unit price and
 * multiplies by quantity a second time. A basket measured at 2.045x its real
 * value; a two-of-something line at 2.209x. Every Uber Eats order in the
 * product was overstated, and Deliveroo — which passed a genuine unit price —
 * silently disagreed with it.
 *
 * `unitPrice` is the only correct field to pass, and naming the parameter for
 * what it is makes the next such mistake a type error rather than a receipt.
 */
export function toWebhookOrderItems(
  items: readonly PlatformOrderLine[]
): WebhookOrderLine[] {
  return items.map((item) => ({
    externalId: item.externalId,
    name: item.name,
    quantity: item.quantity,
    price: item.unitPrice,
    modifiers: item.modifiers?.map((mod) => ({
      externalId: mod.externalId,
      name: mod.name,
      price: mod.price,
      // Dropped here once, and a double cheese was charged as a single one:
      // the mapper prices modifiers as `price * quantity`, so discarding the
      // quantity at this boundary under-charged every multiplied extra.
      quantity: mod.quantity,
    })),
    // An allergy travels in here. See `toKitchenTicketItemsFromPlatform`.
    notes: item.notes,
  }))
}
