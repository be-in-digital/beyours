import { describe, it, expect } from 'vitest'
import {
  ALLERGEN_KIND,
  ALLERGEN_LABELS,
  KNOWN_ALLERGENS,
  UBER_EATS_ALLERGEN_TYPE,
  UBER_EATS_ALLERGEN_TYPES,
  announceAllergen,
  isKnownAllergen,
  normalizeAllergen,
  normalizeAllergenKey,
  resolveAllergens,
  toUberEatsAllergens,
  type Allergen,
} from '../index'

/**
 * The vocabulary these tests defend used to exist four times over — once in the
 * badge, not at all in the admin, raw text on the kitchen ticket, and nowhere
 * in the Uber Eats payload. The point of this suite is that the four surfaces
 * now agree because they all ask the same question here.
 */

describe('the canonical set', () => {
  it('declares the fourteen Annex II allergens', () => {
    // Regulation (EU) 1169/2011, Annex II. `shellfish` and the dietary
    // markers sit outside the fourteen and are asserted separately.
    const annexII: Allergen[] = [
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
    ]
    expect(annexII).toHaveLength(14)
    for (const allergen of annexII) {
      expect(KNOWN_ALLERGENS).toContain(allergen)
      expect(ALLERGEN_KIND[allergen]).toBe('allergen')
    }
  })

  it('keeps dietary markers distinct from allergens', () => {
    expect(ALLERGEN_KIND.vegetarian).toBe('diet')
    expect(ALLERGEN_KIND.vegan).toBe('diet')
  })

  it('has no duplicate keys', () => {
    expect(new Set(KNOWN_ALLERGENS).size).toBe(KNOWN_ALLERGENS.length)
  })

  it('gives every key a label in both languages and an Uber Eats decision', () => {
    // These three tables are `Record<Allergen, …>`, so a missing entry is a
    // type error rather than a test failure. What this asserts is that none of
    // them was satisfied with an empty string to silence the compiler.
    for (const allergen of KNOWN_ALLERGENS) {
      expect(ALLERGEN_LABELS[allergen].fr.length).toBeGreaterThan(0)
      expect(ALLERGEN_LABELS[allergen].en.length).toBeGreaterThan(0)
      expect(allergen in UBER_EATS_ALLERGEN_TYPE).toBe(true)
    }
  })

  it('narrows a raw string with isKnownAllergen', () => {
    expect(isKnownAllergen('gluten')).toBe(true)
    expect(isKnownAllergen('arachides')).toBe(false)
    expect(isKnownAllergen('constructor')).toBe(false)
  })
})

describe('normalizeAllergen', () => {
  /**
   * Values this repository actually writes. Each was measured crashing the
   * dish page before the badge was hardened, and each is annotated with the
   * file that produces it.
   */
  it.each([
    ['arachides', 'peanuts'], // apps/*/convex/seedKitchenOrders.ts
    ['lactose', 'dairy'], // packages/convex-schema/src/__tests__/validators.test.ts
    ['lait', 'dairy'], // GPT extractor, prompted in French
    ['moutarde', 'mustard'], // GPT extractor
    ['fruits à coque', 'nuts'],
    ['crustacés', 'crustaceans'],
    ['œufs', 'eggs'],
    ['GLUTEN', 'gluten'],
  ])('resolves %s to %s', (input, expected) => {
    expect(normalizeAllergen(input)).toBe(expected)
  })

  it('is insensitive to case, accents, ligatures and punctuation', () => {
    for (const spelling of [
      'Fruits à coque',
      'FRUITS A COQUE',
      'fruits-a-coque',
      'fruits_à_coque',
      '  Fruits À Coque  ',
    ]) {
      expect(normalizeAllergen(spelling)).toBe('nuts')
    }
  })

  it('expands the oe ligature rather than dropping it', () => {
    // NFD does not decompose `œ`, so a naive strip turns "Œufs" into "ufs".
    expect(normalizeAllergenKey('Œufs')).toBe('oeufs')
    expect(normalizeAllergen('Œufs')).toBe('eggs')
  })

  it('never resolves a negated value to the allergen it negates', () => {
    // "gluten ✗" declares the absence of gluten. Announcing it as a gluten
    // declaration is the one inversion this vocabulary must never make.
    for (const negated of ['gluten ✗', '✘ gluten', 'gluten ❌', '× gluten']) {
      expect(normalizeAllergen(negated)).toBeNull()
    }
  })

  it('treats a leading hyphen as a menu bullet, not as negation', () => {
    expect(normalizeAllergen('- gluten')).toBe('gluten')
  })

  it('does not resolve an ingredient to the category that contains it', () => {
    // Guessing would put a name in front of a diner the owner never wrote.
    for (const ingredient of ['beurre', 'crevette', 'fruits de mer']) {
      expect(normalizeAllergen(ingredient)).toBeNull()
    }
  })

  it('does not hand back a value inherited from Object.prototype', () => {
    // An owner can type `constructor`; `aliases[key] ?? null` would return a
    // function for it.
    for (const inherited of ['constructor', 'toString', 'valueOf', '__proto__']) {
      expect(normalizeAllergen(inherited)).toBeNull()
    }
  })

  it('ignores zero-width characters left by a paste from Word', () => {
    expect(normalizeAllergen('glu​ten')).toBe('gluten')
  })

  it('returns null for empty and whitespace-only input', () => {
    expect(normalizeAllergen('')).toBeNull()
    expect(normalizeAllergen('   ')).toBeNull()
  })
})

describe('resolveAllergens', () => {
  it('labels a recognised value in French by default', () => {
    expect(resolveAllergens(['arachides'])).toEqual([
      { raw: 'arachides', allergen: 'peanuts', kind: 'allergen', label: 'Arachides' },
    ])
  })

  it('labels in English when asked', () => {
    expect(resolveAllergens(['arachides'], 'en')[0]?.label).toBe('Peanuts')
  })

  it('keeps an unrecognised value and marks it unverified', () => {
    // Preserved, never dropped: it may name a real allergen we do not know,
    // and hiding a declaration is the hazard.
    expect(resolveAllergens(['sauce secrète'])).toEqual([
      {
        raw: 'sauce secrète',
        allergen: null,
        kind: 'unverified',
        label: 'sauce secrète',
      },
    ])
  })

  it('deduplicates spellings that name the same allergen', () => {
    // A cook should read "Lait" once, not three times.
    const resolved = resolveAllergens(['lactose', 'lait', 'milk'])
    expect(resolved).toHaveLength(1)
    expect(resolved[0]?.allergen).toBe('dairy')
  })

  it('collapses two unrecognised values only when they are the same text', () => {
    expect(resolveAllergens(['Fait maison', 'fait maison'])).toHaveLength(1)
    expect(resolveAllergens(['Fait  maison', ' fait maison '])).toHaveLength(1)
  })

  it('keeps two allergens written in a script with no ASCII letters', () => {
    // `\u843d\u82b1\u751f` is peanut, `\u725b\u4e73` is milk — an ordinary pair on an Asian
    // menu in France. Keying unrecognised values by the [a-z0-9] matching key
    // gave both the empty string, so they shared one key and the milk was
    // silently deleted: shown on the dish page, absent from the kitchen slip,
    // absent from the Uber Eats payload, and absent from the report that names
    // what could not be synced.
    const resolved = resolveAllergens(['\u843d\u82b1\u751f', '\u725b\u4e73'])
    expect(resolved.map((r) => r.raw)).toEqual(['\u843d\u82b1\u751f', '\u725b\u4e73'])
  })

  it('keeps a legend written as circled numerals', () => {
    expect(resolveAllergens(['\u2460', '\u2461', '\u2462'])).toHaveLength(3)
  })

  it('does not fold two different French words onto one another', () => {
    // `p\u00e2te` is dough, `p\u00e2t\u00e9` is terrine. Same bistro card, different
    // allergens, one accent apart — and nothing here knows they differ, which
    // is exactly why an unrecognised value must not be accent-folded.
    expect(resolveAllergens(['p\u00e2te', 'p\u00e2t\u00e9'])).toHaveLength(2)
  })

  it('still folds accents when MATCHING a known name', () => {
    // The mirror: accent-insensitivity is right for recognition and wrong for
    // deduplicating something we do not recognise.
    expect(normalizeAllergen('C\u00e9leri')).toBe('celery')
    expect(normalizeAllergen('celeri')).toBe('celery')
  })

  it('keeps two genuinely different unrecognised values', () => {
    expect(resolveAllergens(['fait maison', 'halal'])).toHaveLength(2)
  })

  it('drops empty entries, which declare nothing', () => {
    expect(resolveAllergens(['', '  ', 'gluten'])).toHaveLength(1)
  })

  it('preserves the order the owner entered', () => {
    const resolved = resolveAllergens(['moutarde', 'gluten', 'maison'])
    expect(resolved.map((r) => r.allergen)).toEqual(['mustard', 'gluten', null])
  })

  it('returns an empty array for undefined', () => {
    expect(resolveAllergens(undefined)).toEqual([])
  })
})

describe('announceAllergen', () => {
  it('announces an allergen as an allergen', () => {
    expect(announceAllergen(resolveAllergens(['gluten'])[0]!)).toBe('Allergène : Gluten')
  })

  it('never announces a dietary marker as an allergen', () => {
    expect(announceAllergen(resolveAllergens(['vegan'])[0]!)).toBe('Régime : Végan')
  })

  it('reports an unrecognised value as the restaurant’s own wording', () => {
    // "Allergène : sans gluten" would state the exact opposite of the
    // declaration.
    expect(announceAllergen(resolveAllergens(['sans gluten'])[0]!)).toBe(
      'Mention du restaurant : sans gluten'
    )
  })
})

describe('toUberEatsAllergens', () => {
  it('maps French free text onto the enumerated types', () => {
    // The whole chain in one assertion: an owner types French, Uber Eats
    // receives its own enum.
    expect(toUberEatsAllergens(['fruits à coque', 'gluten', 'lactose'])).toEqual({
      allergens: [{ type: 'TREE_NUTS' }, { type: 'GLUTEN' }, { type: 'MILK' }],
      unmapped: [],
    })
  })

  it('reports every unmappable value, including ones with no ASCII letters', () => {
    // The gap report is the only thing standing between an unmappable allergen
    // and silence. It has to name all of them.
    expect(toUberEatsAllergens(['\u843d\u82b1\u751f', '\u725b\u4e73']).unmapped).toEqual([
      '\u843d\u82b1\u751f',
      '\u725b\u4e73',
    ])
  })

  it('reports an unrecognised value instead of dropping it silently', () => {
    // Silently dropping is the defect this replaces. It cannot go on the wire
    // — Uber's field is an enum — so it comes back to the owner.
    expect(toUberEatsAllergens(['gluten', 'sauce secrète'])).toEqual({
      allergens: [{ type: 'GLUTEN' }],
      unmapped: ['sauce secrète'],
    })
  })

  it('never sends a dietary marker as an allergen, and never warns about one', () => {
    expect(toUberEatsAllergens(['vegan', 'vegetarian'])).toEqual({
      allergens: [],
      unmapped: [],
    })
  })

  it('deduplicates types', () => {
    expect(toUberEatsAllergens(['lait', 'lactose']).allergens).toEqual([{ type: 'MILK' }])
  })

  it('emits only declared enum members', () => {
    const { allergens } = toUberEatsAllergens([...KNOWN_ALLERGENS])
    for (const { type } of allergens) {
      expect(UBER_EATS_ALLERGEN_TYPES).toContain(type)
    }
  })

  it('sends every Annex II allergen, so none is quietly unmappable', () => {
    const annexII = KNOWN_ALLERGENS.filter((a) => ALLERGEN_KIND[a] === 'allergen')
    const { allergens, unmapped } = toUberEatsAllergens([...annexII])
    expect(unmapped).toEqual([])
    // `crustaceans` and `shellfish` both exist in the vocabulary but are
    // distinct Uber types, so the count is one per allergen key.
    expect(allergens).toHaveLength(annexII.length)
  })

  it('returns nothing for an empty declaration', () => {
    expect(toUberEatsAllergens(undefined)).toEqual({ allergens: [], unmapped: [] })
    expect(toUberEatsAllergens([])).toEqual({ allergens: [], unmapped: [] })
  })
})
