/**
 * The delete refusals, read from the screen the owner is standing in front of.
 *
 * WHY THIS FILE EXISTS (#412 P3-F1, P3-F5). #400 gave six deletes a
 * `ConvexError` carrying a French sentence the owner is meant to act on — and
 * four admin screens caught it and showed « Suppression impossible — réessayez »
 * or « Échec de la suppression » instead. The engine half was right and
 * undelivered: the person clicked delete, something went grey, and the reason
 * never appeared. The prize case was the worst of them, because the refusal
 * says *do not retry, deactivate instead* and the screen said *réessayez*.
 *
 * The UI half of #326 and #312 carried no test at any level, which is why it
 * could be wrong for a whole release. So these cases do not assert the handler,
 * and they do not assert the source: they MOUNT the screen, click the delete
 * control, let the mutation reject with the refusal the server really throws,
 * and read what was put in front of the owner. That is the seam that failed.
 *
 * `react-dom/client` + `act` rather than a testing library, as
 * `app-sidebar-render.test.tsx` established: zustand reads through
 * `useSyncExternalStore`, whose server snapshot is the store's initial state,
 * so anything rendered to a string answers for the wrong store and the wrong
 * role. Radix opens a dropdown on `pointerdown` and not on `click`, which is
 * why `openMenu` exists.
 *
 * The last cases are the class rather than the instances: no delete handler in
 * `pages/` may throw the server's sentence away. Eight screens are what this
 * file mounts; seventeen call sites across fifteen files call a delete, and the
 * one that gets added next week will not be in this file.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ConvexError } from "convex/values"
import fs from "node:fs"
import path from "node:path"

const h = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  queryResults: new Map<unknown, unknown>(),
  rejection: { value: null as unknown },
  // What a mutation that does NOT reject resolves with. Most screens ignore it;
  // `emailSubscribers.remove` returns `{ deleted, complete }` and must not
  // announce a removal that has not finished.
  resolution: { value: null as unknown },
}))

vi.mock("sonner", () => ({
  toast: {
    error: h.toastError,
    success: h.toastSuccess,
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  },
}))

// Every screen here reads its rows through Convex and writes through one
// mutation. The double answers the reads from `queryResults` and makes the
// write reject with whatever refusal the case is about.
vi.mock("convex/react", () => ({
  useQuery: (ref: unknown) => (ref === "skip" ? undefined : h.queryResults.get(ref)),
  useMutation: () => async () => {
    if (h.rejection.value) throw h.rejection.value
    return h.resolution.value
  },
  useAction: () => async () => null,
  usePaginatedQuery: (ref: unknown) => ({
    results: (h.queryResults.get(ref) as unknown[]) ?? [],
    status: "Exhausted",
    loadMore: () => {},
    isLoading: false,
  }),
}))

import { GameCatalogPage } from "../pages/games/catalog-page"
import { GameQrCodesPage } from "../pages/games/qr-codes-page"
import { EmailTemplatesPage } from "../pages/email/templates/email-templates-page"
import { EmailSegmentsPage } from "../pages/email/segments/email-segments-page"
import { EmailCampaignsPage } from "../pages/email/campaigns/email-campaigns-page"
import { EmailSubscribersPage } from "../pages/email/subscribers/email-subscribers-page"
import { PromotionsPage } from "../pages/promotions/promotions-page"
import { MenusTab } from "../pages/products/menus-tab"
import { RELAUNCHABLE_STATUSES } from "@be-in-digital/convex-functions/emailCampaigns"
import { useAdminApiStore } from "../stores/admin-api-store"
import { useAdminStoreSelection } from "@be-in-digital/restaurant"

const STORE = "stores:1"
const NOW = 1_700_000_000_000

/**
 * The injected Convex API, as the screens read it.
 *
 * Every value is a distinct string so `useQuery` can tell one subscription from
 * another; the screens only ever use these as opaque references.
 */
const api = {
  games: { list: "games.list", remove: "games.remove", create: "games.create", update: "games.update", toggleStatus: "games.toggle" },
  prizes: { list: "prizes.list", remove: "prizes.remove", create: "prizes.create", update: "prizes.update", toggleStatus: "prizes.toggle" },
  gameQRCodes: { list: "qr.list", remove: "qr.remove", create: "qr.create", setActive: "qr.setActive" },
  emailTemplates: { list: "tpl.list", remove: "tpl.remove", duplicate: "tpl.dup", create: "tpl.create", update: "tpl.update" },
  emailSegments: { list: "seg.list", remove: "seg.remove", duplicate: "seg.dup", create: "seg.create", update: "seg.update" },
  emailCampaigns: {
    list: "camp.list", remove: "camp.remove", create: "camp.create", update: "camp.update",
    pause: "camp.pause", cancel: "camp.cancel", schedule: "camp.schedule",
  },
  emailSubscribers: {
    list: "sub.list", remove: "sub.remove", countByStatus: "sub.counts",
    create: "sub.create", update: "sub.update", addTag: "sub.addTag", removeTag: "sub.removeTag",
  },
  emailConfig: { get: "config.get" },
  promotions: { list: "promo.list", remove: "promo.remove", toggleStatus: "promo.toggle", create: "promo.create", update: "promo.update" },
  menus: { list: "menus.list", remove: "menus.remove", toggleStatus: "menus.toggle", create: "menus.create", update: "menus.update" },
  products: { list: "products.list" },
  categories: { list: "categories.list" },
  stores: { listAll: "stores.listAll" },
}

beforeAll(() => {
  // React refuses to run `act` outside a test environment without this.
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  // jsdom ships none of the four things Radix and the UI kit read on mount.
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
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView = () => {}
  const proto = Element.prototype as unknown as Record<string, unknown>
  proto.hasPointerCapture = () => false
  proto.setPointerCapture = () => {}
  proto.releasePointerCapture = () => {}
})

let mounted: { root: Root; container: HTMLElement } | null = null

afterEach(() => {
  if (mounted) {
    const { root, container } = mounted
    act(() => root.unmount())
    container.remove()
    mounted = null
  }
  document.body.innerHTML = ""
  h.toastError.mockClear()
  h.toastSuccess.mockClear()
  h.queryResults.clear()
  h.rejection.value = null
  h.resolution.value = null
})

function mount(element: React.ReactElement): void {
  useAdminApiStore.setState({ api })
  useAdminStoreSelection.setState({ storeId: STORE })
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(element))
  mounted = { root, container }
}

const seed = (ref: string, rows: unknown) => h.queryResults.set(ref, rows)

/** Everything clickable, dialogs and dropdowns included — both render in a portal. */
const clickables = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>("button, [role='menuitem']"))

const label = (el: Element): string => (el.textContent ?? "").trim()

async function click(el: Element) {
  await act(async () => {
    ;(el as HTMLElement).click()
  })
}

/** Radix opens a dropdown on `pointerdown`, so a plain click never gets there. */
async function openMenu(trigger: Element) {
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    ;(trigger as HTMLElement).click()
  })
}

async function clickByLabel(text: string) {
  const hit = clickables().find((el) => label(el) === text)
  if (!hit) {
    throw new Error(
      `no clickable "${text}"; the screen offers: ` +
        clickables().map(label).filter(Boolean).join(" | ")
    )
  }
  await click(hit)
}

/** The row's `⋯` menu: the only button whose icon is the ellipsis. */
async function openRowMenu() {
  const trigger = clickables().find((b) => b.querySelector("svg[class*='ellipsis']"))
  if (!trigger) throw new Error("no row menu on this screen")
  await openMenu(trigger)
}

/** The `⌫` icon button of a card or row. */
async function clickTrash(which: "first" | "last" = "first") {
  const bins = clickables().filter((b) => b.querySelector("svg[class*='trash']"))
  expect(bins.length).toBeGreaterThan(0)
  const bin = which === "first" ? bins[0] : bins[bins.length - 1]
  if (!bin) throw new Error("no delete control on this screen")
  await click(bin)
}

/** Everything the screen said in a red toast, joined. */
const shown = (): string => h.toastError.mock.calls.map((call) => String(call[0])).join(" || ")

/** Reject the next mutation with the refusal the server really throws. */
function refuse(code: string, message: string) {
  h.rejection.value = new ConvexError({ code, message })
}

// ---------------------------------------------------------------------------
// The four screens of #412 P3-F1 — #400's refusals, swallowed
// ---------------------------------------------------------------------------

describe("games & prizes — catalog-page", () => {
  const GAME = { _id: "games:1", name: "Roue de la chance", type: "wheel", winRatio: 30, isActive: true }
  const PRIZE = {
    _id: "prizes:1", name: "Café offert", type: "custom", value: 0,
    quantity: 5, remainingQuantity: 5, isActive: true,
  }

  it("shows why a won prize cannot be deleted, and that deactivating works", async () => {
    seed("games.list", [])
    seed("prizes.list", [PRIZE])
    refuse(
      "prize_has_redemptions",
      "« Café offert » a déjà été gagné par des joueurs : il ne peut pas être supprimé, " +
        "sinon les lots remis restent introuvables au comptoir. " +
        "Désactivez-le pour le retirer du jeu — les lots déjà gagnés restent valables."
    )

    mount(<GameCatalogPage />)
    await clickTrash("last")
    await clickByLabel("Supprimer")

    expect(shown()).toContain("Désactivez-le pour le retirer du jeu")
    // The line it replaced told the owner to do the one thing that cannot work.
    expect(shown()).not.toContain("réessayez")
  })

  it("shows why a played game cannot be deleted", async () => {
    seed("prizes.list", [])
    seed("games.list", [GAME])
    refuse(
      "game_has_plays",
      "« Roue de la chance » a déjà été joué : désactivez-le pour le retirer des QR codes."
    )

    mount(<GameCatalogPage />)
    await clickTrash("first")
    await clickByLabel("Supprimer")

    expect(shown()).toContain("désactivez-le pour le retirer des QR codes")
  })
})

describe("email templates — email-templates-page", () => {
  it("names the campaigns still built on the model", async () => {
    seed("tpl.list", [
      { _id: "tpl:1", name: "Newsletter", subject: "Nos offres", category: "marketing", updatedAt: NOW },
    ])
    refuse(
      "template_in_campaign",
      "Ce modèle est utilisé par 1 campagne en cours ou à venir : « Promo été ». " +
        "Changez son modèle ou annulez-la avant de le supprimer."
    )

    mount(<EmailTemplatesPage />)
    await openRowMenu()
    await clickByLabel("Supprimer")
    await clickByLabel("Supprimer")

    expect(shown()).toContain("« Promo été »")
  })
})

describe("email segments — email-segments-page", () => {
  it("names the campaigns still filtering on the segment", async () => {
    seed("seg.list", [
      { _id: "seg:1", name: "Clients inactifs", conditions: [], operator: "and", subscriberCount: 12, updatedAt: NOW },
    ])
    refuse(
      "segment_in_campaign",
      "Ce segment est utilisé par 1 campagne en cours ou à venir : « Relance ». " +
        "Changez son segment ou annulez-la avant de le supprimer."
    )

    mount(<EmailSegmentsPage />)
    await openRowMenu()
    await clickByLabel("Supprimer")
    await clickByLabel("Supprimer")

    expect(shown()).toContain("« Relance »")
  })
})

// ---------------------------------------------------------------------------
// The removes guarded here (#412 P3-F2, P3-F3, P3-F4)
// ---------------------------------------------------------------------------

describe("email campaigns — email-campaigns-page", () => {
  it("says a partly-sent campaign is the record, and points at « Relancer »", async () => {
    seed("camp.list", [
      {
        _id: "camp:1", name: "Promo été", subject: "-20% cette semaine", status: "failed",
        stats: { sent: 400, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
        updatedAt: NOW, createdAt: NOW,
      },
    ])
    seed("config.get", { senderName: "Chez Luigi", senderEmail: "hello@luigi.fr" })
    seed("tpl.list", [])
    refuse(
      "campaign_already_sent",
      "« Promo été » a déjà été envoyée à une partie de votre liste : la supprimer " +
        "effacerait la trace de qui l'a reçue, et un nouvel envoi écrirait deux fois " +
        "aux mêmes personnes. Utilisez « Relancer » pour reprendre là où l'envoi s'est arrêté."
    )

    mount(<EmailCampaignsPage />)
    await openRowMenu()
    await clickByLabel("Supprimer")
    await clickByLabel("Supprimer")

    expect(shown()).toContain("« Relancer »")
    expect(shown()).toContain("deux fois")
  })

  it("renders « Relancer » for exactly the statuses the refusal names", async () => {
    // The refusal quotes this button. Two literals that happen to agree today
    // is how a message ends up naming a control the screen is not rendering —
    // which is the same defect as swallowing the message, one layer down.
    const source = fs.readFileSync(
      path.join(__dirname, "..", "pages", "email", "campaigns", "email-campaigns-page.tsx"),
      "utf8"
    )
    expect(source).toContain(
      'from "@be-in-digital/convex-functions/emailCampaigns"'
    )
    expect(source).toContain("RELAUNCHABLE_STATUSES.includes(campaign.status)")

    for (const status of RELAUNCHABLE_STATUSES) {
      seed("camp.list", [
        {
          _id: `camp:${status}`, name: "Promo été", subject: "-20%", status,
          stats: { sent: 400, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
          updatedAt: NOW, createdAt: NOW,
        },
      ])
      seed("config.get", { senderName: "Chez Luigi", senderEmail: "hello@luigi.fr" })
      seed("tpl.list", [])

      mount(<EmailCampaignsPage />)
      await openRowMenu()
      expect(clickables().map(label)).toContain("Relancer")

      const { root, container } = mounted!
      act(() => root.unmount())
      container.remove()
      mounted = null
      document.body.innerHTML = ""
      h.queryResults.clear()
    }
  })
})

describe("game QR codes — qr-codes-page", () => {
  const QR = {
    _id: "qr:1", code: "TABLE12", tableNumber: "12", location: "Salle",
    isActive: true, scannedCount: 7,
  }

  it("says a played code is where consent was collected", async () => {
    seed("qr.list", [QR])
    refuse(
      "qr_code_has_plays",
      "Des parties ont été jouées avec le code « TABLE12 » (table 12) : le supprimer " +
        "effacerait la seule trace de l'endroit où le consentement de ces joueurs a été " +
        "recueilli. Désactivez-le — le QR code cesse aussitôt de fonctionner et les parties restent."
    )

    mount(<GameQrCodesPage />)
    await clickTrash()
    await clickByLabel("Supprimer")

    expect(shown()).toContain("Désactivez-le")
  })

  it("offers the deactivation the refusal names", async () => {
    // A refusal whose way out is not on the screen is a dead end. `isActive`
    // has been in the schema from the start and the screen had create and
    // delete and nothing in between.
    seed("qr.list", [QR])
    mount(<GameQrCodesPage />)
    await clickByLabel("Désactiver")
    const said = h.toastSuccess.mock.calls.map((call) => String(call[0])).join(" || ")
    expect(said).toContain("désactivé")
  })
})

describe("promotions — promotions-page", () => {
  it("says a redeemed coupon is on the orders it discounted", async () => {
    seed("promo.list", [
      {
        _id: "promo:1", name: "Bienvenue", triggerMode: "coupon", couponCode: "BIENVENUE",
        discountType: "percentage", discountValue: 10, isActive: true, usageCount: 42,
        startDate: NOW - 86_400_000, endDate: NOW + 86_400_000, createdAt: NOW,
      },
    ])
    refuse(
      "promotion_in_order",
      "« Bienvenue » a déjà été utilisée sur des commandes : la supprimer laisserait " +
        "ces commandes — et leurs factures — avec une remise que plus rien ne justifie. " +
        "Désactivez-la : le code cesse aussitôt de fonctionner et l'historique reste lisible."
    )

    mount(<PromotionsPage />)
    await openRowMenu()
    await clickByLabel("Supprimer")
    await clickByLabel("Supprimer")

    expect(shown()).toContain("leurs factures")
  })
})

describe("menus — menus-tab", () => {
  it("names the prize that gives the formule away", async () => {
    seed("menus.list", [
      { _id: "menus:1", name: "Formule midi", price: 1590, isActive: true, sections: [] },
    ])
    seed("products.list", [])
    seed("categories.list", [])
    refuse(
      "menu_in_prize",
      "Cette formule est offerte par 1 lot : « Menu offert ». " +
        "Changez ce lot avant de supprimer la formule."
    )

    mount(<MenusTab />)
    await openRowMenu()
    await clickByLabel("Supprimer")
    await clickByLabel("Supprimer")

    expect(shown()).toContain("« Menu offert »")
  })
})

describe("email subscribers — email-subscribers-page", () => {
  it("does not claim a subscriber is gone while the drain is still running", async () => {
    // `remove` clears the subscriber's events and automation runs first and the
    // subscriber last, so a long-standing address can need more than one
    // transaction. « Abonné supprimé » on the pass that did not finish leaves
    // the owner looking at a row that is still on the list.
    seed("sub.list", [
      { _id: "sub:1", email: "diner@example.fr", status: "active", source: "storefront_form", createdAt: NOW },
    ])
    seed("sub.counts", { all: 1, active: 1, unsubscribed: 0, bounced: 0, complained: 0, pending: 0 })
    h.resolution.value = { deleted: 512, complete: false }

    mount(<EmailSubscribersPage />)
    await openRowMenu()
    await clickByLabel("Supprimer")
    await clickByLabel("Supprimer")

    const said = h.toastSuccess.mock.calls.map((call) => String(call[0])).join(" || ")
    expect(said).toContain("Suppression en cours")
    expect(said).not.toBe("Abonné supprimé")
  })

  it("shows the server's reason rather than discarding the error entirely", async () => {
    // This one caught with a bare `catch {}` — the error was not even bound.
    seed("sub.list", [
      { _id: "sub:1", email: "diner@example.fr", status: "active", source: "storefront_form", createdAt: NOW },
    ])
    seed("sub.counts", { all: 1, active: 1, unsubscribed: 0, bounced: 0, complained: 0, pending: 0 })
    refuse("subscriber_locked", "Cet abonné ne peut pas être supprimé pour le moment.")

    mount(<EmailSubscribersPage />)
    await openRowMenu()
    await clickByLabel("Supprimer")
    await clickByLabel("Supprimer")

    expect(shown()).toContain("Cet abonné ne peut pas être supprimé")
  })
})

// ---------------------------------------------------------------------------
// The class, not the instances
// ---------------------------------------------------------------------------

describe("no delete screen throws the server's sentence away", () => {
  const PAGES = path.join(__dirname, "..", "pages")

  /** Every `.ts`/`.tsx` under `pages/`. */
  function sources(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return sources(full)
      return /\.tsx?$/.test(entry.name) ? [full] : []
    })
  }

  /**
   * Files that call a delete mutation. Both access styles: `api.games.remove`
   * and `api?.emailTemplates?.remove` — a sweep for one of them finds eight of
   * the seventeen, which is how four of these went unnoticed.
   */
  const deleteScreens = sources(PAGES).filter((file) =>
    /useMutation\(\s*api[?.]+[A-Za-z]+[?.]+remove/.test(fs.readFileSync(file, "utf8"))
  )

  it("finds the delete screens at all", () => {
    // A regex that matches nothing would make every case below vacuously true.
    expect(deleteScreens.length).toBeGreaterThanOrEqual(12)
  })

  /** The `{ ... }` that opens at `from`, matched brace for brace. */
  function block(source: string, from: number): string {
    const open = source.indexOf("{", from)
    let depth = 0
    let end = open
    for (; end < source.length; end++) {
      if (source[end] === "{") depth++
      else if (source[end] === "}" && --depth === 0) break
    }
    return source.slice(from, end + 1)
  }

  /**
   * What a screen does with the rejection of EVERY delete call it makes.
   *
   * Scoped to the deletes, deliberately: a screen may perfectly reasonably show
   * a fixed line when a clipboard copy fails, and an assertion over the whole
   * file would fail on that and prove nothing about the delete.
   *
   * Every one of them, and that is not pedantry. The first version of this
   * matched the first binding and stopped, so `catalog-page` was covered for
   * `removeGame` and not for `removePrize` — the prize case, which is the one
   * whose refusal says *do not retry* — and `use-store-detail` was covered for
   * Uber Eats and not for Deliveroo. Reverting either of the two it skipped
   * left the whole admin suite green.
   */
  function deleteCatches(source: string): string[] {
    const bindings = [
      ...source.matchAll(
        /const\s+(\w+)\s*=\s*useMutation\(\s*api[?.]+[A-Za-z]+[?.]+remove/g
      ),
    ].map((match) => match[1] as string)
    if (bindings.length === 0) throw new Error("no delete mutation binding found")

    const catches: string[] = []
    for (const binding of bindings) {
      // A binding can be called from more than one handler — `use-store-detail`
      // removes an Uber Eats integration and a Deliveroo one through the same
      // `removeIntegration`.
      const calls = [...source.matchAll(new RegExp(`await ${binding}\\(`, "g"))]
      if (calls.length === 0) throw new Error(`${binding} is never called`)
      for (const call of calls) {
        const caught = source.indexOf("catch", call.index ?? 0)
        if (caught < 0) throw new Error(`nothing catches ${binding}`)
        catches.push(block(source, caught))
      }
    }
    return catches
  }

  it("looks at every delete on the screen, not just the first", () => {
    // The two files with two deletes each. If this stops being true the sweep
    // below is weaker than it reads, and nothing else would say so.
    expect(deleteCatches(fs.readFileSync(path.join(PAGES, "games", "catalog-page.tsx"), "utf8")))
      .toHaveLength(2)
    expect(deleteCatches(fs.readFileSync(path.join(PAGES, "stores", "use-store-detail.ts"), "utf8")))
      .toHaveLength(2)
    // Eighteen call sites across sixteen files — seventeen across fifteen until
    // the automations screen arrived with the eighteenth (#270). Its refusal is
    // the one this whole file is about: `emailAutomations.remove` refuses to
    // delete an automation that has already mailed somebody, and says so in a
    // sentence that offers « pause » instead.
    const total = deleteScreens.reduce(
      (sum, file) => sum + deleteCatches(fs.readFileSync(file, "utf8")).length,
      0
    )
    expect(total).toBe(18)
  })

  it.each(deleteScreens.map((file) => [path.relative(PAGES, file), file]))(
    "%s reads the refusal out of the ConvexError",
    (_name, file) => {
      const handlers = deleteCatches(fs.readFileSync(file as string, "utf8"))
      for (const handler of handlers) {
        expect(handler).toContain("convexErrorMessage(")
        // A bound-and-ignored `error`, or none bound at all, is the same defect.
        expect(handler).not.toMatch(/catch\s*\{/)
      }
    }
  )
})
