/**
 * The screen that resolves what a platform import could not place (#274).
 *
 * WHAT THIS FIXES. `orphanProducts` collects every Uber Eats or Deliveroo item
 * with no counterpart in the catalogue, and the admin had no screen for it: of
 * the module's five functions only `match` was ever wrapped, and nothing called
 * it. Rows accumulated on every import, invisible, and an owner whose platform
 * menu had drifted from their own had no way to see the drift, let alone fix it.
 *
 * Rendered with a real DOM for the same reason as `app-sidebar-render.test.tsx`:
 * what is being pinned is the surface — that the rows are readable, that
 * « Rattacher » cannot fire without a dish chosen, and that the third option
 * exists at all.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

/** What the mocked queries answer; set per test. */
const state: {
  orphans: Array<Record<string, unknown>> | undefined
  products: Array<Record<string, unknown>>
} = { orphans: undefined, products: [] }

/** Every mutation call the panel made, in order. */
const calls: Array<{ name: string; args: unknown }> = []

vi.mock("convex/react", () => ({
  // `"skip"` is honoured the way the real hook honours it, so the panel cannot
  // pass the test by reading a store it never asked the backend about.
  useQuery: (ref: unknown, args: unknown) => {
    if (args === "skip") return undefined
    if (ref === "orphanProducts:listPending") return state.orphans
    if (ref === "products:list") return state.products
    return undefined
  },
  useMutation: (ref: unknown) => async (args: unknown) => {
    calls.push({ name: String(ref), args })
    return null
  },
  useAction: () => async () => null,
}))

vi.mock("sonner", () => ({
  toast: { success: () => {}, error: () => {} },
}))

import { OrphanProductsPanel } from "../pages/stores/orphan-products-panel"
import { useAdminApiStore } from "../stores/admin-api-store"

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  // Radix measures its trigger; jsdom ships no ResizeObserver.
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

let mounted: { root: Root; container: HTMLElement } | null = null

afterEach(() => {
  if (mounted) {
    const { root, container } = mounted
    act(() => root.unmount())
    container.remove()
    mounted = null
  }
  calls.length = 0
  state.orphans = undefined
  state.products = []
})

function orphan(over: Record<string, unknown> = {}) {
  return {
    _id: "orphan_1",
    platform: "uberEats",
    externalId: "ue-991",
    name: "Pizza Reine",
    price: 1_250,
    ...over,
  }
}

// No default: `mountPanel(undefined)` must mean no store, and a default
// parameter would quietly turn it back into one.
async function mountPanel(storeId: string | undefined) {
  useAdminApiStore.setState({
    api: {
      orphanProducts: {
        listPending: "orphanProducts:listPending",
        match: "orphanProducts:match",
        ignore: "orphanProducts:ignore",
      },
      products: { list: "products:list" },
    },
  })
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted = { root, container }
  await act(async () => {
    root.render(<OrphanProductsPanel storeId={storeId} />)
  })
  return container
}

/** The buttons the panel renders, by their visible label. */
function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll("button")].find((element) =>
    (element.textContent ?? "").includes(label)
  )
}

describe("the unmatched-import panel", () => {
  it("reads out each unplaced item with its platform and its price", async () => {
    state.orphans = [
      orphan(),
      orphan({ _id: "orphan_2", platform: "deliveroo", name: "Tiramisu", price: 650 }),
    ]

    const text = (await mountPanel("store_a")).textContent ?? ""

    expect(text).toContain("Pizza Reine")
    expect(text).toContain("Uber Eats")
    expect(text).toContain("Tiramisu")
    expect(text).toContain("Deliveroo")
    // The price is the owner's evidence that two similarly-named dishes are or
    // are not the same one.
    expect(text).toContain("12,50")
    expect(text).toContain("6,50")
  })

  it("will not let an item be matched before a dish is chosen", async () => {
    state.orphans = [orphan()]
    state.products = [{ _id: "product_1", name: "Pizza Reine" }]

    const container = await mountPanel("store_a")

    expect(button(container, "Rattacher")?.disabled).toBe(true)
  })

  it("offers setting an item aside, and says which one it set aside", async () => {
    state.orphans = [orphan({ _id: "combo_only_on_the_platform" })]

    const container = await mountPanel("store_a")
    const aside = button(container, "Mettre de côté")
    expect(aside).toBeDefined()

    await act(async () => {
      aside?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(calls).toEqual([
      { name: "orphanProducts:ignore", args: { id: "combo_only_on_the_platform" } },
    ])
  })

  it("stays out of the way when an import left nothing to resolve", async () => {
    // Nothing to resolve is the ordinary state, and an empty card on every
    // store's integrations tab is noise.
    state.orphans = []

    expect((await mountPanel("store_a")).textContent).toBe("")
  })

  it("says it is still counting rather than looking clean (#531)", async () => {
    /*
     * THE DEFECT. `undefined` and `[]` both rendered nothing, and the two mean
     * opposite things on this screen. An owner who has just run an import comes
     * to this tab to see what did not match: an empty tab while the query is in
     * flight reads as "everything matched", and by the time the panel appears
     * they have drawn the conclusion or navigated away.
     *
     * The clean state stays silent — that is the sibling difference and it is
     * deliberate. Only the unresolved one speaks.
     */
    state.orphans = undefined

    const container = await mountPanel("store_a")

    expect(container.textContent).not.toBe("")
    expect(container.querySelector('[data-testid="orphan-products-loading"]')).not.toBeNull()
  })

  it("shows no loading state once the answer is in", async () => {
    // Anti-vacuity for the two above: a marker that is always present would
    // satisfy the loading assertion and say nothing.
    state.orphans = []
    expect(
      (await mountPanel("store_a")).querySelector('[data-testid="orphan-products-loading"]')
    ).toBeNull()
  })

  it("asks nothing of the backend before a store is selected", async () => {
    state.orphans = [orphan()]

    expect((await mountPanel(undefined)).textContent).toBe("")
  })
})
