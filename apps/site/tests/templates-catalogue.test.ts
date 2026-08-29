// @vitest-environment node
// Node, not the edge-runtime default of this app: this suite reads the
// template directories off disk.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { categories, getAllTemplateSlugs, totalTemplates } from "../lib/templates-data"

/**
 * The sales catalogue and the templates it sells must not drift apart.
 *
 * `lib/templates-data.ts` is what a buyer browses on beyours.fr; every entry
 * names a slug an operator then runs through `pnpm template:apply <slug>` in
 * the client's cloned repository. Nothing connected the two, and five of the
 * fifty had already come apart: the catalogue sold `asiatique-izakaya`,
 * `pizzeria-trattoria`, `fast-food-smash`, `food-truck-convoi` and
 * `poulet-braise`, while those themes live in directories named for their bare
 * vertical (`templates/asiatique/`, themeName "Izakaya", and so on). Applying
 * a theme a customer had just chosen failed with "Template inconnu".
 *
 * The templates live in `apps/themes`, which is cloned per client. This app is
 * not — it is the commercial site — so the cross-app read below only ever
 * happens inside the monorepo, where both are present.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const TEMPLATES_DIR = path.join(REPO_ROOT, "apps/themes/templates")

interface TemplateMeta {
  slug: string
  aliases?: string[]
}

/** Every name `pnpm template:apply` accepts: directory slugs plus their aliases. */
function applicableNames(): Set<string> {
  const names = new Set<string>()
  for (const entry of fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const metaPath = path.join(TEMPLATES_DIR, entry.name, "template.json")
    if (!fs.existsSync(metaPath)) continue
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as TemplateMeta
    names.add(meta.slug)
    for (const alias of meta.aliases ?? []) names.add(alias)
  }
  return names
}

describe("template catalogue", () => {
  it("sells only templates that can actually be applied", () => {
    const applicable = applicableNames()
    const unapplicable = getAllTemplateSlugs().filter((slug) => !applicable.has(slug))
    expect(unapplicable).toEqual([])
  })

  it("advertises a slug for a template directory that declares the same slug", () => {
    // Guards the inverse mistake: an alias pointing at a directory that was
    // since renamed still resolves here, because applicableNames() reads the
    // directories rather than trusting the catalogue.
    const applicable = applicableNames()
    for (const slug of getAllTemplateSlugs()) {
      expect(applicable, `catalogue slug "${slug}" is not applicable`).toContain(slug)
    }
  })

  it("has no duplicate slug across categories", () => {
    const slugs = getAllTemplateSlugs()
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("counts every template it lists", () => {
    expect(totalTemplates).toBe(getAllTemplateSlugs().length)
    expect(categories.length).toBeGreaterThan(0)
  })
})
