/**
 * The state behind the allergen control, as pure functions.
 *
 * `products.allergens` is `v.array(v.string())` and stays free text — a
 * restaurateur must be able to declare something our vocabulary has never heard
 * of. What this module owns is the arithmetic on that array: which canonical
 * names a stored list already declares, which stored values the vocabulary does
 * not recognise, and what the array becomes when the owner ticks, adds or
 * removes something.
 *
 * The vocabulary itself — the names, the matching, the labels — is
 * `@be-in-digital/core/allergens` and is not restated here. There is one alias
 * table in this repository and this file is not it.
 *
 * WHY PURE, AND WHY SEPARATE FROM THE COMPONENT: `packages/admin` has no jsdom
 * (`vitest.config.ts` runs in `node`), so a React control is untestable in this
 * package. Splitting the arithmetic out is what makes the round-trip provable —
 * a stored `"arachides"` shows as the canonical `Arachides`, an unrecognised
 * value survives verbatim, and an untouched list comes back byte for byte.
 * `allergen-input-surface.test.ts` holds all three.
 */

import {
  ALLERGEN_KIND,
  ALLERGEN_LABELS,
  KNOWN_ALLERGENS,
  normalizeAllergen,
  normalizeAllergenKey,
  resolveAllergens,
  type Allergen,
  type AllergenLocale,
} from "@be-in-digital/core/allergens"

/** One canonical name the owner can tick. */
export interface AllergenOption {
  allergen: Allergen
  /** The canonical localised name — what the owner reads. */
  label: string
  /** Whether the stored list already declares this name, however it is spelled. */
  selected: boolean
}

/**
 * A stored value the vocabulary does not recognise.
 *
 * It is kept and shown — hiding a declaration is the hazard — but never counted
 * as a verified allergen.
 */
export interface UnverifiedAllergen {
  /** Exactly what is stored, trimmed. Never rewritten. */
  raw: string
}

/** Everything the control needs to render one stored list. */
export interface AllergenSelection {
  /**
   * The entries a restaurateur declares: the fourteen of Annex II, plus
   * `shellfish`, which is the vocabulary's own — English "shellfish" spans
   * Annex II §2 and §14 and cannot be narrowed to either. Fifteen options, of
   * which fourteen are the regulation's.
   */
  allergens: AllergenOption[]
  /** The dietary markers. Not allergens, and never presented as such. */
  diets: AllergenOption[]
  /** Unrecognised stored values, in the order the owner entered them. */
  unverified: UnverifiedAllergen[]
}

/**
 * The identity `resolveAllergens` deduplicates on, restated so that removing a
 * value removes exactly the entries that were collapsed into the chip clicked.
 *
 * The two halves are both load-bearing. `"lactose"` and `"lait"` are one
 * declaration and must be removed together, which the canonical key gives us.
 * But `"gluten"` and `"gluten ✗"` normalise to the same string while resolving
 * differently — the second is negated, so the vocabulary refuses it — and
 * removing the unverified `"gluten ✗"` must not silently drop the real gluten
 * declaration sitting beside it.
 */
function declarationKey(value: string): string {
  const allergen = normalizeAllergen(value)
  return allergen ?? `raw:${normalizeAllergenKey(value)}`
}

/** Drop `undefined` and hand back a plain, mutable copy. */
function asList(values: readonly string[] | undefined): string[] {
  return values ? [...values] : []
}

/**
 * Read a stored list into the three groups the control renders.
 *
 * Resolution, deduplication and label choice all come from
 * `resolveAllergens`, so this control shows a value exactly as the diner badge,
 * the kitchen ticket and the Uber Eats sync will read it.
 */
export function readAllergenSelection(
  values: readonly string[] | undefined,
  locale: AllergenLocale = "fr"
): AllergenSelection {
  const resolved = resolveAllergens(values, locale)
  const declared = new Set(
    resolved.flatMap((entry) => (entry.allergen ? [entry.allergen] : []))
  )

  const option = (allergen: Allergen): AllergenOption => ({
    allergen,
    label: ALLERGEN_LABELS[allergen][locale === "en" ? "en" : "fr"],
    selected: declared.has(allergen),
  })

  return {
    allergens: KNOWN_ALLERGENS.filter((a) => ALLERGEN_KIND[a] === "allergen").map(option),
    diets: KNOWN_ALLERGENS.filter((a) => ALLERGEN_KIND[a] === "diet").map(option),
    unverified: resolved
      .filter((entry) => entry.kind === "unverified")
      .map((entry) => ({ raw: entry.raw })),
  }
}

/** Whether a stored list already declares this canonical name. */
export function isAllergenSelected(
  values: readonly string[] | undefined,
  allergen: Allergen
): boolean {
  return asList(values).some((value) => normalizeAllergen(value) === allergen)
}

/**
 * Tick or untick one canonical name.
 *
 * Ticking appends the canonical key: a declaration the owner makes today is
 * stored in the one spelling every surface resolves without an alias lookup.
 * Unticking removes every stored value that resolved to it, whatever it was
 * spelled — an owner who unticks `Lait` expects both `"lactose"` and `"lait"`
 * to go.
 *
 * A value the owner never touched is never rewritten. That is the property that
 * keeps an existing product's `["arachides"]` exactly as it was found.
 */
export function toggleAllergenValue(
  values: readonly string[] | undefined,
  allergen: Allergen
): string[] {
  const current = asList(values)
  if (isAllergenSelected(current, allergen)) {
    return current.filter((value) => normalizeAllergen(value) !== allergen)
  }
  return [...current, allergen]
}

/**
 * Whether a typed value is a declaration at all.
 *
 * `normalizeAllergenKey` keeps only letters and digits, so a value that
 * normalises to nothing — spaces, punctuation, a lone `✗` — carries no name and
 * is not stored. The control leaves such text in the input rather than
 * pretending to have accepted it.
 */
export function isDeclarableAllergenValue(raw: string): boolean {
  return normalizeAllergenKey(raw).length > 0
}

/**
 * Add a typed value.
 *
 * A spelling the vocabulary recognises is stored as its canonical key, so
 * typing `cacahuètes` ticks `Arachides` instead of creating a second, unverified
 * declaration of the same allergen. Anything else is stored verbatim and shown
 * as unverified. Either way a value already declared is not added twice.
 */
export function addAllergenValue(
  values: readonly string[] | undefined,
  raw: string
): string[] {
  const current = asList(values)
  const trimmed = raw.trim()
  if (!isDeclarableAllergenValue(trimmed)) return current

  const key = declarationKey(trimmed)
  if (current.some((value) => declarationKey(value) === key)) return current

  const allergen = normalizeAllergen(trimmed)
  return [...current, allergen ?? trimmed]
}

/**
 * Remove a stored value by the text shown on its chip.
 *
 * Every entry that had been collapsed into that chip goes with it — see
 * `declarationKey`.
 */
export function removeAllergenValue(
  values: readonly string[] | undefined,
  raw: string
): string[] {
  const key = declarationKey(raw)
  return asList(values).filter((value) => declarationKey(value) !== key)
}
