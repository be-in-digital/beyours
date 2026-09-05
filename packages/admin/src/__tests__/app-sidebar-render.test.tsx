/**
 * The sidebar, rendered for one role at a time.
 *
 * `nav-visibility.test.ts` proves the RULE. This proves the sidebar APPLIES
 * it — the half only a render can answer. The two are not the same claim:
 * `AppSidebar` filtered on the role alone for as long as the rule it now calls
 * did not exist, and a correct rule that nothing invokes protects nobody.
 *
 * WHY A REAL DOM AND NOT `renderToStaticMarkup`: zustand reads through
 * `useSyncExternalStore`, whose server snapshot is the store's INITIAL state.
 * Under `renderToStaticMarkup` every role therefore renders as the default
 * `customer` and every "this link is absent" assertion passes for the wrong
 * reason. The first draft of this file did exactly that and was green while
 * proving nothing — which is why the positive cases below are as important as
 * the negative ones.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { Role } from "@be-in-digital/core"

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}))

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

// The badge subscribes to Convex for an unread count. There is no client here,
// and the count is not what this file is about.
vi.mock("../components/unread-messages-badge", () => ({
  UnreadMessagesBadge: () => null,
}))

import { AppSidebar } from "../components/app-sidebar"
import { SidebarProvider } from "@be-in-digital/ui"
import { useAdminAuthStore } from "../stores/admin-auth-store"

beforeAll(() => {
  // React refuses to run `act` outside a test environment without this.
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  // `useIsMobile` reads it on mount; jsdom ships no implementation.
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

/**
 * The entries the sidebar draws for a member with this role and module
 * selection.
 *
 * Both shapes: a plain entry is an `<a>`, a collapsible one is a trigger button
 * whose children stay unmounted while it is closed. Reading only the anchors is
 * how the first draft "proved" that Gamification, Email Marketing and Blog were
 * hidden from every role — they are never anchors.
 */
function entriesFor(role: Role, modules: string[] = []): { label: string; href: string }[] {
  useAdminAuthStore.setState({ role, permissions: modules })
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    )
  })
  mounted = { root, container }
  return [...container.querySelectorAll("a[href], button")].map((el) => ({
    label: (el.textContent ?? "").trim(),
    href: el.getAttribute("href") ?? "",
  }))
}

const labelsFor = (role: Role, modules: string[] = []): string[] =>
  entriesFor(role, modules).map((e) => e.label)

const hrefsFor = (role: Role, modules: string[] = []): string[] =>
  entriesFor(role, modules).map((e) => e.href)

describe("the sweep renders something to look at", () => {
  it("draws an owner the whole nav", () => {
    const labels = labelsFor(Role.CLIENT_ADMIN)
    // Without this, every "the link is absent" assertion below could pass on an
    // empty render.
    expect(labels).toContain("Commandes")
    expect(labels).toContain("Cuisine (KDS)")
    expect(labels).toContain("Paiements")
    // The collapsible entries are buttons, not anchors — read them too, or
    // every assertion about them is vacuous.
    expect(labels).toContain("Gamification")
    expect(labels).toContain("Email Marketing")
    expect(labels.length).toBeGreaterThan(12)
  })
})

describe("the KDS link is drawn for exactly the roles the server serves", () => {
  it("is absent for a waiter", () => {
    expect(labelsFor(Role.WAITER)).not.toContain("Cuisine (KDS)")
    expect(hrefsFor(Role.WAITER)).not.toContain("/dashboard/orders/kitchen")
  })

  it("is absent for a delivery driver", () => {
    expect(labelsFor(Role.DELIVERY)).not.toContain("Cuisine (KDS)")
    expect(hrefsFor(Role.DELIVERY)).not.toContain("/dashboard/orders/kitchen")
  })

  it("is present for the kitchen role", () => {
    expect(labelsFor(Role.KITCHEN)).toContain("Cuisine (KDS)")
    expect(hrefsFor(Role.KITCHEN)).toContain("/dashboard/orders/kitchen")
  })

  it("is present for a manager and for the owner", () => {
    for (const role of [Role.MANAGER, Role.CLIENT_ADMIN, Role.SUPER_ADMIN]) {
      expect(labelsFor(role), role).toContain("Cuisine (KDS)")
    }
  })
})

describe("the roles that lost the KDS link keep the ones they can use", () => {
  it("still shows a waiter Commandes, Menu & Produits and Paiements", () => {
    const labels = labelsFor(Role.WAITER)
    expect(labels).toContain("Commandes")
    expect(labels).toContain("Menu & Produits")
    expect(labels).toContain("Paiements")
  })

  it("still shows a driver Commandes, and does not leave them an empty sidebar", () => {
    const labels = labelsFor(Role.DELIVERY)
    expect(labels).toContain("Commandes")
    expect(labels).toContain("Vue d'ensemble")
  })
})

describe("the module selection reaches the markup", () => {
  it("withholds the marketing entries from a manager granted only orders", () => {
    const labels = labelsFor(Role.MANAGER, ["orders"])
    expect(labels).toContain("Commandes")
    for (const label of ["Promotions", "Gamification", "Email Marketing", "Blog"]) {
      expect(labels, label).not.toContain(label)
    }
  })

  it("restores them when the marketing module is granted", () => {
    const labels = labelsFor(Role.MANAGER, ["orders", "marketing"])
    for (const label of ["Promotions", "Gamification", "Email Marketing", "Blog"]) {
      expect(labels, label).toContain(label)
    }
  })

  it("never narrows the owner", () => {
    expect(labelsFor(Role.CLIENT_ADMIN, ["orders"])).toEqual(
      labelsFor(Role.CLIENT_ADMIN, [])
    )
  })
})
