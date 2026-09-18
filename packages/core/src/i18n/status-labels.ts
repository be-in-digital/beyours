/**
 * The words a diner reads for an order status and a store status.
 *
 * WHY THIS MODULE EXISTS: the two badges mounted on the storefront —
 * `OrderStatusBadge` and `StoreStatusBadge` in `@be-yours/ui` — carried
 * eight and three hardcoded English labels with no way past them. Both are
 * mounted on French screens: an order page reading « Preparing » and « Out for
 * Delivery » between French sentences, and a store selector reading
 * « Temporarily Unavailable » under a French heading. The translation layer
 * #148 shipped could not reach either, because neither took a label from
 * outside.
 *
 * Two surfaces need the same vocabulary and cannot import each other —
 * `@be-yours/ui` (the badges, which need a label when the caller gives
 * none) and `@be-yours/restaurant` (the storefront hooks, which resolve
 * one through `t()`). So the vocabulary lives here, framework-free, and both
 * read it. Same arrangement, and the same reason, as
 * `@be-yours/core/allergens`.
 *
 * Each status carries two things:
 *
 *   `label` — the source-language word. French, because that is the language
 *     this product is written in (`REFERENCE_LOCALE` in both apps) and the one
 *     every translation falls back to. It is what a badge prints when no
 *     translation is supplied.
 *   `key`   — the catalogue key the storefront resolves for the locale being
 *     rendered. The catalogues (`apps/*​/lib/i18n/locales/*.json`) answer them;
 *     a key with no entry resolves to itself, which is why the app-side
 *     catalogue test asserts every key below is present.
 *
 * Import as `@be-yours/core/status-labels`.
 *
 * @packageDocumentation
 */

/** The eight statuses `orders.status` admits, in lifecycle order. */
export const ORDER_STATUS_KEYS = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
] as const

export type OrderStatusKey = (typeof ORDER_STATUS_KEYS)[number]

/** The three statuses a *published* establishment can be in. */
export const STORE_STATUS_KEYS = [
  "open",
  "closed",
  "temporarily_unavailable",
] as const

export type StoreStatusKey = (typeof STORE_STATUS_KEYS)[number]

export interface StatusVocabularyEntry {
  /** The source-language (French) word. */
  label: string
  /** The catalogue key the storefront translates through. */
  key: string
}

/**
 * Order statuses.
 *
 * `out_for_delivery` translates through `order.delivering` — the key the
 * catalogues have carried since #148 — while `delivered` has its own. The two
 * are genuinely different states and were once folded together, which showed
 * a diner "Delivered" for an order still in the van.
 */
export const ORDER_STATUS_VOCABULARY: Record<
  OrderStatusKey,
  StatusVocabularyEntry
> = {
  pending: { label: "En attente", key: "order.pending" },
  confirmed: { label: "Confirmée", key: "order.confirmed" },
  preparing: { label: "En préparation", key: "order.preparing" },
  ready: { label: "Prête", key: "order.ready" },
  out_for_delivery: { label: "En livraison", key: "order.delivering" },
  delivered: { label: "Livrée", key: "order.delivered" },
  completed: { label: "Terminée", key: "order.completed" },
  cancelled: { label: "Annulée", key: "order.cancelled" },
}

/**
 * Store statuses.
 *
 * `temporarily_unavailable` reuses `storefront.storeTempUnavailable`, which
 * the storefront already shows on the closed-restaurant screen: one sentence
 * for one state, rather than a second translation of the same words.
 */
export const STORE_STATUS_VOCABULARY: Record<
  StoreStatusKey,
  StatusVocabularyEntry
> = {
  open: { label: "Ouvert", key: "store.openNow" },
  closed: { label: "Fermé", key: "store.closed" },
  temporarily_unavailable: {
    label: "Temporairement indisponible",
    key: "storefront.storeTempUnavailable",
  },
}

/** Every catalogue key this vocabulary asks the storefront to answer. */
export const STATUS_LABEL_KEYS: readonly string[] = [
  ...ORDER_STATUS_KEYS.map((status) => ORDER_STATUS_VOCABULARY[status].key),
  ...STORE_STATUS_KEYS.map((status) => STORE_STATUS_VOCABULARY[status].key),
]

/**
 * Resolve one vocabulary into `{ status: label }`, through a translator.
 *
 * The translator is injected rather than imported: this module is
 * framework-free, and the only translator that exists is the storefront's,
 * which is React state. A translator that cannot answer a key returns the key
 * itself — so a miss falls back to the source-language label rather than
 * printing `order.preparing` on a badge.
 */
export function resolveStatusLabels<Status extends string>(
  vocabulary: Record<Status, StatusVocabularyEntry>,
  translate: (key: string) => string
): Record<Status, string> {
  const out = {} as Record<Status, string>
  for (const status of Object.keys(vocabulary) as Status[]) {
    const entry = vocabulary[status]
    const translated = translate(entry.key)
    out[status] =
      translated && translated !== entry.key ? translated : entry.label
  }
  return out
}
