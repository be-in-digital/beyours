/**
 * The order detail page surfaces the invoice — or the reason none exists.
 *
 * #375: `issueInvoiceForOrder` deliberately answers `{ issued: false, reason }`
 * instead of failing a payment, and its docblock promised "the admin surfaces
 * it" while the page had zero invoice references. A seller-incomplete
 * deployment took money for weeks with no legal invoice and no warning
 * (art. 242 nonies A CGI). This pins the surface: the refusal is readable on
 * the paid order, the issued number is shown when there is one, and the
 * dine-in table — persisted since day one, displayed never — is on the page.
 *
 * Rendered with a real DOM for the same reason as `app-sidebar-render.test.tsx`:
 * the page reads zustand stores, whose server snapshot is the initial state.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest"
import { Suspense, act } from "react"
import { createRoot, type Root } from "react-dom/client"

const NOW = 1_700_000_000_000

/** What the mocked `orders.getById` answers; set per test. */
const state: { order: Record<string, unknown> | null } = { order: null }

function paidOrder(overrides: Record<string, unknown> = {}) {
  return {
    _id: "orders1abcdef",
    orderNumber: "ORD-2026-00001",
    storeId: "stores1abcdef",
    status: "completed",
    paymentStatus: "paid",
    paymentMethod: "cash",
    type: "dine_in",
    tableNumber: "12",
    items: [
      {
        productId: "products1abc",
        productName: "Margherita",
        quantity: 1,
        unitPrice: 1200,
        subtotal: 1200,
        selectedOptions: [],
      },
    ],
    subtotal: 1200,
    taxAmount: 0,
    total: 1200,
    customerInfo: { name: "Camille" },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown) => {
    if (ref === "orders:getById") return state.order
    if (ref === "globalSettings:get") return { integrations: {} }
    if (ref === "payments:getByOrder") return []
    return undefined
  },
  useMutation: () => async () => null,
  useAction: () => async () => null,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, back: () => {}, replace: () => {} }),
  usePathname: () => "/dashboard/orders/orders1abcdef",
}))

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { Role } from "@be-yours/core"
import { OrderDetailPage } from "../pages/orders/order-detail-page"
import { useAdminApiStore } from "../stores/admin-api-store"
import { useAdminAuthStore } from "../stores/admin-auth-store"

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
})

let mounted: { root: Root; container: HTMLElement } | null = null

afterEach(() => {
  if (!mounted) return
  const { root, container } = mounted
  act(() => root.unmount())
  container.remove()
  mounted = null
})

async function mountDetailPage(
  order: Record<string, unknown>,
  role: Role = Role.MANAGER
) {
  state.order = order
  useAdminAuthStore.setState({ role })
  useAdminApiStore.setState({
    api: {
      orders: { getById: "orders:getById", markCashPaid: "orders:markCashPaid" },
      globalSettings: { get: "globalSettings:get" },
      payments: { getByOrder: "payments:getByOrder", refundPayment: "payments:refund" },
      invoices: { issueForOrder: "invoices:issueForOrder" },
    },
  })
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted = { root, container }
  await act(async () => {
    root.render(
      <Suspense fallback={null}>
        <OrderDetailPage params={Promise.resolve({ orderId: "orders1abcdef" })} />
      </Suspense>
    )
  })
  return container
}

describe("the invoice section of a paid order", () => {
  it("says why no invoice exists on a seller-incomplete deployment, with the way out", async () => {
    const container = await mountDetailPage(
      paidOrder({ invoiceNumber: null, invoiceRefusal: "seller_incomplete" })
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Facture non émise")
    expect(text).toContain("Identité vendeur incomplète")

    // The way out: a link to the settings tab that collects the identity.
    const link = [...container.querySelectorAll("a")].find((a) =>
      a.getAttribute("href")?.includes("tab=billing")
    )
    expect(link).toBeDefined()
  })

  it("shows the issued invoice's number, and no warning", async () => {
    const container = await mountDetailPage(
      paidOrder({ invoiceNumber: "FA-2026-000287", invoiceRefusal: null })
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Facture")
    expect(text).toContain("FA-2026-000287")
    expect(text).not.toContain("Facture non émise")
  })

  it("says nothing on an order read through a query that computed no surface", async () => {
    // `list` and `recent` return the raw document: no fields, no section —
    // silence rather than a wrong claim.
    const container = await mountDetailPage(paidOrder())

    expect(container.textContent ?? "").not.toContain("Facture non émise")
    expect(container.textContent ?? "").not.toContain("Générer la facture")
  })

  it("offers the catch-up issuance for a backlog order nothing refuses any more", async () => {
    // An order paid while the seller was incomplete, read after the owner
    // completed the identity: the refusal is gone, the number does not exist,
    // and without this state the card vanished and the backlog stayed
    // invoiceless for ever, silently.
    const container = await mountDetailPage(
      paidOrder({ invoiceNumber: null, invoiceRefusal: null }),
      Role.CLIENT_ADMIN
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Aucune facture n'a été émise")
    const button = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Générer la facture")
    )
    expect(button).toBeDefined()
  })

  it("keeps the catch-up button from roles that cannot issue", async () => {
    // A waiter reads the state; only `payments:write` holders get the button —
    // the same permission `invoices.issueForOrder` enforces server-side.
    const container = await mountDetailPage(
      paidOrder({ invoiceNumber: null, invoiceRefusal: null }),
      Role.WAITER
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Aucune facture n'a été émise")
    expect(text).not.toContain("Générer la facture")
  })
})

describe("the dine-in table", () => {
  it("is displayed on the order detail, as it already is on the kitchen ticket", async () => {
    const container = await mountDetailPage(
      paidOrder({ invoiceNumber: null, invoiceRefusal: "seller_incomplete" })
    )

    const text = container.textContent ?? ""
    expect(text).toContain("Table")
    expect(text).toContain("12")
  })
})
