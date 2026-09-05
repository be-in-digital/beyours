/**
 * AllergenBadge must not throw on the allergen names the data actually holds.
 *
 * `products.allergens` is `v.array(v.string())`
 * (packages/convex-schema/src/tables/catalog.ts:104) and the values in it are
 * French: the seed writes `arachides`, the schema test writes `lactose`, the
 * kitchen tests write `lait` and `moutarde`, and the GPT extractor in
 * `imageToProduct.ts` is prompted in French and told to answer in French. The
 * component declared nine English keys and indexed them unguarded, so every
 * one of those values read `.icon` off `undefined` and took the dish page down
 * with a client-side TypeError.
 *
 * The page that died is the page carrying the allergen disclosure that INCO
 * 1169/2011 makes mandatory, which is why the fallback renders the value the
 * owner typed rather than dropping the badge. A hidden allergen is a hazard;
 * an unstyled one is not.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  AllergenBadge,
  KNOWN_ALLERGENS,
  normalizeAllergen,
} from "../components/restaurant/AllergenBadge"
import type {
  Allergen,
  AllergenLocale,
} from "../components/restaurant/AllergenBadge"

function render(allergen: string, props: { showLabel?: boolean; locale?: AllergenLocale } = {}) {
  return renderToStaticMarkup(<AllergenBadge allergen={allergen} {...props} />)
}

/**
 * The same term with its accents dropped — what an owner types in a hurry.
 * Derived rather than written out, so the correctly-accented spelling is the
 * only one in this file and `pnpm check:accents` stays honest.
 */
function withoutAccents(term: string) {
  return term.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/** Strip tags so assertions read the text a diner sees. */
function text(html: string) {
  return html.replace(/<[^>]*>/g, "")
}

describe("AllergenBadge — values measured in this repository", () => {
  // Every one of these threw before the fix.
  it.each([
    ["arachides", "Arachides"], // apps/reference/convex/seedKitchenOrders.ts:188
    ["lactose", "Lait"], // packages/convex-schema/src/__tests__/validators.test.ts:90
    ["lait", "Lait"], // apps/reference/tests/convex/kitchen-auto-print.test.ts:197
    ["moutarde", "Moutarde"], // apps/reference/tests/convex/kitchen-auto-print.test.ts:335
    ["fruits à coque", "Fruits à coque"],
    ["crustacés", "Crustacés"],
    ["oeufs", "Œufs"],
    ["GLUTEN", "Gluten"],
  ])("renders %s as %s instead of throwing", (value, label) => {
    expect(() => render(value)).not.toThrow()
    expect(text(render(value, { showLabel: true }))).toContain(label)
  })

  it("renders every key the component declares", () => {
    for (const key of KNOWN_ALLERGENS) {
      expect(() => render(key)).not.toThrow()
      expect(render(key)).toContain("aria-label=")
    }
  })

  it("still renders the nine keys the original union declared", () => {
    // `dairy` renders as Lait and `shellfish` keeps its own entry, but no
    // caller that worked before may break now.
    for (const key of [
      "gluten",
      "dairy",
      "nuts",
      "shellfish",
      "eggs",
      "soy",
      "fish",
      "vegetarian",
      "vegan",
    ]) {
      expect(normalizeAllergen(key)).not.toBeNull()
    }
  })
})

describe("AllergenBadge — normalisation", () => {
  it.each([
    ["Fruits à coque", "nuts"],
    ["FRUITS A COQUE", "nuts"],
    ["fruits-a-coque", "nuts"],
    ["  fruits  à   coque  ", "nuts"],
    ["Crustacés", "crustaceans"],
    ["shellfish", "shellfish"],
    // `\u0153` is a ligature, not a decomposable accent: NFD leaves it whole, so
    // an unexpanded "\u0152ufs" normalises to "ufs" and misses the table.
    ["\u0152ufs", "eggs"],
    ["\u0153ufs", "eggs"],
    ["oeuf", "eggs"],
    ["Céleri", "celery"],
    ["Sésame", "sesame"],
    ["anhydride sulfureux", "sulphites"],
    ["Blé", "gluten"],
    ["Cacahuètes", "peanuts"],
    ["Mollusques", "molluscs"],
    ["végétalien", "vegan"],
  ])("maps %s to %s", (input, expected) => {
    expect(normalizeAllergen(input)).toBe(expected as Allergen)
  })

  it("does not invert a negation into a declaration", () => {
    // "sans gluten" is gluten-FREE. Mapping it to `gluten` would tell a diner
    // the dish contains the very thing the owner said it does not.
    for (const negation of [
      "sans gluten",
      "gluten free",
      "gluten-free",
      "sans lactose",
      "0% lactose",
      "sans arachides",
      "zéro gluten",
    ]) {
      expect(normalizeAllergen(negation)).toBeNull()
    }
  })

  it("does not let a negation symbol resolve to the thing it negates", () => {
    // `normalizeKey` collapses punctuation, which would delete the negation
    // and leave the bare allergen behind.
    for (const negation of ["gluten ✗", "gluten ❌", "✘ lactose", "gluten ✖"]) {
      expect(normalizeAllergen(negation)).toBeNull()
    }
  })

  it("still reads a leading dash as a bullet, not a minus", () => {
    // Menus list allergens as "- gluten". Treating that as negation would
    // hide a real declaration — the opposite failure, and the worse one.
    expect(normalizeAllergen("- gluten")).toBe("gluten")
    expect(normalizeAllergen("(gluten)")).toBe("gluten")
  })

  it("does not guess a category from an ingredient", () => {
    // Naming an allergen the owner did not write is worse than leaving the
    // badge unstyled. "fruits de mer" spans crustaceans and molluscs.
    for (const ingredient of ["beurre", "crevette", "fruits de mer", "fromage"]) {
      expect(normalizeAllergen(ingredient)).toBeNull()
    }
  })

  it("returns null for blank input", () => {
    expect(normalizeAllergen("")).toBeNull()
    expect(normalizeAllergen("   ")).toBeNull()
    expect(normalizeAllergen("!!!")).toBeNull()
    // A paste from Word or Docs leaves these behind; `.trim()` does not.
    expect(normalizeAllergen("\u200b")).toBeNull()
    expect(normalizeAllergen("\ufeff \u200b")).toBeNull()
  })

  it("sees through zero-width characters to the word underneath", () => {
    expect(normalizeAllergen("glu\u200bten")).toBe("gluten")
  })

  it("does not hand back what Object.prototype inherits", () => {
    // `allergenAliases` is an object literal, so a plain `aliases[key]` returns
    // a *function* for these — and an owner can type any of them into the
    // allergen field. `?? null` does not catch a function.
    for (const inherited of [
      "constructor",
      "__proto__",
      "toString",
      "valueOf",
      "hasOwnProperty",
      "propertyIsEnumerable",
    ]) {
      expect(normalizeAllergen(inherited)).toBeNull()
    }
  })

  it("renders an inherited property name as the plain text it is", () => {
    expect(() => render("constructor")).not.toThrow()
    expect(text(render("constructor"))).toContain("constructor")
    expect(render("__proto__")).toContain(
      'aria-label="Mention du restaurant : __proto__"'
    )
  })

  it("matches the accented French an alias is written in", () => {
    // The alias table is written in real French and normalised at load, so a
    // term added with its accent resolves rather than silently never matching
    // — and no de-accented French sits in a file the accent check reads.
    expect(normalizeAllergen("noix du Brésil")).toBe("nuts")
    expect(normalizeAllergen("céleri-rave")).toBe("celery")
    expect(normalizeAllergen("lécithine de soja")).toBe("soy")
    expect(normalizeAllergen("blanc d'œuf")).toBe("eggs")
    expect(normalizeAllergen("épeautre")).toBe("gluten")
    // and the de-accented spelling a real owner types still lands too
    expect(normalizeAllergen(withoutAccents("noix du Brésil"))).toBe("nuts")
    expect(normalizeAllergen(withoutAccents("céleri-rave"))).toBe("celery")
    expect(normalizeAllergen(withoutAccents("cacahuètes"))).toBe("peanuts")
  })

  it("resolves every alias to a key the config actually holds", () => {
    // A typo in the alias table would reintroduce the original crash.
    const known = new Set<string>(KNOWN_ALLERGENS)
    for (const alias of ["gluten", "arachides", "lactose", "so2", "lupin"]) {
      const resolved = normalizeAllergen(alias)
      expect(resolved).not.toBeNull()
      expect(known.has(resolved as string)).toBe(true)
    }
  })
})

describe("AllergenBadge — an allergen it does not recognise", () => {
  it("renders the value the owner typed rather than dropping it", () => {
    const html = render("épices du chef")
    expect(text(html)).toContain("épices du chef")
  })

  it("shows that value even when showLabel is false", () => {
    // The fallback icon means nothing on its own, so hiding the text would
    // hide the disclosure.
    expect(text(render("épices du chef", { showLabel: false }))).toContain(
      "épices du chef"
    )
  })

  it("does NOT announce it as an allergen", () => {
    // The whole point: we do not know what this is, so we claim nothing.
    const html = render("épices du chef")
    expect(html).toContain('aria-label="Mention du restaurant : épices du chef"')
    expect(html).not.toContain("Allergène")
  })

  it("escapes it instead of rendering it as markup", () => {
    const html = render("<script>alert(1)</script>")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  it("renders nothing at all for a blank value", () => {
    expect(render("")).toBe("")
    expect(render("   ")).toBe("")
  })
})

describe("AllergenBadge — what it refuses to claim", () => {
  // The resolver returning null is only half the guarantee. What a diner
  // HEARS is the other half, and it is the half that was wrong: the fallback
  // hardcoded an "Allergène :" prefix, so `sans gluten` was announced
  // "Allergen: gluten-free" under a warning icon.
  it.each([
    "sans gluten",
    "gluten free",
    "gluten-free",
    "0% lactose",
    "sans arachides",
    "gluten ✗",
  ])("never announces %s as an allergen", (negation) => {
    const html = render(negation)
    expect(html).not.toContain("Allergène")
    expect(html).toContain(`Mention du restaurant : ${negation}`)
    expect(text(html)).toContain(negation)
  })

  it.each(["halal", "casher", "bio", "fait maison", "surgelé"])(
    "never announces %s as an allergen either",
    (marker) => {
      expect(render(marker)).not.toContain("Allergène")
    }
  )

  it("still announces a real allergen as one", () => {
    expect(render("arachides")).toContain('aria-label="Allergène : Arachides"')
  })
})

describe("AllergenBadge — accessible name", () => {
  it("names the badge instead of relying on title alone", () => {
    // `title` on a non-interactive div is not a reliable accessible name and
    // never surfaces on touch.
    const html = render("nuts")
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Allergène : Fruits à coque"')
  })

  it("carries no title, so the name is not announced twice", () => {
    // With `aria-label` set, a `title` saying the same thing falls through
    // accname to the accessible description: "Allergène : Fruits à coque,
    // image, Allergène : Fruits à coque".
    expect(render("nuts")).not.toContain("title=")
  })

  it("shows the name by default, because an icon is not a disclosure", () => {
    // A carrot for celery and a wine glass for sulphites tell a diner
    // nothing. Every recognised allergen renders its name unless asked not to.
    for (const [value, label] of [
      ["céleri", "Céleri"],
      ["sulfites", "Sulfites"],
      ["sésame", "Sésame"],
      ["mollusques", "Mollusques"],
    ] as const) {
      expect(text(renderToStaticMarkup(<AllergenBadge allergen={value} />))).toContain(
        label
      )
    }
  })

  it("hides the decorative icon from the accessibility tree", () => {
    expect(render("nuts")).toContain('aria-hidden="true"')
  })

  it("does not announce a dietary marker as an allergen", () => {
    expect(render("vegan")).toContain('aria-label="Régime : Végan"')
    expect(render("vegetarian")).toContain('aria-label="Régime : Végétarien"')
  })

  it("falls back to French for a locale it does not carry", () => {
    // The prop is typed, but this component was taken down once already by
    // trusting a type over the value that arrived.
    const html = renderToStaticMarkup(
      <AllergenBadge allergen="nuts" locale={"de" as AllergenLocale} />
    )
    expect(html).not.toContain("undefined")
    expect(html).toContain('aria-label="Allergène : Fruits à coque"')
  })

  it("announces in English when asked", () => {
    expect(render("nuts", { locale: "en" })).toContain(
      'aria-label="Allergen: Nuts"'
    )
    expect(render("vegan", { locale: "en" })).toContain('aria-label="Diet: Vegan"')
  })
})

describe("AllergenBadge — the fourteen allergens INCO 1169/2011 makes mandatory", () => {
  const annexII: Array<[string, string]> = [
    ["gluten", "Gluten"],
    ["crustacés", "Crustacés"],
    ["oeufs", "Œufs"],
    ["poisson", "Poisson"],
    ["arachides", "Arachides"],
    ["soja", "Soja"],
    ["lait", "Lait"],
    ["fruits à coque", "Fruits à coque"],
    ["céleri", "Céleri"],
    ["moutarde", "Moutarde"],
    ["graines de sésame", "Sésame"],
    ["sulfites", "Sulfites"],
    ["lupin", "Lupin"],
    ["mollusques", "Mollusques"],
  ]

  it("covers all fourteen", () => {
    expect(annexII).toHaveLength(14)
  })

  it.each(annexII)("declares %s in French", (french, label) => {
    expect(text(render(french, { showLabel: true }))).toContain(label)
  })

  it("gives each one a distinct canonical key", () => {
    const keys = annexII.map(([french]) => normalizeAllergen(french))
    expect(new Set(keys).size).toBe(14)
    expect(keys).not.toContain(null)
  })

  it("keeps crustaceans and molluscs apart, and declares both for shellfish", () => {
    // English "shellfish" spans §2 and §14. Narrowing it to crustaceans would
    // drop a mollusc declaration a diner is allergic to.
    expect(normalizeAllergen("crustacés")).toBe("crustaceans")
    expect(normalizeAllergen("mollusques")).toBe("molluscs")
    const shown = text(render("shellfish", { showLabel: true }))
    expect(shown).toContain("Crustacés et mollusques")
  })

  it("does not read gluten into a cereal that need not contain it", () => {
    // Annex II says "céréales contenant du gluten". Rice and maize are
    // cereals; a bare "céréales" must not put a Gluten badge on a rice bowl.
    expect(normalizeAllergen("céréales")).toBeNull()
    expect(normalizeAllergen("céréales contenant du gluten")).toBe("gluten")
    for (const grain of ["riz", "maïs", "quinoa", "sarrasin"]) {
      expect(normalizeAllergen(grain)).toBeNull()
    }
  })

  it("carries the Annex II names a French label actually prints", () => {
    expect(normalizeAllergen("dioxyde de soufre")).toBe("sulphites")
    expect(normalizeAllergen("E220")).toBe("sulphites")
    expect(normalizeAllergen("lécithine de soja")).toBe("soy")
    expect(normalizeAllergen("céleri-rave")).toBe("celery")
    expect(normalizeAllergen("blanc d'oeuf")).toBe("eggs")
  })
})
