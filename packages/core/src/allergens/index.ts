/**
 * Canonical allergen vocabulary.
 *
 * `products.allergens` is `v.array(v.string())`
 * (`packages/convex-schema/src/tables/catalog.ts`) and stays that way: a
 * restaurateur must be able to declare something this list has never heard of,
 * and refusing the value would push the declaration off the menu entirely.
 * What this module adds on top of that free text is a *vocabulary* — the names
 * we recognise, the one way of matching a typed name against them, and the one
 * set of labels shown for a match.
 *
 * The decision this module encodes, in one place, is:
 *
 *   store free text · recognise it against a canonical set · and where a value
 *   is *not* recognised, say so explicitly rather than let it pass as verified.
 *
 * It lives in `@be-in-digital/core` and is deliberately framework-free — no
 * React, no Convex, no AWS — because the same vocabulary has to serve four
 * surfaces that cannot import each other:
 *
 *   1. `AllergenBadge` in `@be-in-digital/ui` — the diner-facing disclosure.
 *   2. `PrintTicketLayout` in both apps — the cook's ticket.
 *   3. The product form in `@be-in-digital/admin` — where an owner declares them.
 *   4. `uberEatsMenuSync` in `@be-in-digital/convex-functions` — the outbound
 *      platform payload, which runs in the Convex runtime.
 *
 * Import it as `@be-in-digital/core/allergens`, the raw-source subpath export,
 * exactly like `@be-in-digital/core/auth/rbac` — which is already imported from
 * Convex functions, so the runtime is known to accept this shape.
 *
 * Those four surfaces each carried their own idea of what an allergen was, and
 * that is precisely how they diverged: one crashed on French, one printed raw
 * strings, one had no input at all and one dropped the field on the floor. Add
 * a name here, not there.
 */

// ============================================================================
// The vocabulary
// ============================================================================

/**
 * The fourteen allergens Annex II of Regulation (EU) 1169/2011 (INCO) makes a
 * food business declare, plus `shellfish` and the two dietary markers the
 * design system already carried.
 *
 * Keys are English because they are identifiers, not copy — the text a diner
 * reads comes from `ALLERGEN_LABELS`, which is bilingual.
 *
 * This is a vocabulary, not a constraint. It says which names we recognise; it
 * does not say which names may be stored.
 */
export const KNOWN_ALLERGENS = [
  // Annex II
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'dairy',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
  // English "shellfish" spans Annex II §2 and §14. It cannot be narrowed to
  // either without dropping the other, so it declares both.
  'shellfish',
  // Dietary markers, kept from the design system's original union
  'vegetarian',
  'vegan',
] as const

export type Allergen = (typeof KNOWN_ALLERGENS)[number]

export type AllergenLocale = 'fr' | 'en'

export type AllergenKind =
  /** One of the fourteen Annex II allergens, or `shellfish`. */
  | 'allergen'
  /** A dietary marker. Never announced, printed or synced as an allergen. */
  | 'diet'
  /** A name this vocabulary does not recognise. It claims nothing about it. */
  | 'unverified'

/**
 * Which entries are allergens and which are dietary markers.
 *
 * The distinction is load-bearing, not cosmetic: `vegan` must never be
 * announced to a diner as "Allergène : Végan", and must never be sent to a
 * delivery platform's allergen field, where it would sit alongside real
 * declarations.
 */
export const ALLERGEN_KIND: Record<Allergen, Exclude<AllergenKind, 'unverified'>> = {
  gluten: 'allergen',
  crustaceans: 'allergen',
  eggs: 'allergen',
  fish: 'allergen',
  peanuts: 'allergen',
  soy: 'allergen',
  dairy: 'allergen',
  nuts: 'allergen',
  celery: 'allergen',
  mustard: 'allergen',
  sesame: 'allergen',
  sulphites: 'allergen',
  lupin: 'allergen',
  molluscs: 'allergen',
  shellfish: 'allergen',
  vegetarian: 'diet',
  vegan: 'diet',
}

/**
 * The name a human reads. French is the product's market and its default; the
 * English column exists for the design system's `locale` prop and for staff
 * screens, not for the storefront.
 *
 * These are customer-facing copy, so the French stays French (CLAUDE.md).
 */
export const ALLERGEN_LABELS: Record<Allergen, Record<AllergenLocale, string>> = {
  gluten: { fr: 'Gluten', en: 'Gluten' },
  crustaceans: { fr: 'Crustacés', en: 'Crustaceans' },
  eggs: { fr: 'Œufs', en: 'Eggs' },
  fish: { fr: 'Poisson', en: 'Fish' },
  peanuts: { fr: 'Arachides', en: 'Peanuts' },
  soy: { fr: 'Soja', en: 'Soy' },
  dairy: { fr: 'Lait', en: 'Milk' },
  nuts: { fr: 'Fruits à coque', en: 'Nuts' },
  celery: { fr: 'Céleri', en: 'Celery' },
  mustard: { fr: 'Moutarde', en: 'Mustard' },
  sesame: { fr: 'Sésame', en: 'Sesame' },
  sulphites: { fr: 'Sulfites', en: 'Sulphites' },
  lupin: { fr: 'Lupin', en: 'Lupin' },
  molluscs: { fr: 'Mollusques', en: 'Molluscs' },
  shellfish: { fr: 'Crustacés et mollusques', en: 'Shellfish' },
  vegetarian: { fr: 'Végétarien', en: 'Vegetarian' },
  vegan: { fr: 'Végan', en: 'Vegan' },
}

/**
 * Spellings that unambiguously name one of the entries above.
 *
 * Written in real French, and run through `normalizeAllergenKey` at module load
 * to build the table that is actually consulted — so `Fruits à coque`,
 * `FRUITS A COQUE` and `fruits-a-coque` all land on the same row. Hand-writing
 * pre-normalised keys here would mean a `céleri-rave` added with its accent
 * silently never matches, and would put de-accented French in a source file the
 * repository's accent check reads.
 *
 * Only names of the allergen *category* belong here. An ingredient that merely
 * contains an allergen ("beurre", "crevette", "fruits de mer") is deliberately
 * absent: guessing which category an ingredient belongs to would put a name in
 * front of a diner that the owner did not write, and a wrong allergen is worse
 * than an unstyled one. Anything not listed is reported as unverified.
 */
const ALIAS_SOURCE: Record<string, Allergen> = {
  // gluten — Annex II names the cereals explicitly
  gluten: 'gluten',
  'céréales contenant du gluten': 'gluten',
  'céréales de gluten': 'gluten',
  'cereals containing gluten': 'gluten',
  'gluten de blé': 'gluten',
  'farine de blé': 'gluten',
  triticale: 'gluten',
  khorasan: 'gluten',
  blé: 'gluten',
  froment: 'gluten',
  seigle: 'gluten',
  orge: 'gluten',
  avoine: 'gluten',
  épeautre: 'gluten',
  kamut: 'gluten',
  wheat: 'gluten',
  rye: 'gluten',
  barley: 'gluten',
  oats: 'gluten',
  spelt: 'gluten',

  // crustaceans
  crustacé: 'crustaceans',
  crustacés: 'crustaceans',
  crustacean: 'crustaceans',
  crustaceans: 'crustaceans',
  shellfish: 'shellfish',

  // eggs
  œuf: 'eggs',
  œufs: 'eggs',
  egg: 'eggs',
  eggs: 'eggs',
  "blanc d'œuf": 'eggs',
  "blancs d'œufs": 'eggs',

  // fish
  poisson: 'fish',
  poissons: 'fish',
  fish: 'fish',

  // peanuts
  arachide: 'peanuts',
  arachides: 'peanuts',
  cacahuète: 'peanuts',
  cacahuètes: 'peanuts',
  peanut: 'peanuts',
  peanuts: 'peanuts',
  groundnuts: 'peanuts',

  // soy
  soja: 'soy',
  soy: 'soy',
  soya: 'soy',
  soybeans: 'soy',
  'lécithine de soja': 'soy',
  'soy lecithin': 'soy',

  // dairy
  lait: 'dairy',
  laits: 'dairy',
  lactose: 'dairy',
  'produits laitiers': 'dairy',
  'protéines de lait': 'dairy',
  'lait et produits laitiers': 'dairy',
  milk: 'dairy',
  dairy: 'dairy',

  // tree nuts
  'fruit à coque': 'nuts',
  'fruits à coque': 'nuts',
  'fruits à coques': 'nuts',
  noix: 'nuts',
  noisette: 'nuts',
  noisettes: 'nuts',
  amande: 'nuts',
  amandes: 'nuts',
  pistache: 'nuts',
  pistaches: 'nuts',
  'noix de cajou': 'nuts',
  'noix de pécan': 'nuts',
  'noix du Brésil': 'nuts',
  'noix de macadamia': 'nuts',
  nut: 'nuts',
  nuts: 'nuts',
  'tree nuts': 'nuts',
  almond: 'nuts',
  almonds: 'nuts',
  hazelnut: 'nuts',
  hazelnuts: 'nuts',
  walnut: 'nuts',
  walnuts: 'nuts',
  cashew: 'nuts',
  cashews: 'nuts',
  pistachio: 'nuts',
  pistachios: 'nuts',
  pecan: 'nuts',
  pecans: 'nuts',
  'brazil nut': 'nuts',
  'brazil nuts': 'nuts',
  macadamia: 'nuts',

  // celery
  céleri: 'celery',
  'céleri-rave': 'celery',
  'céleri branche': 'celery',
  celery: 'celery',
  celeriac: 'celery',

  // mustard
  moutarde: 'mustard',
  'graines de moutarde': 'mustard',
  mustard: 'mustard',

  // sesame
  sésame: 'sesame',
  'graines de sésame': 'sesame',
  'sesame seeds': 'sesame',

  // sulphites
  sulfite: 'sulphites',
  sulfites: 'sulphites',
  'anhydride sulfureux': 'sulphites',
  'dioxyde de soufre': 'sulphites',
  'sulfur dioxide': 'sulphites',
  e220: 'sulphites',
  'anhydride sulfureux et sulfites': 'sulphites',
  so2: 'sulphites',
  sulphite: 'sulphites',
  sulphites: 'sulphites',

  // lupin
  lupin: 'lupin',
  lupins: 'lupin',
  lupine: 'lupin',
  'farine de lupin': 'lupin',

  // molluscs
  mollusque: 'molluscs',
  mollusques: 'molluscs',
  mollusc: 'molluscs',
  molluscs: 'molluscs',
  mollusk: 'molluscs',
  mollusks: 'molluscs',

  // dietary markers
  végétarien: 'vegetarian',
  végétarienne: 'vegetarian',
  végétariens: 'vegetarian',
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  végétalien: 'vegan',
  végétalienne: 'vegan',
  végétaliens: 'vegan',
}

// ============================================================================
// Matching
// ============================================================================

/** Zero-width characters a paste from Word or Docs leaves behind. */
const ZERO_WIDTH = /[​‌‍⁠﻿]/g

/**
 * Symbols that negate what follows them. A value carrying one is never resolved
 * to an allergen: `gluten ✗` means the dish has none, and announcing
 * "Allergène : Gluten" for it is the inversion this vocabulary must never make.
 * A leading hyphen is deliberately absent — in a menu it is a bullet, not a
 * minus, and reading it as negation would hide a real declaration.
 */
const NEGATION_SYMBOL = /[✗✘❌✖×\u{1F6AB}∅⊘]/u

/**
 * Lower case, expand ligatures, strip diacritics, collapse anything that is not
 * a letter or a digit into a single space. `"Fruits à coque"`,
 * `"FRUITS A COQUE"` and `"fruits_a_coque"` all come out as `"fruits a coque"`.
 *
 * The ligature step is not decoration: `œ` and `æ` are single code points that
 * NFD does not decompose, so `"Œufs"` — the correct French spelling — would
 * otherwise normalise to `"ufs"` and miss the table entirely.
 */
export function normalizeAllergenKey(value: string): string {
  return value
    .replace(ZERO_WIDTH, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** See `normalizeAllergen` for why this is not `Object.hasOwn`. */
function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key)
}

/**
 * The table actually consulted: every source spelling above, normalised the
 * same way an incoming value is, so the two are guaranteed to agree.
 */
const allergenAliases: Record<string, Allergen> = Object.fromEntries(
  Object.entries(ALIAS_SOURCE).map(([term, allergen]) => [
    normalizeAllergenKey(term),
    allergen,
  ])
)

/**
 * Resolve a raw allergen string to one of the known entries, or `null` when
 * this vocabulary does not recognise it.
 */
export function normalizeAllergen(value: string): Allergen | null {
  if (typeof value !== 'string') return null
  if (NEGATION_SYMBOL.test(value)) return null
  const key = normalizeAllergenKey(value)
  if (!key) return null
  // `allergenAliases` is an object literal, so it inherits `constructor`,
  // `toString`, `__proto__` and friends from `Object.prototype`. A plain
  // `allergenAliases[key]` hands back a *function* for an allergen an owner can
  // genuinely type, and `?? null` does not catch it. Ask for an own property.
  //
  // `Object.prototype.hasOwnProperty.call`, not `Object.hasOwn`: this module is
  // consumed as raw source through a subpath export, so it is compiled by every
  // consumer's tsconfig rather than its own, and `Object.hasOwn` needs an
  // ES2022 lib that not all of them resolve. Same semantics, no lib floor.
  if (!hasOwn(allergenAliases, key)) return null
  return allergenAliases[key] ?? null
}

/** Narrow an arbitrary string to a canonical key. */
export function isKnownAllergen(value: string): value is Allergen {
  return (KNOWN_ALLERGENS as readonly string[]).includes(value)
}

// ============================================================================
// Resolution — what every rendering surface consumes
// ============================================================================

/**
 * One allergen value, resolved once, for a surface to render.
 *
 * `allergen === null` is the case every surface has to handle deliberately:
 * the owner declared something we do not recognise. It is shown — hiding a
 * declaration is the hazard — but never as a verified allergen.
 */
export interface ResolvedAllergen {
  /** Exactly what the owner stored, trimmed. Never discard this. */
  raw: string
  /** The canonical key, or `null` when unrecognised. */
  allergen: Allergen | null
  kind: AllergenKind
  /** Canonical localised label for a match; the owner's own text otherwise. */
  label: string
}

/**
 * The identity two *unrecognised* values must share before one is dropped as a
 * duplicate of the other.
 *
 * Case and whitespace only. Deliberately NOT `normalizeAllergenKey`, which is
 * built for the opposite job — matching a typed name against a known one, where
 * folding accents is what makes `Céleri` find `celeri`. Applied to a value the
 * vocabulary does *not* recognise, that folding destroys declarations:
 *
 *   - it collapses everything outside `[a-z0-9]` to the empty string, so
 *     `落花生` and `牛乳` — peanut and milk, an ordinary pair on an Asian menu
 *     in France — share one key and the second is silently deleted. Same for a
 *     legend written `①②③`, and for emoji.
 *   - it folds accents, so `pâte` and `pâté` become one. Those are different
 *     foods on the same bistro card, and only one of them carries pistachio.
 *
 * There is no vocabulary here to say two spellings mean the same thing, so the
 * only safe claim is that identical text is one declaration. Anything less
 * conservative drops an allergen the diner was told about, which is the one
 * direction this module must never fail in.
 */
export function unverifiedAllergenKey(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Resolve a stored allergen list for display.
 *
 * Deduplicates: `["lactose", "lait"]` both resolve to `dairy` and a cook should
 * read "Lait" once, not twice. Unrecognised values collapse only when they are
 * the same text — see `unverifiedAllergenKey`. Empty and whitespace-only entries are
 * dropped; they are not a declaration of anything.
 *
 * Order is the order the owner entered, which is the order they proof-read.
 */
export function resolveAllergens(
  values: readonly string[] | undefined,
  locale: AllergenLocale = 'fr'
): ResolvedAllergen[] {
  if (!values || values.length === 0) return []
  const lang: AllergenLocale = locale === 'en' ? 'en' : 'fr'
  const seen = new Set<string>()
  const resolved: ResolvedAllergen[] = []

  for (const value of values) {
    if (typeof value !== 'string') continue
    const raw = value.trim()
    if (!raw) continue

    const allergen = normalizeAllergen(raw)
    const dedupeKey = allergen ?? `raw:${unverifiedAllergenKey(raw)}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    resolved.push({
      raw,
      allergen,
      kind: allergen ? ALLERGEN_KIND[allergen] : 'unverified',
      label: allergen ? ALLERGEN_LABELS[allergen][lang] : raw,
    })
  }

  return resolved
}

/**
 * How a resolved value is announced or introduced.
 *
 * The obvious prefix is the wrong one for `unverified`: an owner writing
 * `sans gluten` into the allergens field would be announced "Allergène : sans
 * gluten" — "Allergen: gluten-free", the exact inversion of what they
 * declared. The same applies to `halal`, `bio` or `fait maison`. Reporting the
 * value as the restaurant's own wording is true whatever it turns out to mean.
 */
export const ALLERGEN_ANNOUNCEMENT: Record<
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

/** Announce one resolved value. */
export function announceAllergen(
  resolved: ResolvedAllergen,
  locale: AllergenLocale = 'fr'
): string {
  const lang: AllergenLocale = locale === 'en' ? 'en' : 'fr'
  return ALLERGEN_ANNOUNCEMENT[lang][resolved.kind](resolved.label)
}

// ============================================================================
// Uber Eats
// ============================================================================

/**
 * The allergen types Uber Eats accepts in `nutritional_info.allergens[].type`.
 *
 * Uber Eats types this field as a plain string, so nothing on the wire stops a
 * typo; this union is what stops one here. The names follow Uber's own allergen
 * vocabulary — `MILK` rather than `DAIRY`, `TREE_NUTS` rather than `NUTS`.
 *
 * `OTHER` is Uber's escape hatch and is deliberately NOT used as a fallback for
 * a value we failed to map: an allergen filed as "other" tells a diner with a
 * nut allergy nothing, while still making the dish look as though it carries a
 * declaration. Unmapped values are reported to the owner instead — see
 * `collectUnsyncableAllergens`.
 *
 * NOT YET VERIFIED against Uber's live menu schema — `developer.uber.com` is
 * unreachable from CI, and Uber does not publish this enum outside the partner
 * portal. Confirm the exact spellings during Uber Eats onboarding and correct
 * this one table; every caller goes through it. Tracked in
 * `tasks/uber-eats-go-live-runbook.md`.
 */
export const UBER_EATS_ALLERGEN_TYPES = [
  'GLUTEN',
  'CRUSTACEANS',
  'EGGS',
  'FISH',
  'PEANUTS',
  'SOY',
  'MILK',
  'TREE_NUTS',
  'CELERY',
  'MUSTARD',
  'SESAME',
  'SULPHITES',
  'LUPIN',
  'MOLLUSCS',
  'SHELLFISH',
] as const

export type UberEatsAllergenType = (typeof UBER_EATS_ALLERGEN_TYPES)[number]

/**
 * Canonical key → Uber Eats allergen type.
 *
 * Total by construction: `Record<Allergen, …>` means adding a name to
 * `KNOWN_ALLERGENS` without deciding what Uber Eats should be told is a
 * compile error, not a silent omission. That is the property this table exists
 * for — the previous behaviour dropped every allergen and nothing complained.
 *
 * `null` means "deliberately not sent": the dietary markers are not allergens
 * and must not appear in an allergen field.
 */
export const UBER_EATS_ALLERGEN_TYPE: Record<Allergen, UberEatsAllergenType | null> = {
  gluten: 'GLUTEN',
  crustaceans: 'CRUSTACEANS',
  eggs: 'EGGS',
  fish: 'FISH',
  peanuts: 'PEANUTS',
  soy: 'SOY',
  dairy: 'MILK',
  nuts: 'TREE_NUTS',
  celery: 'CELERY',
  mustard: 'MUSTARD',
  sesame: 'SESAME',
  sulphites: 'SULPHITES',
  lupin: 'LUPIN',
  molluscs: 'MOLLUSCS',
  shellfish: 'SHELLFISH',
  vegetarian: null,
  vegan: null,
}

/**
 * Translate a stored allergen list into the Uber Eats `allergens` array.
 *
 * Returns the mapped types and, separately, the raw values that could not be
 * mapped — because dropping those silently is exactly the defect this replaces.
 * The caller decides what to do with `unmapped`; it must not be discarded.
 *
 * Today the only caller writes it to the Convex log (`uberEatsMenuSync` in both
 * apps). That is diagnosable but it is not a dashboard: no restaurateur sees
 * it. Surfacing it in the admin needs a field the store-integration screen
 * actually renders, and `menuSyncError` — which already exists — is rendered
 * nowhere either, so adding a second unrendered field would repeat the mistake
 * rather than fix it.
 */
export function toUberEatsAllergens(values: readonly string[] | undefined): {
  allergens: Array<{ type: UberEatsAllergenType }>
  unmapped: string[]
} {
  const resolved = resolveAllergens(values)
  const allergens: Array<{ type: UberEatsAllergenType }> = []
  const unmapped: string[] = []
  const seen = new Set<UberEatsAllergenType>()

  for (const entry of resolved) {
    // A dietary marker is not an unmapped allergen — it is correctly excluded,
    // and reporting "vegan could not be synced as an allergen" to an owner
    // would be noise that trains them to ignore the real warnings.
    if (entry.kind === 'diet') continue

    const type = entry.allergen ? UBER_EATS_ALLERGEN_TYPE[entry.allergen] : null
    if (!type) {
      unmapped.push(entry.raw)
      continue
    }
    if (seen.has(type)) continue
    seen.add(type)
    allergens.push({ type })
  }

  return { allergens, unmapped }
}
