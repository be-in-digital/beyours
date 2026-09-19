/**
 * The allergen input: it exists, both writers share it, and it does not rewrite
 * what it was given.
 *
 * WHAT WENT WRONG: `product-form.tsx` declared `allergens: z.array(z.string())`
 * in its Zod schema and `allergens: []` in its defaults, and rendered no control
 * for it at all. A restaurateur could not declare an allergen through the normal
 * product editor — while Annex II of Regulation (EU) 1169/2011 makes that
 * declaration mandatory. Nothing failed; the field was simply never reachable.
 * The only production writer left was an unvalidated comma-separated text box on
 * the AI review card, fed by a GPT extractor prompted in French, which is how
 * unrecognised French free text reached `products.allergens` in the first place.
 *
 * WHY SOURCE-LEVEL, IN PART: `packages/admin` runs vitest in the `node`
 * environment (`vitest.config.ts`) with no jsdom and no testing-library, so a
 * React control cannot be rendered here. The arithmetic behind the control was
 * therefore split into `pages/products/allergen-selection.ts`, which is pure and
 * is exercised for real below; what only the markup can answer — "is there a
 * control, and do both writers use the same one" — is read off the source.
 *
 * The sweep at the top is the part that would have caught the original defect,
 * and it is deliberately not written as "allergens is present": it walks every
 * top-level key of the form's own schema and asks whether the rendered form
 * touches it. Three fields are still unreachable that way; they are recorded as
 * gaps, not blessed.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import {
  ALLERGEN_LABELS,
  KNOWN_ALLERGENS,
} from "@be-yours/core/allergens"

import {
  addAllergenValue,
  isAllergenSelected,
  isDeclarableAllergenValue,
  readAllergenSelection,
  removeAllergenValue,
  toggleAllergenValue,
} from "../pages/products/allergen-selection"

const ADMIN_SRC = path.join(__dirname, "..")
const PRODUCTS = path.join(ADMIN_SRC, "pages", "products")

const read = (file: string): string => fs.readFileSync(file, "utf8")

const productForm = read(path.join(PRODUCTS, "product-form.tsx"))
// The schema moved out of the component into its own module so its guards
// could be parsed rather than only read (see product-form-schema.test.ts).
// The sweep below follows it: it measures what the form DECLARES against what
// the form RENDERS, and those are now two files.
const productFormSchemaSource = read(
  path.join(PRODUCTS, "product-form-schema.ts")
)
const allergenField = read(path.join(PRODUCTS, "allergen-field.tsx"))
const allergenSelection = read(path.join(PRODUCTS, "allergen-selection.ts"))
const suggestionCard = read(
  path.join(PRODUCTS, "image-to-product", "suggestion-card.tsx")
)

/** Every `.ts`/`.tsx` file in the admin package, tests excluded. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__tests__") continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

// ---------------------------------------------------------------------------
// Sweep: a field the schema declares must be a field the form can edit
// ---------------------------------------------------------------------------

const SCHEMA_MARKER = "export const productFormSchema = z.object({"

/** The body of `productFormSchema`, from its opening brace to its match. */
function schemaBody(): string {
  const start = productFormSchemaSource.indexOf(SCHEMA_MARKER)
  expect(
    start,
    "productFormSchema not found in product-form-schema.ts"
  ).toBeGreaterThan(-1)
  const open = start + SCHEMA_MARKER.length - 1
  let depth = 0
  for (let i = open; i < productFormSchemaSource.length; i++) {
    const c = productFormSchemaSource[i]
    if (c === "{" || c === "(" || c === "[") depth++
    else if (c === "}" || c === ")" || c === "]") {
      depth--
      if (depth === 0) return productFormSchemaSource.slice(open + 1, i)
    }
  }
  throw new Error("productFormSchema is not balanced")
}

/** Nesting depth at an offset — used to keep nested object keys out. */
function depthAt(block: string, index: number): number {
  let depth = 0
  for (let i = 0; i < index; i++) {
    const c = block[i]
    if (c === "{" || c === "(" || c === "[") depth++
    else if (c === "}" || c === ")" || c === "]") depth--
  }
  return depth
}

/** The fields the schema declares, ignoring the keys of nested objects. */
function schemaFields(): string[] {
  const block = schemaBody()
  return [...block.matchAll(/(?:^|[\n,])\s*(\w+)\s*:/g)]
    .filter((m) => depthAt(block, m.index ?? 0) === 0)
    .map((m) => m[1] as string)
}

/** The rendered markup — everything from the opening `<form` tag onward. */
function renderedMarkup(): string {
  const start = productForm.indexOf("<form")
  expect(start, "no <form> in product-form.tsx").toBeGreaterThan(-1)
  return productForm.slice(start)
}

/**
 * Schema fields the rendered form still cannot edit.
 *
 * Each entry is a live gap, not an exemption — delete the row when the control
 * lands. `allergens` was the fourth entry here and is now gone, which is the
 * whole point of this file. `images`, `tags` and `spiceLevel` are still
 * pass-through only: `edit-product-page.tsx` spreads them out of the product
 * and back into the mutation, so an existing value survives a save, but nothing
 * in the form can set or clear one.
 */
const UNREACHABLE_FIELDS = ["images", "tags", "spiceLevel"]

describe("every field the product form declares is a field it can edit", () => {
  it("parses the schema it is measuring", () => {
    const fields = schemaFields()
    expect(fields).toContain("name")
    expect(fields).toContain("allergens")
    expect(fields).toContain("scheduling")
    // Nested keys must not leak in, or the sweep measures the wrong thing.
    expect(fields).not.toContain("tracked")
    expect(fields).not.toContain("availableDays")
    expect(fields).not.toContain("choices")
  })

  it("renders a control for every declared field", () => {
    const markup = renderedMarkup()
    const missing = schemaFields().filter(
      (field) =>
        !UNREACHABLE_FIELDS.includes(field) &&
        !new RegExp(`\\b${field}\\b`).test(markup)
    )
    expect(missing, `declared but not rendered: ${missing.join(", ")}`).toEqual([])
  })

  it("does not count allergens among the fields it cannot edit", () => {
    expect(UNREACHABLE_FIELDS).not.toContain("allergens")
  })

  it("gives the allergen control its own tab, so it is reachable without scrolling", () => {
    expect(productForm).toContain('<TabsTrigger value="allergens">Allergènes</TabsTrigger>')
    expect(productForm).toContain('<TabsContent value="allergens"')
    // The tab strip is a fixed grid; a tab added without widening it overlaps.
    const triggers = [...productForm.matchAll(/<TabsTrigger value=/g)].length
    expect(productForm).toContain(`grid-cols-${triggers}`)
  })

  it("renders the shared control, bound to the form's own value", () => {
    expect(productForm).toContain("<AllergenField")
    expect(productForm).toMatch(/import \{ AllergenField \} from "\.\/allergen-field"/)
    expect(productForm).toMatch(/const allergens = watch\("allergens"\)/)
    expect(productForm).toMatch(/value=\{allergens\}/)
  })
})

// ---------------------------------------------------------------------------
// Reachability: both pages that submit the field render the form
// ---------------------------------------------------------------------------

describe("the form carrying the control is the one both product pages mount", () => {
  for (const page of ["new-product-page.tsx", "edit-product-page.tsx"]) {
    it(`${page} renders ProductForm and submits data.allergens`, () => {
      const source = read(path.join(PRODUCTS, page))
      expect(source).toContain("<ProductForm")
      expect(source).toMatch(/allergens: data\.allergens/)
    })
  }

  it("hands the stored list back to the form as a default value", () => {
    // `defaultValues` is the whole product spread, so `allergens` arrives as it
    // is stored — French free text included. That is what the round-trip below
    // has to survive.
    const edit = read(path.join(PRODUCTS, "edit-product-page.tsx"))
    expect(edit).toMatch(/const defaultValues = \{\s*\.\.\.product/)
    expect(edit).toContain("defaultValues={defaultValues}")
  })
})

// ---------------------------------------------------------------------------
// One control, one vocabulary
// ---------------------------------------------------------------------------

describe("both writers of products.allergens share one control", () => {
  /** Files that write the allergens field, whatever the form of the write. */
  function writers(): string[] {
    return sourceFiles(ADMIN_SRC).filter((file) =>
      /(?:setValue|updateField)\(\s*"allergens"/.test(read(file))
    )
  }

  it("finds the two known writers and no others", () => {
    const found = writers().map((f) => path.relative(PRODUCTS, f)).sort()
    expect(found).toEqual([
      "image-to-product/suggestion-card.tsx",
      "product-form.tsx",
    ])
  })

  it("routes every writer through AllergenField", () => {
    for (const file of writers()) {
      expect(read(file), `${path.basename(file)} writes allergens by hand`).toContain(
        "<AllergenField"
      )
    }
  })

  it("leaves no raw comma-separated allergen box behind", () => {
    // The AI card used to split on commas with no normalisation at all, which
    // is how unrecognised French text became a stored "allergen".
    expect(suggestionCard).not.toMatch(/allergens[\s\S]{0,400}?split\(","\)/)
  })

  it("spells the AI card's label with its accent", () => {
    expect(suggestionCard).toContain("Allergènes (suggestion IA)")
    for (const file of sourceFiles(PRODUCTS)) {
      expect(read(file), path.basename(file)).not.toMatch(/Allergenes/)
    }
  })

  it("keeps the AI card's source and confidence affordances", () => {
    expect(suggestionCard).toMatch(/<AiFieldBadge source="inferred" \/>/)
    expect(suggestionCard).toMatch(
      /<ConfidenceIndicator value=\{suggestion\.allergens\.confidence\} \/>/
    )
    // The AiField wrapper must survive the edit — only `.value` changes.
    expect(suggestionCard).toMatch(
      /updateField\("allergens", \{ \.\.\.suggestion\.allergens, value: next \}\)/
    )
  })

  it("takes its names, matching and labels from core and defines none of its own", () => {
    expect(allergenSelection).toContain('from "@be-yours/core/allergens"')
    for (const file of sourceFiles(ADMIN_SRC)) {
      const source = read(file)
      // A second alias table, label map or normaliser is exactly how the four
      // allergen surfaces diverged. There is one, and it is in core.
      expect(source, path.basename(file)).not.toMatch(
        /(?:const|let|function)\s+(?:ALLERGEN_LABELS|ALLERGEN_ALIASES|allergenAliases|normalizeAllergen)\b/
      )
    }
  })
})

// ---------------------------------------------------------------------------
// The control's behaviour, on the real vocabulary
// ---------------------------------------------------------------------------

describe("reading a stored list", () => {
  it("offers every canonical name, split by kind", () => {
    const { allergens, diets } = readAllergenSelection([])
    expect(allergens.length + diets.length).toBe(KNOWN_ALLERGENS.length)
    expect(diets.map((d) => d.allergen)).toEqual(["vegetarian", "vegan"])
    expect(allergens.map((a) => a.allergen)).toContain("gluten")
    expect(allergens.map((a) => a.allergen)).not.toContain("vegan")
  })

  it("shows the French labels the vocabulary owns", () => {
    const { allergens } = readAllergenSelection([])
    const peanuts = allergens.find((a) => a.allergen === "peanuts")
    expect(peanuts?.label).toBe(ALLERGEN_LABELS.peanuts.fr)
    expect(peanuts?.label).toBe("Arachides")
  })

  it("recognises an existing product's French free text", () => {
    // This is what `edit-product-page.tsx` hands the form for a seeded product.
    const { allergens, unverified } = readAllergenSelection(["arachides"])
    const peanuts = allergens.find((a) => a.allergen === "peanuts")
    expect(peanuts?.selected).toBe(true)
    expect(peanuts?.label).toBe("Arachides")
    expect(unverified).toEqual([])
  })

  it("collapses two spellings of one allergen into one declaration", () => {
    const { allergens, unverified } = readAllergenSelection(["Lactose", "lait"])
    expect(allergens.filter((a) => a.selected).map((a) => a.allergen)).toEqual(["dairy"])
    expect(unverified).toEqual([])
  })

  it("keeps a name it does not know, and marks it unverified", () => {
    const { allergens, diets, unverified } = readAllergenSelection(["Fait maison"])
    expect(unverified).toEqual([{ raw: "Fait maison" }])
    expect([...allergens, ...diets].some((o) => o.selected)).toBe(false)
  })

  it("never files a dietary marker as an allergen", () => {
    const { allergens, diets } = readAllergenSelection(["végétalien"])
    expect(diets.find((d) => d.allergen === "vegan")?.selected).toBe(true)
    expect(allergens.some((a) => a.selected)).toBe(false)
  })

  it("does not touch the list it was handed", () => {
    const stored = ["arachides", "Fait maison"]
    readAllergenSelection(stored)
    expect(stored).toEqual(["arachides", "Fait maison"])
  })

  it("survives an absent field", () => {
    const { allergens, unverified } = readAllergenSelection(undefined)
    expect(unverified).toEqual([])
    expect(allergens.some((a) => a.selected)).toBe(false)
  })
})

describe("editing a stored list", () => {
  it("stores a newly ticked name as its canonical key", () => {
    expect(toggleAllergenValue([], "gluten")).toEqual(["gluten"])
  })

  it("unticking removes every spelling of that allergen", () => {
    expect(toggleAllergenValue(["Lactose", "lait", "gluten"], "dairy")).toEqual([
      "gluten",
    ])
  })

  it("unticking a French spelling the owner never rewrote still works", () => {
    expect(isAllergenSelected(["arachides"], "peanuts")).toBe(true)
    expect(toggleAllergenValue(["arachides"], "peanuts")).toEqual([])
  })

  it("a typed name the vocabulary knows ticks the box instead of adding a duplicate", () => {
    const next = addAllergenValue([], "cacahuètes")
    expect(next).toEqual(["peanuts"])
    expect(readAllergenSelection(next).unverified).toEqual([])
  })

  it("a typed name it does not know is stored exactly as typed", () => {
    const next = addAllergenValue(["gluten"], "  Sarrasin  ")
    expect(next).toEqual(["gluten", "Sarrasin"])
    expect(readAllergenSelection(next).unverified).toEqual([{ raw: "Sarrasin" }])
  })

  it("refuses to add a declaration that is already there", () => {
    expect(addAllergenValue(["arachides"], "Arachides")).toEqual(["arachides"])
    expect(addAllergenValue(["Sarrasin"], "sarrasin")).toEqual(["Sarrasin"])
  })

  it("refuses a value that names nothing", () => {
    expect(isDeclarableAllergenValue("   ")).toBe(false)
    expect(isDeclarableAllergenValue("✗")).toBe(false)
    expect(isDeclarableAllergenValue("sarrasin")).toBe(true)
    expect(addAllergenValue(["gluten"], "  ")).toEqual(["gluten"])
  })

  it("removes an unverified mention without taking a real declaration with it", () => {
    // "gluten ✗" normalises to the same key as "gluten" but is negated, so the
    // vocabulary refuses it and it shows as an unverified mention. Removing it
    // must not drop the gluten declaration standing beside it.
    const stored = ["gluten", "gluten ✗"]
    expect(readAllergenSelection(stored).unverified).toEqual([{ raw: "gluten ✗" }])
    expect(removeAllergenValue(stored, "gluten ✗")).toEqual(["gluten"])
  })

  it("returns a new list and leaves the old one alone", () => {
    const stored = ["gluten"]
    expect(toggleAllergenValue(stored, "eggs")).not.toBe(stored)
    expect(addAllergenValue(stored, "Sarrasin")).not.toBe(stored)
    expect(removeAllergenValue(stored, "gluten")).not.toBe(stored)
    expect(stored).toEqual(["gluten"])
  })

  it("leaves an untouched product's list byte for byte as it was stored", () => {
    // Reading is the only thing that happens to a product nobody edits, and the
    // control writes solely from a user gesture — there is no effect that could
    // normalise the list on mount. `edit-product-page.tsx` then submits
    // `data.allergens` unchanged.
    const stored = ["arachides", "Lactose", "Fait maison", "végétalien"]
    const snapshot = [...stored]
    readAllergenSelection(stored)
    expect(stored).toEqual(snapshot)

    expect(allergenField).not.toContain("useEffect")
    const writes = [...productForm.matchAll(/setValue\("allergens"/g)].length
    expect(writes, "the form writes allergens somewhere else too").toBe(1)
  })
})

// ---------------------------------------------------------------------------
// The unverified affordance, and the accessibility the control must not lose
// ---------------------------------------------------------------------------

describe("an unrecognised value is shown for what it is", () => {
  it("labels it unverified rather than passing it off as an allergen", () => {
    expect(allergenField).toContain("non vérifiée")
  })

  it("states the consequence, in French, where the owner types it", () => {
    expect(allergenField).toMatch(/Uber Eats/)
    expect(allergenField).toMatch(/ticket\s+de\s+cuisine/)
  })

  it("separates the legal disclosure from the dietary markers", () => {
    expect(allergenField).toContain("Allergènes à déclarer")
    expect(allergenField).toContain("Régimes alimentaires")
    expect(allergenField).toMatch(/1169\/2011/)
    expect(allergenField).toMatch(/Ce ne sont pas des allergènes/)
  })

  it("gives every control a name and every group a heading", () => {
    // Each choice is a real <Checkbox> tied to a real <Label htmlFor>, and the
    // two groups are labelled by their headings rather than by a stray <label>.
    expect(allergenField).toMatch(/<Label htmlFor=\{id\}/)
    expect(allergenField).toMatch(/<Label htmlFor=\{`\$\{uid\}-custom`\}/)
    expect(allergenField).toMatch(/role="group"\s+aria-labelledby=/)
    // The only icon-only control is the chip's remove button, and it is named.
    expect(allergenField).toMatch(/aria-label=\{`Retirer la mention \$\{entry\.raw\}`\}/)
  })

  it("does not submit the product when Enter adds a mention", () => {
    // The field sits inside <form>; an unguarded Enter saves the product with
    // the mention still sitting in the input.
    expect(allergenField).toMatch(/e\.key !== "Enter"/)
    expect(allergenField).toContain("e.preventDefault()")
  })
})
