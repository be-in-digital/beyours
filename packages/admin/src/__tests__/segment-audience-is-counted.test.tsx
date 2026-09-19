/**
 * « 0 abonnés » for every segment, for as long as segments have existed (#524).
 *
 * WHAT WAS WRONG. `emailSegments.subscriberCount` is written in exactly two
 * places: `create` writes `0`, and `duplicate` copies whatever the original
 * held — which is `0`. The one function that could write a real figure,
 * `refreshCount`, was wrapped by no app and called by nothing, so the field was
 * a zero with a schema comment calling it a "cached count, refreshed
 * periodically".
 *
 * Three screens read it. The campaign wizard's audience estimate, the same
 * wizard's segment dropdown — « {n} abonnés » beside every option — and the
 * segments table. All three said 0, always, including for a segment matching
 * the whole list. The estimate is the number an operator checks before sending
 * to their entire customer base.
 *
 * COUNTED LIVE, NOT REFRESHED. `countMatchingSubscribers` already exists, is
 * already wrapped, and is already what `segment-form-dialog.tsx` calls to
 * preview a rule set as it is edited. Wrapping `refreshCount` instead would
 * have meant deciding when to run it, and a cached count that is stale in the
 * wrong direction is worse on this screen than no count: it is read immediately
 * before a send.
 *
 * So the stored field is presented by nothing, and this holds it that way.
 */

// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const PAGES = join(HERE, "../pages/email")

/** Every `countMatchingSubscribers` call the screen made, in order. */
const counted: Array<Record<string, unknown>> = []

vi.mock("convex/react", () => ({
  useQuery: (ref: unknown, args: unknown) => {
    if (args === "skip") return undefined
    if (ref === "emailSegments:countMatchingSubscribers") {
      counted.push(args as Record<string, unknown>)
      return { count: 137, scanned: 400, truncated: false }
    }
    if (ref === "emailSegments:list") return [SEGMENT]
    if (ref === "emailTemplates:list") return []
    if (ref === "emailSubscribers:countByStatus")
      return { active: 400, total: 480, truncated: false }
    return undefined
  },
  useMutation: () => async () => null,
  useAction: () => async () => null,
}))

vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }))

import { EmailSegmentsPage } from "../pages/email/segments/email-segments-page"
import { useAdminApiStore } from "../stores/admin-api-store"
import { useAdminStoreSelection } from "@be-yours/restaurant"

/** One segment, with the stored count deliberately wrong. */
const SEGMENT = {
  _id: "seg_1",
  name: "Habitués",
  // The value the screens used to show. A live count must not agree with it.
  subscriberCount: 0,
  rules: [{ field: "totalOrders", operator: "gte", value: 3 }],
  ruleOperator: "and",
  updatedAt: 1_700_000_000_000,
}

let mounted: { root: Root; container: HTMLElement } | null = null

beforeAll(() => {
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
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

afterEach(() => {
  if (mounted) {
    const { root, container } = mounted
    act(() => root.unmount())
    container.remove()
    mounted = null
  }
  counted.length = 0
})

/**
 * The segments table, which is where a live count is observable on mount.
 *
 * The wizard's own query is gated on reaching step 2 — correctly: opening the
 * dialog must not count an establishment's whole list. Driving it through two
 * steps of form-filling to observe one query would test the stepper, so the
 * wizard is held by the source assertions below instead, and the live count
 * itself is exercised here, where `SegmentAudience` fires on mount.
 */
async function mountSegmentsPage(): Promise<HTMLElement> {
  // The page short-circuits to « Aucun établissement sélectionné » without one,
  // and would then render no row to count.
  useAdminStoreSelection.setState({ storeId: "store_a" })
  useAdminApiStore.setState({
    api: {
      emailSegments: {
        list: "emailSegments:list",
        countMatchingSubscribers: "emailSegments:countMatchingSubscribers",
        create: "c",
        update: "u",
        remove: "r",
        duplicate: "d",
      },
      emailSubscribers: { countByStatus: "emailSubscribers:countByStatus" },
    },
  })
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted = { root, container }
  await act(async () => {
    root.render(<EmailSegmentsPage />)
  })
  return container
}

/** The source of a screen, comments removed. */
function code(relative: string): string {
  return readFileSync(join(PAGES, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
}

describe("the audience an email campaign is about to reach", () => {
  it("is counted, not read from the stored field", async () => {
    const text = (await mountSegmentsPage()).textContent ?? ""

    expect(counted.length, "no live count was asked for").toBeGreaterThan(0)
    // 137 is what the stubbed count answers; 0 is what the stored field holds.
    expect(text).toContain("137")
  })

  it("asks with the segment's own rules", async () => {
    // Anti-vacuity: a query fired with the wrong arguments counts the whole
    // list and reads as a working feature.
    await mountSegmentsPage()

    const asked = counted.find((args) => Array.isArray(args.rules))
    expect(asked, "the count was asked for without rules").toBeDefined()
    expect(asked?.ruleOperator).toBe("and")
    expect((asked?.rules as unknown[]).length).toBe(1)
  })

  it("the wizard asks the same question of the segment the operator chose", () => {
    /*
     * Source-level, and it is the wizard's gate that makes it so: the audience
     * query fires only from step 2, which is correct — opening the dialog must
     * not count an establishment's whole list — and driving the stepper to
     * observe one query would be a test of the stepper.
     *
     * What matters is that the wizard asks with the SELECTED segment's rules
     * rather than its own form state, since the two can differ only if somebody
     * has made this read the wrong thing.
     */
    const source = code("campaigns/campaign-wizard-dialog.tsx")

    expect(source).toMatch(/countMatchingSubscribers/)
    expect(source).toMatch(/rules:\s*selectedSegment\.rules/)
    expect(source).toMatch(/ruleOperator:\s*selectedSegment\.ruleOperator/)
  })
})

describe("the stored subscriberCount", () => {
  /*
   * Source-level, because what matters is that NO screen presents it — and a
   * render test can only speak for the screens it mounts. The field itself stays
   * in the schema: `create` and `duplicate` must write something, and removing
   * it is a migration for a value nothing reads.
   */
  const SCREENS = [
    "campaigns/campaign-wizard-dialog.tsx",
    "segments/email-segments-page.tsx",
  ]

  it("has screens to read", () => {
    for (const screen of SCREENS) expect(code(screen).length).toBeGreaterThan(500)
  })

  /**
   * A READ OF THE STORED FIELD, not the word.
   *
   * `campaign-wizard-dialog.tsx` holds a local called `subscriberCount` for the
   * LIVE `emailSubscribers.countByStatus` answer — a different number from a
   * different query — so a name match flags the thing that replaced the defect.
   * The stored field is only ever reached as a property: `segment.subscriberCount`,
   * `s.subscriberCount`, `selectedSegment?.subscriberCount`.
   */
  const STORED_FIELD_READ = /\.\s*subscriberCount\b/

  it("catches a read of the stored field, and not the live count beside it", () => {
    // Anti-vacuity for the regex, both directions.
    expect(STORED_FIELD_READ.test("selectedSegment?.subscriberCount ?? 0")).toBe(true)
    expect(STORED_FIELD_READ.test("{s.subscriberCount} abonnés")).toBe(true)
    expect(STORED_FIELD_READ.test("const subscriberCount = subscriberCounts?.active")).toBe(false)
    expect(STORED_FIELD_READ.test("subscriberCounts?.truncated")).toBe(false)
  })

  it("is presented by no screen", () => {
    const offenders = SCREENS.filter((screen) => STORED_FIELD_READ.test(code(screen)))

    expect(
      offenders,
      "this screen shows a stored count that only ever holds 0"
    ).toEqual([])
  })

  it("is written by create and duplicate, and by nothing else", () => {
    /*
     * `refreshCount` was the only writer of a real figure and no app wrapped it.
     * It is gone: counting live is the answer, and a function that exists to
     * maintain a cache nobody reads is a maintenance burden pretending to be a
     * feature.
     */
    const source = readFileSync(
      join(HERE, "../../../convex-functions/src/emailSegments.ts"),
      "utf8"
    )
    expect(source).not.toMatch(/export const refreshCount/)
  })
})
