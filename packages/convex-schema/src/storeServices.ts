/**
 * Which services an establishment offers, and which order types they allow.
 *
 * It lives next to the schema, like `storeStatus`, because the layers that need
 * the same answer cannot depend on one another: the order mutation
 * (`@be-yours/convex-functions`) and the storefront's order-type selector.
 *
 * WHY IT EXISTS. `globalSettings.services` is written by the settings page —
 * four switches, one per service — and the storefront read `store.overrides
 * .services` alone. That override is `undefined` on every establishment that
 * has not customised it, and the selector treated `undefined` as "show
 * everything": a restaurant that does not deliver still offered Livraison.
 * `orders.create` did not look at `args.type` at all, so the order went
 * through.
 */

import type { OrderType } from "./types"

export interface StoreServices {
  dineIn: boolean
  takeaway: boolean
  delivery: boolean
  clickAndCollect: boolean
}

/**
 * Everything on. The fallback for a deployment whose settings row has never
 * been saved — refusing every order type there would close a restaurant that
 * simply has not visited the settings page.
 */
export const DEFAULT_STORE_SERVICES: StoreServices = {
  dineIn: true,
  takeaway: true,
  delivery: true,
  clickAndCollect: true,
}

/**
 * The service each order type needs.
 *
 * `clickAndCollect` is deliberately absent: there are three order types and
 * four switches, and no order type carries that one today. Turning it on or off
 * changes nothing until one does — noted here rather than silently folded into
 * `takeaway`, which would make the "À emporter" switch mean two things.
 */
export const ORDER_TYPE_SERVICE: Record<OrderType, keyof StoreServices> = {
  delivery: "delivery",
  pickup: "takeaway",
  dine_in: "dineIn",
}

/** The order types, in the order the storefront offers them. */
export const ORDER_TYPES = Object.keys(ORDER_TYPE_SERVICE) as OrderType[]

/**
 * The services in force for an establishment.
 *
 * The store's override wins when it has one, whole rather than field by field —
 * that is how `stores.updateOverrides` writes it, and a half-merged services
 * object would be a state neither screen can display.
 */
export function resolveStoreServices(
  store: { overrides?: { services?: Partial<StoreServices> | null } | null } | null | undefined,
  globalSettings?: { services?: Partial<StoreServices> | null } | null
): StoreServices {
  const source = store?.overrides?.services ?? globalSettings?.services
  if (!source) return DEFAULT_STORE_SERVICES

  return {
    dineIn: source.dineIn ?? DEFAULT_STORE_SERVICES.dineIn,
    takeaway: source.takeaway ?? DEFAULT_STORE_SERVICES.takeaway,
    delivery: source.delivery ?? DEFAULT_STORE_SERVICES.delivery,
    clickAndCollect:
      source.clickAndCollect ?? DEFAULT_STORE_SERVICES.clickAndCollect,
  }
}

/** Whether this establishment accepts this kind of order. */
export function isOrderTypeOffered(
  type: OrderType,
  services: StoreServices
): boolean {
  return services[ORDER_TYPE_SERVICE[type]] === true
}
