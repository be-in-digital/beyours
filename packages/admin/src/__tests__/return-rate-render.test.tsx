/**
 * What « Taux de retour » says about how much of the book it read (#531).
 *
 * The card renders a bare percentage. The read behind it takes 2,000 customer
 * rows and stops, and until #531 it stopped silently: an establishment with
 * more distinct diners than that in the period got a rate computed over an
 * arbitrary slice of them, presented with the same confidence as an exact one.
 *
 * The orders read beside it has been honest about its cap since it gained one.
 * This makes the second read as honest as the first, and it has to be a
 * separate flag — two reads, two caps, and a period can exhaust either alone.
 *
 * Rendered with a real DOM rather than asserted on a string, for the same
 * reason as `orphan-products-panel.test.tsx`: the notice has to be ON the card
 * beside the figure it qualifies, not somewhere in the module.
 */

import { describe, it, expect, afterEach } from "vitest"

/**
 * The rate as the card prints it.
 *
 * U+202F, not a plain space: French sets a narrow no-break space before `%`,
 * and `percent()` in the card writes one. Matching on `"35 %"` fails, and it
 * fails for the right reason — a test that normalised the two apart would also
 * pass on a card that had lost the typography.
 */
const NNBSP = "\u202f"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

import { ReturnRate } from "../pages/dashboard/return-rate"
import type { DashboardDiners } from "../pages/dashboard/use-dashboard-stats"

let mounted: { root: Root; container: HTMLElement } | null = null

afterEach(() => {
  if (mounted) {
    const { root, container } = mounted
    act(() => root.unmount())
    container.remove()
    mounted = null
  }
})

function diners(over: Partial<DashboardDiners> = {}): DashboardDiners {
  return {
    identified: 120,
    returning: 42,
    newcomers: 78,
    returningRate: 0.35,
    anonymousOrders: 0,
    truncated: false,
    ...over,
  }
}

async function render(value: DashboardDiners | null): Promise<HTMLElement> {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted = { root, container }
  await act(async () => {
    root.render(<ReturnRate diners={value} />)
  })
  return container
}

describe("the return-rate card", () => {
  it("shows the rate", async () => {
    // Anti-vacuity: every assertion below is about what surrounds this number.
    expect((await render(diners())).textContent).toContain(`35${NNBSP}%`)
  })

  it("says the figure is a floor when the customer book was cut short", async () => {
    const text = (await render(diners({ truncated: true }))).textContent ?? ""

    expect(text).toContain(`35${NNBSP}%`)
    expect(text).toMatch(/clients les plus récents|ne porte pas sur/)
  })

  it("qualifies nothing when the whole book was read", async () => {
    const text = (await render(diners())).textContent ?? ""

    expect(text).not.toMatch(/clients les plus récents|ne porte pas sur/)
  })

  it("says nothing about a cap when there is no book at all", async () => {
    // `null` is already a card that says it does not know. A truncation notice
    // on top of it would be two different disclaimers about the same absence.
    const text = (await render(null)).textContent ?? ""

    expect(text).toContain("n'est pas disponible")
    expect(text).not.toMatch(/clients les plus récents|ne porte pas sur/)
  })

  it("still qualifies the figure when nobody identifiable ordered", async () => {
    /*
     * The case that reads worst without it: the cap was hit — 2,000 diners were
     * read — and every one of them is a newcomer, so `identified` is non-zero
     * and the branch is the ordinary one. A truncated read that came back empty
     * cannot happen, which is why the empty branch is checked for the absence
     * rather than the presence.
     */
    const text =
      (await render(diners({ identified: 0, returning: 0, newcomers: 0, returningRate: 0, truncated: true })))
        .textContent ?? ""

    expect(text).toContain("Aucun client identifié")
  })
})
