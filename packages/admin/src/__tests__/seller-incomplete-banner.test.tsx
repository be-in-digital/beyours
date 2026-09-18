/**
 * The dashboard warns while `globalSettings.seller` is incomplete — and only
 * the people who can fix it are told.
 *
 * #375: `issueInvoiceForOrder` refuses silently by design, so without this
 * banner nothing in the product ever said "your deployment issues no
 * invoices". It gates on `settings:write` (held by exactly SUPER_ADMIN and
 * CLIENT_ADMIN) and on the engine's own `sellerIsComplete`, so the banner
 * and the refusal cannot disagree about what "complete" means.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { Role } from "@be-yours/core"

/** What the mocked `globalSettings.get` answers; set per test. */
const state: { settings: unknown } = { settings: undefined }

vi.mock("convex/react", () => ({
  useQuery: () => state.settings,
}))

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { SellerIncompleteBanner } from "../pages/dashboard/seller-incomplete-banner"
import { useAdminApiStore } from "../stores/admin-api-store"
import { useAdminAuthStore } from "../stores/admin-auth-store"

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

let mounted: { root: Root; container: HTMLElement } | null = null

afterEach(() => {
  if (!mounted) return
  const { root, container } = mounted
  act(() => root.unmount())
  container.remove()
  mounted = null
})

function mountBanner(role: Role, settings: unknown) {
  state.settings = settings
  useAdminApiStore.setState({
    api: { globalSettings: { get: "globalSettings:get" } },
  })
  useAdminAuthStore.setState({ role })
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted = { root, container }
  act(() => {
    root.render(<SellerIncompleteBanner />)
  })
  return container
}

describe("the seller-incomplete banner", () => {
  it("warns the owner while the identity is incomplete, and links to the billing tab", () => {
    const container = mountBanner(Role.CLIENT_ADMIN, { integrations: {} })

    const text = container.textContent ?? ""
    expect(text).toContain("Identité de l'établissement incomplète")
    expect(text).toContain("aucune facture")
    const link = container.querySelector("a")
    expect(link?.getAttribute("href")).toContain("tab=billing")
  })

  it("is gone once the identity is complete", () => {
    const container = mountBanner(Role.CLIENT_ADMIN, {
      seller: { legalName: "SARL Chez Luigi" },
    })

    expect(container.textContent ?? "").toBe("")
  })

  it("says nothing to staff who cannot fix it", () => {
    // A manager holds orders and kitchen permissions, not settings:write —
    // warning them produces worry with no way to act on it.
    const container = mountBanner(Role.MANAGER, { integrations: {} })

    expect(container.textContent ?? "").toBe("")
  })

  it("says nothing while the settings are still loading", () => {
    const container = mountBanner(Role.CLIENT_ADMIN, undefined)

    expect(container.textContent ?? "").toBe("")
  })
})
