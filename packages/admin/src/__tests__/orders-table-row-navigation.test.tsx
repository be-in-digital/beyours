/**
 * A click anywhere on an order row opens that order (#533).
 *
 * WHAT WENT WRONG. The row carried `cursor-pointer` — so it advertised itself
 * as clickable — while only the TEXT inside each cell was a `<Link>`. A click on
 * the cell padding, on the gap after a short badge, or anywhere in the row's
 * blank width did nothing at all. The pointer said "this opens something" and
 * the click said nothing, which is the worst of the two possible screens: a
 * plain row at least tells the truth.
 *
 * HOW IT SURVIVED. The Playwright spec that would have shown it clicks the row
 * and is wrapped in `if (hasOrder)`, and the admin project's database has no
 * order when CI runs it — so it passed by never running its body. Measured
 * against a seeded bench, `order-detail.spec.ts:113` and `:135` fail.
 *
 * WHY BOTH A ROW HANDLER AND THE LINKS. The links are what make a row
 * keyboard-reachable, middle-clickable and right-click-openable, and no click
 * handler substitutes for that. The handler is what covers the area no anchor
 * can reach — the cell padding, which belongs to the table, not to the content.
 * So both, and the handler stands aside when the click already landed on a
 * control that will navigate on its own.
 */

// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

/** Every `router.push` the table asked for, in order. */
const pushed: string[] = []

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => {
      pushed.push(href)
    },
  }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { OrdersTable } from "../pages/orders/orders-table"

const ORDER_ID = "orders_abc123"
const NOW = 1_700_000_000_000

function order(over: Record<string, unknown> = {}) {
  return {
    _id: ORDER_ID,
    orderNumber: "ORD-2026-00003",
    customerInfo: { name: "Camille Roux" },
    type: "delivery",
    items: [{ quantity: 2 }],
    total: 2_450,
    status: "confirmed",
    paymentStatus: "paid",
    createdAt: NOW,
    ...over,
  } as any
}

let mounted: { root: Root; container: HTMLElement } | null = null

beforeAll(() => {
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  if (mounted) {
    const { root, container } = mounted
    act(() => root.unmount())
    container.remove()
    mounted = null
  }
  pushed.length = 0
})

async function renderTable(orders: any[] = [order()]): Promise<HTMLElement> {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted = { root, container }
  await act(async () => {
    root.render(<OrdersTable orders={orders} isLoading={false} />)
  })
  return container
}

/** The one body row. */
function bodyRow(container: HTMLElement): HTMLElement {
  const row = container.querySelector("tbody tr")
  expect(row, "the table rendered no body row").not.toBeNull()
  return row as HTMLElement
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  })
}

describe("an order row", () => {
  it("renders the order it is about", async () => {
    // Anti-vacuity: every case below asserts on a row, and a table that
    // rendered none would satisfy several of them by accident.
    const text = bodyRow(await renderTable()).textContent ?? ""

    expect(text).toContain("Camille Roux")
  })

  it("opens the order when the row itself is clicked", async () => {
    /*
     * THE DEFECT. This is the click on the row's blank width — the cell padding
     * and everything between the cells — which is most of the row on a wide
     * screen and was dead.
     */
    click(bodyRow(await renderTable()))

    expect(pushed).toEqual([`/dashboard/orders/${ORDER_ID}`])
  })

  it("still carries a real link, so the row can be opened without a mouse", async () => {
    // A click handler is not a link: no focus, no Enter, no middle-click, no
    // « ouvrir dans un nouvel onglet ». Removing the anchors in favour of the
    // handler would fix the reported defect and cause a worse one.
    const links = [...bodyRow(await renderTable()).querySelectorAll("a[href]")]

    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link.getAttribute("href")).toBe(`/dashboard/orders/${ORDER_ID}`)
    }
  })

  it("does not navigate twice when the click landed on the link", async () => {
    // The anchor navigates on its own. A handler that pushed as well would
    // leave a duplicate history entry, so « retour » would need pressing twice.
    const link = bodyRow(await renderTable()).querySelector("a[href]")
    click(link as Element)

    expect(pushed).toEqual([])
  })

  it("opens the row it was clicked on, not the first one", async () => {
    // The handler has to close over its own order. One shared `push` call — the
    // shape this would most plausibly be written in — sends every row to the
    // top of the list.
    const container = await renderTable([
      order(),
      order({ _id: "orders_second", orderNumber: "ORD-2026-00004" }),
    ])
    const rows = [...container.querySelectorAll("tbody tr")]
    click(rows[1]!)

    expect(pushed).toEqual(["/dashboard/orders/orders_second"])
  })
})
