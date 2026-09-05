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
import { cn } from "../../lib/utils"

/**
 * The fourteen allergens Annex II of Regulation (EU) 1169/2011 (INCO) makes a
 * restaurant declare, plus the two dietary markers this component already
 * carried. Keys stay English to match the rest of the design system; the text
 * a diner reads comes from `allergenConfig`, which is bilingual.
 *
 * This union is a vocabulary, not a constraint. `products.allergens` is
 * `v.array(v.string())` (packages/convex-schema/src/tables/catalog.ts) and an
 * owner types whatever names their dish — so `AllergenBadgeProps.allergen`
 * accepts any string and this list only says which ones we recognise.
 */
export const KNOWN_ALLERGENS = [
  // Annex II
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "dairy",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
  // English "shellfish" spans Annex II §2 and §14. It cannot be narrowed to
  // either without dropping the other, so it declares both.
  "shellfish",
  // Dietary markers, kept from the component's original union
  "vegetarian",
  "vegan",
] as const

export type Allergen = (typeof KNOWN_ALLERGENS)[number]

export type AllergenLocale = "fr" | "en"

export interface AllergenBadgeProps {
  /**
   * A value straight out of `products.allergens`. Any string is accepted:
   * one this component recognises renders with its icon and canonical name,
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

type AllergenKind =
  /** One of the fourteen Annex II allergens. */
  | "allergen"
  /** A dietary marker, not an allergen, and never announced as one. */
  | "diet"
  /** A name this component does not recognise. It claims nothing about it. */
  | "unverified"

interface AllergenEntry {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  kind: Exclude<AllergenKind, "unverified">
  label: Record<AllergenLocale, string>
}

const allergenConfig: Record<Allergen, AllergenEntry> = {
  gluten: {
    icon: Wheat,
    kind: "allergen",
    label: { fr: "Gluten", en: "Gluten" },
  },
  crustaceans: {
    icon: Shell,
    kind: "allergen",
    label: { fr: "Crustacés", en: "Crustaceans" },
  },
  eggs: {
    icon: Egg,
    kind: "allergen",
    label: { fr: "Œufs", en: "Eggs" },
  },
  fish: {
    icon: Fish,
    kind: "allergen",
    label: { fr: "Poisson", en: "Fish" },
  },
  peanuts: {
    icon: Bean,
    kind: "allergen",
    label: { fr: "Arachides", en: "Peanuts" },
  },
  soy: {
    icon: Sprout,
    kind: "allergen",
    label: { fr: "Soja", en: "Soy" },
  },
  dairy: {
    icon: Milk,
    kind: "allergen",
    label: { fr: "Lait", en: "Milk" },
  },
  nuts: {
    icon: Nut,
    kind: "allergen",
    label: { fr: "Fruits à coque", en: "Nuts" },
  },
  celery: {
    icon: Carrot,
    kind: "allergen",
    label: { fr: "Céleri", en: "Celery" },
  },
  mustard: {
    icon: Droplet,
    kind: "allergen",
    label: { fr: "Moutarde", en: "Mustard" },
  },
  sesame: {
    icon: Sparkles,
    kind: "allergen",
    label: { fr: "Sésame", en: "Sesame" },
  },
  sulphites: {
    icon: Wine,
    kind: "allergen",
    label: { fr: "Sulfites", en: "Sulphites" },
  },
  lupin: {
    icon: Flower,
    kind: "allergen",
    label: { fr: "Lupin", en: "Lupin" },
  },
  molluscs: {
    icon: Snail,
    kind: "allergen",
    label: { fr: "Mollusques", en: "Molluscs" },
  },
  shellfish: {
    icon: Shell,
    kind: "allergen",
    label: { fr: "Crustacés et mollusques", en: "Shellfish" },
  },
  vegetarian: {
    icon: Salad,
    kind: "diet",
    label: { fr: "Végétarien", en: "Vegetarian" },
  },
  vegan: {
    icon: Vegan,
    kind: "diet",
    label: { fr: "Végan", en: "Vegan" },
  },
}

/**
 * Spellings that unambiguously name one of the entries above.
 *
 * Keys are already normalised — lower case, accents stripped, punctuation
 * collapsed to single spaces — so `Fruits à coque`, `FRUITS A COQUE` and
 * `fruits-a-coque` all land on the same row.
 *
 * Only names of the allergen *category* belong here. An ingredient that merely
 * contains an allergen ("beurre", "crevette", "fruits de mer") is deliberately
 * absent: guessing which category an ingredient belongs to would put a name on
 * the badge that the owner did not write, and a wrong allergen is worse than an
 * unstyled one. Anything not listed renders as typed.
 */
const allergenAliases: Record<string, Allergen> = {
  // gluten — Annex II names the cereals explicitly
  gluten: "gluten",
  "cereales contenant du gluten": "gluten",
  "cereales de gluten": "gluten",
  "cereals containing gluten": "gluten",
  "gluten de ble": "gluten",
  "farine de ble": "gluten",
  triticale: "gluten",
  khorasan: "gluten",
  ble: "gluten",
  froment: "gluten",
  seigle: "gluten",
  orge: "gluten",
  avoine: "gluten",
  epeautre: "gluten",
  kamut: "gluten",
  wheat: "gluten",
  rye: "gluten",
  barley: "gluten",
  oats: "gluten",
  spelt: "gluten",

  // crustaceans
  crustace: "crustaceans",
  crustaces: "crustaceans",
  crustacean: "crustaceans",
  crustaceans: "crustaceans",
  shellfish: "shellfish",

  // eggs
  oeuf: "eggs",
  oeufs: "eggs",
  egg: "eggs",
  eggs: "eggs",
  "blanc d oeuf": "eggs",
  "blancs d oeufs": "eggs",

  // fish
  poisson: "fish",
  poissons: "fish",
  fish: "fish",

  // peanuts
  arachide: "peanuts",
  arachides: "peanuts",
  cacahuete: "peanuts",
  cacahuetes: "peanuts",
  peanut: "peanuts",
  peanuts: "peanuts",
  groundnuts: "peanuts",

  // soy
  soja: "soy",
  soy: "soy",
  soya: "soy",
  soybeans: "soy",
  "lecithine de soja": "soy",
  "soy lecithin": "soy",

  // dairy
  lait: "dairy",
  laits: "dairy",
  lactose: "dairy",
  "produits laitiers": "dairy",
  "proteines de lait": "dairy",
  "lait et produits laitiers": "dairy",
  milk: "dairy",
  dairy: "dairy",

  // tree nuts
  "fruit a coque": "nuts",
  "fruits a coque": "nuts",
  "fruits a coques": "nuts",
  noix: "nuts",
  noisette: "nuts",
  noisettes: "nuts",
  amande: "nuts",
  amandes: "nuts",
  pistache: "nuts",
  pistaches: "nuts",
  "noix de cajou": "nuts",
  "noix de pecan": "nuts",
  "noix du bresil": "nuts",
  "noix de macadamia": "nuts",
  nut: "nuts",
  nuts: "nuts",
  "tree nuts": "nuts",
  almond: "nuts",
  almonds: "nuts",
  hazelnut: "nuts",
  hazelnuts: "nuts",
  walnut: "nuts",
  walnuts: "nuts",
  cashew: "nuts",
  cashews: "nuts",
  pistachio: "nuts",
  pistachios: "nuts",
  pecan: "nuts",
  pecans: "nuts",
  "brazil nut": "nuts",
  "brazil nuts": "nuts",
  macadamia: "nuts",

  // celery
  celeri: "celery",
  "celeri rave": "celery",
  "celeri branche": "celery",
  celery: "celery",
  celeriac: "celery",

  // mustard
  moutarde: "mustard",
  "graines de moutarde": "mustard",
  mustard: "mustard",

  // sesame
  sesame: "sesame",
  "graines de sesame": "sesame",
  "sesame seeds": "sesame",

  // sulphites
  sulfite: "sulphites",
  sulfites: "sulphites",
  "anhydride sulfureux": "sulphites",
  "dioxyde de soufre": "sulphites",
  "sulfur dioxide": "sulphites",
  e220: "sulphites",
  "anhydride sulfureux et sulfites": "sulphites",
  so2: "sulphites",
  sulphite: "sulphites",
  sulphites: "sulphites",

  // lupin
  lupin: "lupin",
  lupins: "lupin",
  lupine: "lupin",
  "farine de lupin": "lupin",

  // molluscs
  mollusque: "molluscs",
  mollusques: "molluscs",
  mollusc: "molluscs",
  molluscs: "molluscs",
  mollusk: "molluscs",
  mollusks: "molluscs",

  // dietary markers
  vegetarien: "vegetarian",
  vegetarienne: "vegetarian",
  vegetariens: "vegetarian",
  vegetarian: "vegetarian",
  vegan: "vegan",
  vegetalien: "vegan",
  vegetalienne: "vegan",
  vegetaliens: "vegan",
}

/**
 * Lower case, expand ligatures, strip diacritics, collapse anything that is not
 * a letter or a digit into a single space. `"Fruits à coque"`,
 * `"FRUITS A COQUE"` and `"fruits_a_coque"` all come out as
 * `"fruits a coque"`.
 *
 * The ligature step is not decoration: `œ` and `æ` are single code points that
 * NFD does not decompose, so `"Œufs"` — the correct French spelling — would
 * otherwise normalise to `"ufs"` and miss the table entirely.
 */
/** Zero-width characters a paste from Word or Docs leaves behind. */
const ZERO_WIDTH = /[\u200b\u200c\u200d\u2060\ufeff]/g

/**
 * Symbols that negate what follows them. A value carrying one is never
 * resolved to an allergen: `gluten ✗` means the dish has none, and announcing
 * "Allergène : Gluten" for it is the inversion this component must never make.
 * A leading hyphen is deliberately absent — in a menu it is a bullet, not a
 * minus, and reading it as negation would hide a real declaration.
 */
const NEGATION_SYMBOL = /[\u2717\u2718\u274c\u2716\u00d7\u{1F6AB}\u2205\u2298]/u

function normalizeKey(value: string): string {
  return value
    .replace(ZERO_WIDTH, "")
    .toLowerCase()
    .replace(/\u0153/g, "oe")
    .replace(/\u00e6/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Resolve a raw allergen string to one of the known entries, or `null` when
 * this component does not recognise it.
 *
 * Exported so callers and tests can ask the question without rendering.
 */
export function normalizeAllergen(value: string): Allergen | null {
  if (NEGATION_SYMBOL.test(value)) return null
  const key = normalizeKey(value)
  if (!key) return null
  // `allergenAliases` is an object literal, so it inherits `constructor`,
  // `toString`, `__proto__` and friends from `Object.prototype`. A plain
  // `allergenAliases[key]` hands back a *function* for an allergen an owner
  // can genuinely type, and `?? null` does not catch it. Ask for an own
  // property.
  if (!Object.hasOwn(allergenAliases, key)) return null
  return allergenAliases[key] ?? null
}

/**
 * `unverified` deliberately makes no claim about what the value is.
 *
 * The obvious prefix is the wrong one: an owner writing `sans gluten` into the
 * allergens field would be announced "Allergène : sans gluten" — "Allergen:
 * gluten-free", the exact inversion of what they declared. The same applies to
 * `halal`, `bio` or `fait maison`. Reporting the value as the restaurant's own
 * wording is true whatever it turns out to mean.
 */
const ANNOUNCEMENT: Record<
  AllergenLocale,
  Record<AllergenKind, (label: string) => string>
> = {
  fr: {
    allergen: (label) => `Allergène : ${label}`,
    diet: (label) => `Régime : ${label}`,
    unverified: (label) => `Mention du restaurant : ${label}`,
  },
  en: {
    allergen: (label) => `Allergen: ${label}`,
    diet: (label) => `Diet: ${label}`,
    unverified: (label) => `Stated by the restaurant: ${label}`,
  },
}

/**
 * An allergen name this component does not recognise renders as the owner
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
 * as an allergen — see `ANNOUNCEMENT.unverified`.
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

  const known = normalizeAllergen(raw)
  const entry = known ? allergenConfig[known] : undefined

  // `Object.hasOwn`, not `??`: `ANNOUNCEMENT["constructor"]` is a function.
  const lang = Object.hasOwn(ANNOUNCEMENT, locale) ? locale : "fr"
  const Icon = entry?.icon ?? Info
  const label = entry ? entry.label[lang] : raw
  const announce = ANNOUNCEMENT[lang][entry?.kind ?? "unverified"](label)
  // An unrecognised allergen has no meaningful icon, so its name always shows.
  const withText = showLabel || !entry

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
      {withText && <span>{label}</span>}
    </div>
  )
}

export { AllergenBadge }
