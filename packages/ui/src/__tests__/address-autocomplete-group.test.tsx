/**
 * The address block is four fields with one name, and the name has to reach
 * assistive technology.
 *
 * WHAT BROKE. Converging the design system kept the version where the street
 * field IS the autocomplete, dropping the separate search input the package
 * copy had. That search input carried the `label` prop as a real
 * `<label htmlFor>`, so "Adresse de l'établissement" named a control; in the
 * surviving version the same prop rendered as a bare `<p>`, which names
 * nothing. Three admin screens pass that prop, so three address forms went from
 * "one named field plus four" to five anonymous boxes — and two e2e specs
 * looking for it failed, which is how it surfaced.
 *
 * `role="group"` + `aria-labelledby` is the fix that does not lie: the name
 * belongs to the group, not to any one field, and the street field keeps its
 * own. A `<fieldset>`/`<legend>` would fold the group name into all four
 * accessible names, so every locator for one field would match four.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AddressAutocomplete } from "../components/AddressAutocomplete"

const EMPTY = { street: "", city: "", postalCode: "", country: "" }

function render(label?: string): string {
  return renderToStaticMarkup(
    <AddressAutocomplete
      value={EMPTY}
      onChange={() => {}}
      apiKey=""
      {...(label === undefined ? {} : { label })}
    />
  )
}

describe("AddressAutocomplete", () => {
  it("names the group with the label its caller supplies", () => {
    const html = render("Adresse de l'établissement")

    expect(html).toContain('role="group"')
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1]
    expect(labelledBy, "no aria-labelledby on the group").toBeTruthy()
    // The id must resolve to the element carrying the text, or the name is
    // still nothing — which is exactly the state this replaced.
    expect(html).toContain(`id="${labelledBy}"`)
    expect(html).toMatch(
      new RegExp(`id="${labelledBy}"[^>]*>Adresse de l&#x27;établissement</p>`)
    )
  })

  it("does not claim a group role when nothing named it", () => {
    // The storefront renders it without a label. A group with no accessible
    // name is worse than no group: it announces a boundary and says nothing
    // about what is inside it.
    const html = render()
    expect(html).not.toContain('role="group"')
    expect(html).not.toContain("aria-labelledby")
  })

  it("keeps every field's own label bound to its own input", () => {
    // The reason the group name is not a <legend>: these four have to stay
    // individually addressable.
    const html = render("Adresse")
    for (const text of ["Rue", "Ville", "Code postal", "Pays"]) {
      const forId = html.match(new RegExp(`for="([^"]+)"[^>]*>${text}</label>`))?.[1]
      expect(forId, `no <label> bound for ${text}`).toBeTruthy()
      expect(html, `${text} labels no input`).toContain(`id="${forId}"`)
    }
  })
})
