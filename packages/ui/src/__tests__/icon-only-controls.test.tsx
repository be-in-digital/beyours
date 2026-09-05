/**
 * No control in this package may render an icon and nothing else.
 *
 * A `<button>` whose only child is an `<svg>` has no accessible name, so a
 * screen reader announces it as "button" and there is no way to know what it
 * does. A sweep of `packages/ui` found four beyond the restaurant components:
 * the toast dismiss, the admin sidebar's open and close, and the filter chip's
 * remove — the hamburger being the only route to the admin navigation below
 * `md`, so a blind owner on a phone could not open the menu at all.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Toast } from "../components/Toast"
import { PaginationEllipsis } from "../components/Pagination"
import { AdminLayout } from "../components/admin/AdminLayout"
import { FilterBar } from "../components/admin/FilterBar"

const noop = () => {}

/** A button that renders only an svg and carries no name. */
function unnamedIconButtons(html: string): string[] {
  return [...html.matchAll(/<button(?![^>]*aria-label)[^>]*>(.*?)<\/button>/g)]
    .map((m) => m[1] ?? "")
    .filter((inner) => /^\s*<svg/.test(inner) && !/[^<>]{2,}<\/(span|p)>/.test(inner))
}

describe("Toast", () => {
  it("names its dismiss button", () => {
    const html = renderToStaticMarkup(
      <Toast title="Commande envoyée" onClose={noop} />
    )
    expect(html).toContain('aria-label="Fermer la notification"')
    expect(unnamedIconButtons(html)).toEqual([])
  })
})

describe("AdminLayout", () => {
  const html = renderToStaticMarkup(
    <AdminLayout sidebar={<nav>Nav</nav>} header={<span>Titre</span>}>
      <p>Contenu</p>
    </AdminLayout>
  )

  it("names the mobile menu button, the only route to the nav below md", () => {
    expect(html).toContain('aria-label="Ouvrir le menu"')
  })

  it("names the sidebar close button", () => {
    expect(html).toContain('aria-label="Fermer le menu"')
  })

  it("reports whether the menu is open", () => {
    expect(html).toContain('aria-expanded="false"')
  })

  it("leaves no icon-only button unnamed", () => {
    expect(unnamedIconButtons(html)).toEqual([])
  })
})

describe("FilterBar", () => {
  it("names each remove button after the filter it removes", () => {
    // The Badge's text is a *sibling* of the button, not its content, so it
    // contributes nothing to the accessible name.
    const html = renderToStaticMarkup(
      <FilterBar
        filters={[
          { id: "cat", label: "Pizzas" },
          { id: "sta", label: "En stock" },
        ]}
        onRemoveFilter={noop}
      />
    )
    expect(html).toContain('aria-label="Retirer le filtre Pizzas"')
    expect(html).toContain('aria-label="Retirer le filtre En stock"')
    expect(unnamedIconButtons(html)).toEqual([])
  })
})

describe("PaginationEllipsis", () => {
  it("does not aria-hide the element carrying its own label", () => {
    // `aria-hidden` prunes the whole subtree, so the sr-only text somebody
    // wrote to name this was dead. Hide the icon, not the label.
    const html = renderToStaticMarkup(<PaginationEllipsis />)
    expect(html).toContain("Plus de pages")
    expect(html).not.toMatch(/^<span aria-hidden/)
    // The icon itself is still hidden.
    expect(html).toContain('aria-hidden="true"')
  })
})
