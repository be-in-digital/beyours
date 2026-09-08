/**
 * The KDS screen's own behaviours, after it was lifted out of the two apps.
 *
 * A lift is a merge, and a merge silently picks a winner. Two things here
 * existed in ONE of the two copies and would have been deleted by taking the
 * other whole: the timer's 24h cap (packaged copy only) and the
 * completed/print/sound/order-mode machinery (app copy only). This file holds
 * both, so the next person to reconcile these files finds out from a test
 * rather than from a kitchen.
 *
 * The tour's KDS step is NOT here: `onboarding-tour.test.ts` owns it, and its
 * steps anchor on the sidebar entry rather than on anything this screen
 * renders — a navigating step measures before the page paints.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import fs from "node:fs"
import path from "node:path"

import { TicketTimer } from "../pages/kitchen/ticket-timer"
import { StationFilter } from "../pages/kitchen/station-filter"

const KITCHEN = path.join(__dirname, "../pages/kitchen")

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

let mounted: { root: Root; container: HTMLElement } | null = null

afterEach(() => {
  if (!mounted) return
  act(() => mounted!.root.unmount())
  mounted.container.remove()
  mounted = null
})

function render(node: React.ReactNode): HTMLElement {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(node))
  mounted = { root, container }
  return container
}

describe("the ticket timer", () => {
  const minutesAgo = (m: number): number => Date.now() - m * 60_000

  it("counts minutes below the hour", () => {
    expect(render(<TicketTimer createdAt={minutesAgo(7)} />).textContent).toBe("7m")
  })

  it("counts hours and minutes above it", () => {
    expect(render(<TicketTimer createdAt={minutesAgo(95)} />).textContent).toBe("1h 35m")
  })

  it("caps the display at 24h, because past that the figure is noise", () => {
    // A ticket nobody cleared is stale data, not a rush to prioritise. Without
    // the cap the pass reads "2237h 47m", which is the copy this screen shipped
    // in both apps for as long as the fix lived only in the packaged copy that
    // nothing rendered.
    expect(render(<TicketTimer createdAt={minutesAgo(24 * 60)} />).textContent).toBe("+24h")
    expect(render(<TicketTimer createdAt={minutesAgo(2237 * 60 + 47)} />).textContent).toBe("+24h")
  })

  it("does not cap one minute early", () => {
    expect(render(<TicketTimer createdAt={minutesAgo(24 * 60 - 1)} />).textContent).toBe("23h 59m")
  })

  /**
   * WCAG 1.4.1, on the screen where getting it wrong costs a real order.
   *
   * The three urgency bands were a hue and nothing else — muted, yellow-600,
   * red-600 — so "this ticket is late" was said in colour alone to a kitchen
   * reading the board from across the room. The elapsed figure is not the
   * redundant cue people assume: "14m" and "25m" are both just numbers unless
   * you already know where this kitchen's thresholds sit.
   *
   * Each band now carries a distinct shape, and the two that mean something
   * carry a name. The assertions below are on the SHAPE, not on the colour:
   * a fix that only recoloured would still leave the screen unreadable to the
   * roughly one man in twelve who cannot separate that yellow from that red.
   */
  const iconOf = (minutes: number): SVGElement | null =>
    render(<TicketTimer createdAt={minutesAgo(minutes)} />).querySelector("svg")

  it("marks a late ticket with a shape, not only with red", () => {
    expect(iconOf(25)).not.toBeNull()
  })

  it("marks a watched ticket with a DIFFERENT shape from a late one", () => {
    // Two markers that differ only in colour would fail 1.4.1 exactly as the
    // two text colours did.
    const watched = iconOf(14)
    const late = iconOf(25)
    expect(watched).not.toBeNull()
    expect(late).not.toBeNull()
    expect(watched!.getAttribute("class")).not.toBe(late!.getAttribute("class"))
  })

  it("leaves a ticket inside the normal window unmarked", () => {
    // The marker has to mean something. A badge on every card is no badge.
    expect(iconOf(3)).toBeNull()
    expect(iconOf(9)).toBeNull()
  })

  it("names each band for a screen reader", () => {
    const named = (minutes: number): string | null =>
      render(<TicketTimer createdAt={minutesAgo(minutes)} />)
        .querySelector("[aria-label]")
        ?.getAttribute("aria-label") ?? null

    expect(named(14)).toMatch(/surveiller/i)
    expect(named(25)).toMatch(/retard/i)
  })

  it("keeps the elapsed figure as the only text it prints", () => {
    // The marker is an SVG on purpose: an sr-only span would land inside the
    // string the four assertions above compare exactly.
    expect(render(<TicketTimer createdAt={minutesAgo(25)} />).textContent).toBe("25m")
  })
})

describe("the station filter", () => {
  it("marks the selected station without nesting a div inside a button", () => {
    const container = render(
      <StationFilter
        stations={["grillades", "desserts"]}
        selectedStation="grillades"
        onStationChange={() => {}}
      />
    )
    const buttons = [...container.querySelectorAll("button")]
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Toutes les stations",
      "grilladesActif",
      "desserts",
    ])
    // The button content model admits phrasing content only, and this package's
    // `Badge` renders a `<div>`.
    for (const button of buttons) {
      expect(button.querySelector("div")).toBeNull()
    }
  })

  it("offers an unfiltered option, marked when nothing is selected", () => {
    const container = render(
      <StationFilter stations={["grillades"]} selectedStation={null} onStationChange={() => {}} />
    )
    expect(container.querySelector("button")?.textContent).toBe("Toutes les stationsActif")
  })
})

describe("the machinery the packaged fork had lost", () => {
  const page = (): string => fs.readFileSync(path.join(KITCHEN, "kitchen-page.tsx"), "utf8")

  it("keeps the order-mode control, the completed tab, sound and printing", () => {
    const src = page()
    expect(src).toContain("updateOrderMode")
    expect(src).toContain("CompletedTickets")
    expect(src).toContain("KitchenSoundManager")
    expect(src).toContain("KitchenPrintTrigger")
    expect(src).toContain("PrintStatusBadge")
  })

  it("keeps the marketplace actions on the ticket, not just a status write", () => {
    // Accepting a ticket has to reach Uber Eats and Deliveroo. The packaged
    // fork called `updateStatus` and nothing else, so a marketplace order was
    // marked ready in the restaurant and never in the app the customer holds.
    const card = fs.readFileSync(path.join(KITCHEN, "ticket-card.tsx"), "utf8")
    for (const fn of ["acceptTicket", "readyTicket", "completeTicket", "cancelTicket", "requestReprint"]) {
      expect(card, fn).toContain(fn)
    }
  })

  it("puts the diner's own note on the card, not only on the paper", () => {
    // `kitchenTickets.deliveryNotes` reached the printed slip and stopped
    // there, so a kitchen working off the screen — which is the display this
    // product ships — never saw it. Since the storefront gained a field for
    // it (#376) what arrives is usually an allergy.
    const card = fs.readFileSync(path.join(KITCHEN, "ticket-card.tsx"), "utf8")
    expect(card).toContain("ticket.deliveryNotes")
    expect(card).toContain("Note client")
    // And a delivery order still reads as delivery instructions.
    expect(card).toContain("Instructions livraison")
  })

  it("renders three active columns, not four", () => {
    const src = page()
    expect(src).toContain('ACTIVE_STATUSES: ActiveStatus[] = ["pending", "in_progress", "ready"]')
    expect(src).toContain("lg:grid-cols-3")
    expect(src).not.toContain("lg:grid-cols-4")
  })
})
