import * as React from "react"
import {
  Bean,
  Carrot,
  Droplet,
  Egg,
  Fish,
  Flower,
  Milk,
  Nut,
  Salad,
  Shell,
  Snail,
  Sparkles,
  Info,
  Sprout,
  Vegan,
  Wheat,
  Wine,
} from "lucide-react"
import {
  ALLERGEN_ANNOUNCEMENT,
  KNOWN_ALLERGENS,
  normalizeAllergen,
  resolveAllergens,
  type Allergen,
  type AllergenKind,
  type AllergenLocale,
} from "@be-in-digital/core/allergens"
import { cn } from "../../lib/utils"

/**
 * The names, the matching and the labels all come from
 * `@be-in-digital/core/allergens`, which is framework-free so the kitchen
 * ticket, the admin product form and the Uber Eats menu sync can consult the
 * same vocabulary this badge does. Those four surfaces each used to carry
 * their own idea of what an allergen was, which is exactly how they diverged:
 * one crashed on French, one printed raw strings, one had no input at all and
 * one dropped the field. Add a name there, not here.
 *
 * What stays here is what only a React component can own: the icon per
 * allergen, and the markup.
 */
export {
  KNOWN_ALLERGENS,
  normalizeAllergen,
  resolveAllergens,
  type Allergen,
  type AllergenLocale,
}

export interface AllergenBadgeProps {
  /**
   * A value straight out of `products.allergens`. Any string is accepted:
   * one the vocabulary recognises renders with its icon and canonical name,
   * one it does not renders as the owner wrote it. Never cast to `Allergen`
   * at the call site — that cast is what used to crash this component.
   *
   * `string & {}` keeps editor autocomplete on the known keys while still
   * admitting arbitrary strings.
   */
  allergen: Allergen | (string & {})
  className?: string
  /**
   * Show the name next to the icon. Defaults to `true`: an icon on its own is
   * not a disclosure — a wheat glyph does not tell a diner the dish contains
   * gluten. Pass `false` only where the name is already stated nearby.
   */
  showLabel?: boolean
  /** Language of the visible and announced text. Defaults to French. */
  locale?: AllergenLocale
}

type AllergenIcon = React.ComponentType<{
  className?: string
  "aria-hidden"?: boolean
}>

/**
 * The glyph per allergen. Icons are the one part of the vocabulary that cannot
 * live in `@be-in-digital/core` — they are React components — so this table is
 * keyed by `Allergen` and therefore cannot silently fall behind
 * `KNOWN_ALLERGENS`: adding a name without choosing an icon is a type error.
 */
const allergenIcons: Record<Allergen, AllergenIcon> = {
  gluten: Wheat,
  crustaceans: Shell,
  eggs: Egg,
  fish: Fish,
  peanuts: Bean,
  soy: Sprout,
  dairy: Milk,
  nuts: Nut,
  celery: Carrot,
  mustard: Droplet,
  sesame: Sparkles,
  sulphites: Wine,
  lupin: Flower,
  molluscs: Snail,
  shellfish: Shell,
  vegetarian: Salad,
  vegan: Vegan,
}

/**
 * An allergen name the vocabulary does not recognise renders as the owner
 * typed it, rather than throwing.
 *
 * `products.allergens` is `v.array(v.string())`. The values in it are French —
 * the seed writes `arachides`, the schema test writes `lactose`, and the GPT
 * extractor in `imageToProduct.ts` is prompted in French and told to answer in
 * French. Every one of those missed the nine English keys this component used
 * to declare, and reading `.icon` off the resulting `undefined` took the whole
 * dish page down with a client-side TypeError. The page that dies is the page
 * carrying the allergen disclosure that INCO 1169/2011 makes mandatory.
 *
 * Rendering the raw string is the safe reading of "we do not know this name":
 * the diner reads exactly what the restaurant declared. Dropping the badge, or
 * swallowing the value into a generic "other", would hide a disclosure — which
 * is the hazard the crash was hiding in the first place. So an unrecognised
 * value keeps its text visible even when `showLabel` is false: its icon means
 * nothing on its own. And it is announced as the restaurant's own wording, not
 * as an allergen — see `ALLERGEN_ANNOUNCEMENT.unverified`.
 *
 * There is no `title` here. `aria-label` already names the badge, and a `title`
 * carrying the same sentence falls through accname to the accessible
 * *description* — a screen reader then announces "Allergène : Gluten, image,
 * Allergène : Gluten". The visible label is the tooltip's job now.
 */
const AllergenBadge: React.FC<AllergenBadgeProps> = ({
  allergen,
  className,
  showLabel = true,
  locale = "fr",
}) => {
  const raw = typeof allergen === "string" ? allergen.trim() : ""
  if (!raw) return null

  // An own-property check, not `??`: `ALLERGEN_ANNOUNCEMENT["constructor"]` is
  // a function. `hasOwnProperty.call` rather than `Object.hasOwn` so this file
  // compiles under every consumer's tsconfig — it is consumed as raw source.
  const lang: AllergenLocale = Object.prototype.hasOwnProperty.call(
    ALLERGEN_ANNOUNCEMENT,
    locale
  )
    ? locale
    : "fr"

  // One resolution, shared with every other surface that shows this value.
  const [resolved] = resolveAllergens([raw], lang)
  if (!resolved) return null

  const kind: AllergenKind = resolved.kind
  const Icon = resolved.allergen ? allergenIcons[resolved.allergen] : Info
  const announce = ALLERGEN_ANNOUNCEMENT[lang][kind](resolved.label)
  // An unrecognised allergen has no meaningful icon, so its name always shows.
  const withText = showLabel || kind === "unverified"

  return (
    <div
      role="img"
      aria-label={announce}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs",
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {withText && <span>{resolved.label}</span>}
    </div>
  )
}

export { AllergenBadge }
