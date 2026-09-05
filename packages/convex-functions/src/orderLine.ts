/**
 * Order line policy
 *
 * What one line of an order resolves to, and everything it can be refused for.
 *
 * WHY THIS EXISTS: `orders.create` re-fetched the product and recomputed its
 * price — the money was safe — and then took everything else on trust. A dish
 * switched off at 11 a.m. was still ordered and charged at noon. A sold-out
 * plate went to the kitchen. A pizza arrived without the size the owner marked
 * required, at the base price. The same option could be sent a hundred times,
 * and with a negative `priceModifier` — a discount for removing an ingredient —
 * a hundred repetitions drove the line to zero. `quantity: -3` was accepted.
 *
 * The browser checked most of this (`isProductAvailable`, the required-option
 * toast on the product page). A browser check is a courtesy to the customer,
 * not a rule: the cart survives an owner switching a dish off, and the mutation
 * is reachable without any page at all.
 *
 * Kept pure so every refusal is testable without a database, and so the
 * storefront could one day answer the same question with the same code.
 */

import { RefusalError } from "./refusal"
import { isWithinWindow, restaurantClock } from "./timeWindow"

export { restaurantClock }

export interface ProductOptionChoice {
  id: string
  name: string
  /** In cents. Negative is legitimate — "sans fromage, −0,50 €". */
  priceModifier: number
}

export interface ProductOption {
  id: string
  name: string
  required: boolean
  /** Absent means one choice, matching how the storefront renders the group. */
  maxSelections?: number
  choices: ProductOptionChoice[]
}

export interface SchedulingWindow {
  /** "11:00" */
  availableFrom?: string
  /** "14:00" */
  availableUntil?: string
  /** 0 = Sunday … 6 = Saturday */
  availableDays?: number[]
}

/** A product, as `orders.create` reads it back from the database. */
export interface OrderableProduct {
  name: string
  /** In cents. */
  price: number
  isActive: boolean
  options?: ProductOption[]
  stock?: { tracked: boolean; quantity: number }
  scheduling?: SchedulingWindow
}

/** One option the customer picked, as the checkout sends it. */
export interface SelectedOptionInput {
  optionId?: string
  optionName: string
  choiceId?: string
  choiceName?: string
  priceModifier: number
}

/** The same option, resolved against the product the kitchen will cook. */
export interface ResolvedOption {
  optionId: string
  optionName: string
  choiceId?: string
  choiceName?: string
  priceModifier: number
}

export interface VerifiedLine {
  quantity: number
  /** In cents, from the product — never from the client. */
  unitPrice: number
  selectedOptions: ResolvedOption[]
  /** In cents. */
  subtotal: number
}

export type LineRejectionReason =
  | "invalid_quantity"
  | "inactive"
  | "insufficient_stock"
  | "outside_window"
  | "unknown_choice"
  | "missing_required_option"
  | "too_many_choices"

/**
 * A line the kitchen cannot cook, refused in a way the diner can act on.
 *
 * `RefusalError` is what carries the sentence to the browser — see `refusal.ts`
 * for why a plain `Error` never arrived. `productName` rides along in `data` as
 * well as on the class, so a screen can name the dish without parsing it back
 * out of the sentence.
 */
export class LineRejectedError extends RefusalError<LineRejectionReason> {
  readonly reason: LineRejectionReason
  /** The dish the customer has to act on, for a message that names it. */
  readonly productName: string

  constructor(
    reason: LineRejectionReason,
    productName: string,
    message: string
  ) {
    super("LineRejectedError", reason, message, { productName })
    this.reason = reason
    this.productName = productName
  }
}

/**
 * A ceiling on one line, against a typo or a forged quantity.
 *
 * Not a business rule — a restaurant that genuinely sells a thousand of one
 * dish in a single order takes that call by telephone. It exists so an absurd
 * number cannot be turned into an absurd charge.
 */
export const MAX_LINE_QUANTITY = 999

/**
 * Whether the dish is inside its serving window right now.
 *
 * The window itself is `timeWindow`, shared with the happy-hour scheduling of a
 * promotion: same shape, same timezone question, one implementation.
 */
export function isWithinSchedulingWindow(
  scheduling: SchedulingWindow | undefined,
  now: number,
  timezone?: string
): boolean {
  if (!scheduling) return true
  return isWithinWindow(
    {
      days: scheduling.availableDays,
      from: scheduling.availableFrom,
      until: scheduling.availableUntil,
    },
    now,
    timezone
  )
}

/**
 * Resolve what the customer picked against what the product actually offers.
 *
 * Options the product no longer has are dropped, as they always were: they
 * carry no price and reach nothing. A choice that no longer exists *inside* a
 * group is refused instead — it used to be kept at `priceModifier: 0` under the
 * name the client sent, which put arbitrary customer-written text on the
 * kitchen ticket for free.
 *
 * Duplicates collapse. The same choice sent twice is one choice: the price is
 * counted once, and a group capped at one selection is not tripped by a repeat.
 */
export function resolveSelectedOptions(
  product: OrderableProduct,
  selected: SelectedOptionInput[]
): ResolvedOption[] {
  const resolved: ResolvedOption[] = []
  const seen = new Set<string>()

  for (const sel of selected) {
    const option = product.options?.find(
      (o) => o.id === sel.optionId || o.name === sel.optionName
    )
    if (!option) continue

    const choice = option.choices?.find(
      (c) => c.id === sel.choiceId || c.name === sel.choiceName
    )
    if (!choice) {
      throw new LineRejectedError(
        "unknown_choice",
        product.name,
        `« ${product.name} » a changé : l'option « ${sel.choiceName ?? sel.optionName} » n'existe plus. Retirez l'article de votre Box et rajoutez-le.`
      )
    }

    const key = `${option.id}::${choice.id}`
    if (seen.has(key)) continue
    seen.add(key)

    resolved.push({
      optionId: option.id,
      optionName: option.name,
      choiceId: choice.id,
      choiceName: choice.name,
      priceModifier: choice.priceModifier,
    })
  }

  return resolved
}

/** Throw unless the option groups are satisfied as the owner configured them. */
function assertOptionGroups(
  product: OrderableProduct,
  resolved: ResolvedOption[]
): void {
  for (const option of product.options ?? []) {
    const picked = resolved.filter((r) => r.optionId === option.id)

    if (option.required && picked.length === 0) {
      throw new LineRejectedError(
        "missing_required_option",
        product.name,
        `« ${product.name} » exige un choix : ${option.name}.`
      )
    }

    // No `maxSelections` means the group takes one choice — the same reading
    // the storefront applies when it turns the group into radio buttons.
    const max = option.maxSelections ?? 1
    if (picked.length > max) {
      throw new LineRejectedError(
        "too_many_choices",
        product.name,
        `« ${product.name} » : ${option.name} accepte ${max} choix au maximum.`
      )
    }
  }
}

/**
 * Verify one ordered line against the product the kitchen would cook, and
 * return what may be written on the order.
 *
 * Everything priced here comes from the product row. The client's `unitPrice`,
 * `subtotal` and `priceModifier` are read for nothing at all.
 */
export function verifyOrderLine(params: {
  product: OrderableProduct
  quantity: number
  selectedOptions: SelectedOptionInput[]
  now: number
  timezone?: string
}): VerifiedLine {
  const { product, quantity, selectedOptions, now, timezone } = params

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new LineRejectedError(
      "invalid_quantity",
      product.name,
      `Quantité invalide pour « ${product.name} ».`
    )
  }

  if (quantity > MAX_LINE_QUANTITY) {
    throw new LineRejectedError(
      "invalid_quantity",
      product.name,
      `« ${product.name} » : ${MAX_LINE_QUANTITY} au maximum par commande. Contactez le restaurant pour une commande de groupe.`
    )
  }

  if (!product.isActive) {
    throw new LineRejectedError(
      "inactive",
      product.name,
      `« ${product.name} » n'est plus disponible. Retirez l'article de votre Box.`
    )
  }

  if (product.stock?.tracked && product.stock.quantity < quantity) {
    throw new LineRejectedError(
      "insufficient_stock",
      product.name,
      product.stock.quantity > 0
        ? `« ${product.name} » : il n'en reste que ${product.stock.quantity}.`
        : `« ${product.name} » est épuisé.`
    )
  }

  if (!isWithinSchedulingWindow(product.scheduling, now, timezone)) {
    throw new LineRejectedError(
      "outside_window",
      product.name,
      `« ${product.name} » n'est pas servi à cette heure-ci.`
    )
  }

  const resolvedOptions = resolveSelectedOptions(product, selectedOptions)
  assertOptionGroups(product, resolvedOptions)

  const optionsTotal = resolvedOptions.reduce(
    (sum, option) => sum + option.priceModifier,
    0
  )

  // A single removal discount larger than the dish itself would otherwise make
  // the line negative and pay for the rest of the basket.
  const unitTotal = Math.max(0, product.price + optionsTotal)

  return {
    quantity,
    unitPrice: product.price,
    selectedOptions: resolvedOptions,
    subtotal: unitTotal * quantity,
  }
}
