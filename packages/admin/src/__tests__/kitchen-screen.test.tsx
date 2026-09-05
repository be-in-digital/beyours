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

  it("renders three active columns, not four", () => {
    const src = page()
    expect(src).toContain('ACTIVE_STATUSES: ActiveStatus[] = ["pending", "in_progress", "ready"]')
    expect(src).toContain("lg:grid-cols-3")
    expect(src).not.toContain("lg:grid-cols-4")
  })
})
