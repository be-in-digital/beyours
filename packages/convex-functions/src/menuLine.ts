/**
 * A *formule* the customer composed, verified and priced.
 *
 * WHAT A FORMULE IS HERE, because the word « menu » is ambiguous in this
 * repository and the two meanings sit next to each other in the admin nav under
 * « Menu & Produits ». The à-la-carte CARD is `products` + `categories`. Only
 * the `menus` table is the fixed-price *formule* — entrée + plat + dessert for
 * 18,90 € — and this module is about that one.
 *
 * WHY IT EXISTS (#352). The admin half shipped complete: schema, CRUD, RBAC, a
 * 473-line tab, a 761-line section builder, and the seven customer-facing
 * strings already translated into three languages. `menu.addComboToCart`
 * (« Ajouter la formule au panier ») was referenced zero times in either app.
 * Someone translated the button before anyone built it. `orders.create` refused
 * a line with no `productId` outright, so no formule could ever be bought.
 *
 * TWO MONEY PROBLEMS LIVE HERE, and they are the reason this is its own module
 * rather than a branch inside the order mutation.
 *
 * 1. VAT ACROSS A MIXED-RATE BUNDLE. A formule of food at 10 % and a glass of
 *    wine at 20 % is sold at ONE price, and French VAT is owed per rate. The
 *    bundle price therefore has to be split across the chosen dishes before any
 *    tax can be computed. `allocateBundlePrice` does it PRO RATA ON À-LA-CARTE
 *    VALUE, which is the standard treatment: each dish takes the share of the
 *    bundle that its own menu price represents of the bundle's à-la-carte
 *    total. See that function for what happens to the leftover centime.
 *
 * 2. PROMOTIONS. Decided here and stated rather than left to emerge: a formule's
 *    dishes are NOT discountable by product- or category-scoped promotions. The
 *    bundle price IS the owner's discount — they set it below the à-la-carte
 *    total on purpose — and letting « -20 % sur les desserts » also apply to the
 *    dessert inside it discounts the same dish twice without the owner having
 *    asked for that. Order-level promotions (a percentage or an amount off the
 *    whole order) still apply, because those are about the order and not about
 *    a dish. The order mutation enforces this by not putting formule lines into
 *    `discountableLines`; `menu-promotions.test.ts` holds it.
 *
 * Pure, like `orderLine.ts` next to it: the mutation reads the menu and the
 * products and hands them here, so every rule below is testable without a
 * database.
 */

import { RefusalError } from "./refusal"
import {
  verifyOrderLine,
  type OrderableProduct,
  type ResolvedOption,
  type SelectedOptionInput,
} from "./orderLine"

/** One section of a formule, as `menus.sections` stores it. */
export interface MenuSection {
  sectionId: string
  label: string
  type: "fixed" | "pick_products" | "pick_category"
  required: boolean
  minChoices: number
  maxChoices: number
  allowDuplicates: boolean
  sortOrder: number
  productId?: string
  productIds?: string[]
  categoryId?: string
}

/** The formule itself. */
export interface OrderableMenu {
  name: string
  /** In cents, for the whole bundle, whatever is chosen inside it. */
  price: number
  isActive: boolean
  sections: MenuSection[]
}

/** One dish the customer picked, as the checkout sends it. */
export interface MenuChoiceInput {
  sectionId: string
  productId: string
  quantity?: number
  selectedOptions?: SelectedOptionInput[]
}

/** A product the mutation has already read and scoped to the store. */
export interface MenuChoiceProduct extends OrderableProduct {
  /** The product's own VAT rate, as a percentage. */
  taxRate?: number
  /** Its category, which a `pick_category` section is resolved against. */
  categoryId?: string
  preparationTime?: number
}

export type MenuRejectionReason =
  | "menu_inactive"
  | "menu_empty"
  | "unknown_section"
  | "missing_section"
  | "too_few_choices"
  | "too_many_choices"
  | "duplicate_choice"
  | "choice_not_offered"
  | "invalid_quantity"

/**
 * A formule the kitchen cannot serve, refused in a way the diner can act on.
 *
 * Same shape as `LineRejectedError`: `RefusalError` is what carries the French
 * sentence to the browser, and the section label rides along in `data` so a
 * screen can point at the row the customer has to fix.
 */
export class MenuRejectedError extends RefusalError<MenuRejectionReason> {
  readonly reason: MenuRejectionReason
  readonly menuName: string
  /** The section the customer has to act on, when the refusal is about one. */
  readonly sectionLabel?: string

  constructor(
    reason: MenuRejectionReason,
    menuName: string,
    message: string,
    sectionLabel?: string
  ) {
    // Only the keys that have a value: `details` is
    // `Record<string, string | number>`, and an explicit `undefined` would
    // travel to the browser as a key with nothing in it.
    super("MenuRejectedError", reason, message, {
      menuName,
      ...(sectionLabel === undefined ? {} : { sectionLabel }),
    })
    this.reason = reason
    this.menuName = menuName
    this.sectionLabel = sectionLabel
  }
}

/** One dish of a verified formule, priced at its share of the bundle. */
export interface VerifiedMenuChoice {
  sectionId: string
  sectionLabel: string
  productId: string
  productName: string
  quantity: number
  selectedOptions: ResolvedOption[]
  /**
   * What this dish costs à la carte, options included — the basis the bundle
   * price is split on, and not what the customer is charged.
   */
  alaCarteSubtotal: number
  /** This dish's share of the bundle price. The sum over a formule is the price. */
  subtotal: number
  /** The rate this share is taxed at, from the product. */
  taxRatePercent: number
}

export interface VerifiedMenu {
  menuName: string
  /** In cents — exactly `menu.price`, whatever the shares round to. */
  price: number
  choices: VerifiedMenuChoice[]
  /** The longest preparation time among the chosen dishes. */
  preparationTime: number
}

/** The most dishes one section may be filled with. */
export const MAX_SECTION_CHOICES = 20

/**
 * Split a bundle price across its dishes, pro rata on à-la-carte value.
 *
 * WHY PRO RATA AND NOT EVENLY. A formule of a 4 € coffee and a 16 € main sold
 * at 18 € is not two 9 € dishes. If the coffee is taxed at 10 % and the main at
 * 20 %, splitting evenly moves 5 € of taxable base from one rate to the other
 * and the VAT owed is wrong — silently, on every such order, on an invoice that
 * is a numbered fiscal document. Pro rata on the à-la-carte prices is the
 * standard French treatment of a *offre composite à prix global*.
 *
 * THE LEFTOVER CENTIME. Integer cents rarely divide: 1000 across values of 3
 * and 7 gives 300 and 700, but 1000 across 1, 1 and 1 gives 333, 333, 333 and
 * loses one. The remainder goes to the LARGEST share, deterministically, ties
 * broken by position — so the shares always sum to exactly `price`, and two
 * runs over the same basket produce the same invoice. Giving it to the largest
 * share also puts the rounding on the rate with the biggest base, which is the
 * smallest possible distortion.
 *
 * A ZERO À-LA-CARTE TOTAL — every dish free, which a promotion-priced product
 * can produce — has no ratio to divide by. The bundle is then split as evenly as
 * integer cents allow, since no dish has a claim on more of it than another.
 */
export function allocateBundlePrice(
  price: number,
  alaCarteValues: number[]
): number[] {
  if (alaCarteValues.length === 0) return []

  const total = alaCarteValues.reduce((sum, value) => sum + value, 0)

  const shares =
    total > 0
      ? alaCarteValues.map((value) => Math.floor((price * value) / total))
      : alaCarteValues.map(() => Math.floor(price / alaCarteValues.length))

  const allocated = shares.reduce((sum, share) => sum + share, 0)
  let remainder = price - allocated

  // Hand the remaining cents out one at a time, largest basis first. One pass is
  // enough: flooring loses strictly less than one cent per share, so the
  // remainder is smaller than the number of shares.
  const order = alaCarteValues
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index)

  for (const { index } of order) {
    if (remainder <= 0) break
    shares[index] = (shares[index] as number) + 1
    remainder -= 1
  }

  return shares
}

/** The section a choice names, or a refusal that says which one is wrong. */
function sectionFor(
  menu: OrderableMenu,
  sectionId: string
): MenuSection {
  const section = menu.sections.find((candidate) => candidate.sectionId === sectionId)
  if (!section) {
    throw new MenuRejectedError(
      "unknown_section",
      menu.name,
      `« ${menu.name} » a changé. Recomposez votre formule.`
    )
  }
  return section
}

/**
 * Is this product one the section actually offers?
 *
 * The whole point of asking: without it a customer could put the 38 € plateau
 * into the « dessert au choix » row of an 18 € formule. `pick_category` is
 * resolved against the product's own `categoryId` rather than against a stored
 * list, because the section means "anything currently in this category" and the
 * category's contents move.
 */
function offersProduct(
  section: MenuSection,
  productId: string,
  product: MenuChoiceProduct
): boolean {
  switch (section.type) {
    case "fixed":
      return section.productId === productId
    case "pick_products":
      return (section.productIds ?? []).includes(productId)
    case "pick_category":
      return (
        section.categoryId !== undefined &&
        product.categoryId === section.categoryId
      )
    default:
      return false
  }
}

/**
 * How many dishes this section must receive.
 *
 * `fixed` is one, always, whatever the stored bounds say: the section names a
 * single mandatory dish and the admin form does not offer the choice counts for
 * it. An optional section may receive none; a required one may not receive
 * fewer than `minChoices`, and `minChoices` of 0 on a required section reads as
 * one, because "required" and "zero needed" cannot both be true.
 */
export function choiceBounds(section: MenuSection): { min: number; max: number } {
  if (section.type === "fixed") return { min: 1, max: 1 }
  const max = Math.min(
    Math.max(1, Math.floor(section.maxChoices) || 1),
    MAX_SECTION_CHOICES
  )
  const min = section.required
    ? Math.min(Math.max(1, Math.floor(section.minChoices) || 1), max)
    : Math.min(Math.max(0, Math.floor(section.minChoices) || 0), max)
  return { min, max }
}

/**
 * Verify a composed formule and price its dishes.
 *
 * `products` maps a product id to the row the mutation has already read and
 * scoped to the store — this module never touches a database, and it trusts the
 * caller for the store scope exactly as `verifyOrderLine` does.
 *
 * Every chosen dish goes through `verifyOrderLine`, so a formule is refused for
 * the same reasons an à-la-carte line is: sold out, deactivated, outside its
 * serving window, or an option that is not on the product. A formule that
 * silently dropped a sold-out dish would send the kitchen a bundle it cannot
 * make.
 */
export function verifyMenuSelection(params: {
  menu: OrderableMenu
  choices: MenuChoiceInput[]
  products: Map<string, MenuChoiceProduct>
  /** Fallback VAT rate for a product predating `products.taxRate`. */
  taxRatePercent: number
  now: number
  timezone?: string
}): VerifiedMenu {
  const { menu, choices, products, taxRatePercent, now, timezone } = params

  if (!menu.isActive) {
    throw new MenuRejectedError(
      "menu_inactive",
      menu.name,
      `« ${menu.name} » n'est plus proposée. Retirez-la de votre Box.`
    )
  }
  if (menu.sections.length === 0) {
    // A formule with no sections is a price with nothing behind it. The admin
    // form cannot save one; a row written before it could, or by a script, can.
    throw new MenuRejectedError(
      "menu_empty",
      menu.name,
      `« ${menu.name} » n'a aucun plat. Retirez-la de votre Box.`
    )
  }

  const ordered = [...menu.sections].sort((a, b) => a.sortOrder - b.sortOrder)
  const verified: VerifiedMenuChoice[] = []
  let preparationTime = 0

  for (const section of ordered) {
    const bounds = choiceBounds(section)
    const forSection = choices.filter((choice) => choice.sectionId === section.sectionId)

    // `fixed` needs no choice from the customer: the dish is the section. An
    // empty selection for one is filled in rather than refused, so a storefront
    // that sends only the picks still composes a valid formule.
    const effective =
      section.type === "fixed" && forSection.length === 0 && section.productId
        ? [{ sectionId: section.sectionId, productId: section.productId }]
        : forSection

    if (effective.length < bounds.min) {
      throw new MenuRejectedError(
        effective.length === 0 ? "missing_section" : "too_few_choices",
        menu.name,
        bounds.min === 1
          ? `Choisissez un plat pour « ${section.label} ».`
          : `Choisissez ${bounds.min} plats pour « ${section.label} ».`,
        section.label
      )
    }
    if (effective.length > bounds.max) {
      throw new MenuRejectedError(
        "too_many_choices",
        menu.name,
        bounds.max === 1
          ? `« ${section.label} » n'accepte qu'un seul plat.`
          : `« ${section.label} » n'accepte que ${bounds.max} plats.`,
        section.label
      )
    }

    if (!section.allowDuplicates) {
      const seen = new Set<string>()
      for (const choice of effective) {
        if (seen.has(choice.productId)) {
          throw new MenuRejectedError(
            "duplicate_choice",
            menu.name,
            `« ${section.label} » n'accepte pas deux fois le même plat.`,
            section.label
          )
        }
        seen.add(choice.productId)
      }
    }

    for (const choice of effective) {
      const product = products.get(choice.productId)
      if (!product || !offersProduct(section, choice.productId, product)) {
        // The same refusal for "not in the catalogue" and "not offered by this
        // section": both are a selection this formule cannot contain, and
        // telling a caller which of the two it was tells them what exists.
        throw new MenuRejectedError(
          "choice_not_offered",
          menu.name,
          `Ce plat n'est pas proposé dans « ${section.label} ».`,
          section.label
        )
      }

      const quantity = choice.quantity ?? 1
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > bounds.max) {
        throw new MenuRejectedError(
          "invalid_quantity",
          menu.name,
          `Quantité invalide pour « ${section.label} ».`,
          section.label
        )
      }

      // The dish's own availability, stock, window and options — the same gate
      // an à-la-carte line passes. The PRICE it returns is the à-la-carte one,
      // which is the basis for the split and not what is charged.
      const line = verifyOrderLine({
        product,
        quantity,
        selectedOptions: choice.selectedOptions ?? [],
        now,
        timezone,
      })

      if (typeof product.preparationTime === "number") {
        preparationTime = Math.max(preparationTime, product.preparationTime)
      }

      verified.push({
        sectionId: section.sectionId,
        sectionLabel: section.label,
        productId: choice.productId,
        productName: product.name,
        quantity: line.quantity,
        selectedOptions: line.selectedOptions,
        alaCarteSubtotal: line.subtotal,
        // Replaced below, once every dish is known and the split can be done.
        subtotal: 0,
        taxRatePercent:
          typeof product.taxRate === "number" ? product.taxRate : taxRatePercent,
      })
    }
  }

  // A choice naming a section this formule does not have is a stale basket, and
  // it is checked AFTER the sections so the customer hears about the row they
  // have to fill before the one that no longer exists.
  for (const choice of choices) {
    sectionFor(menu, choice.sectionId)
  }

  const shares = allocateBundlePrice(
    menu.price,
    verified.map((choice) => choice.alaCarteSubtotal)
  )
  verified.forEach((choice, index) => {
    choice.subtotal = shares[index] as number
  })

  return {
    menuName: menu.name,
    price: menu.price,
    choices: verified,
    preparationTime,
  }
}
