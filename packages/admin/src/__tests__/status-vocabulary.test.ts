import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

import {
  ORDER_STATUS_CONFIG,
  ORDER_PAYMENT_STATUS_CONFIG,
  ORDER_TYPE_LABELS,
  STORE_STATUS_CONFIG,
} from "../lib/vocabulary"

/**
 * The French an operator reads is written once.
 *
 * `lib/vocabulary.ts` exists because every screen used to declare its own
 * status map and they drifted: two `statusConfig` twins for orders, and a
 * StoreStatus map missing "draft" that shipped a raw English status into the
 * interface. Its header then claimed "label drift is now impossible" — a
 * property with nothing enforcing it, and one that was already false:
 * `pages/dashboard/recent-orders-table.tsx` carried eleven duplicated strings
 * the whole time. They agreed, so nothing broke; a copy that agrees today is
 * precisely the one that drifts on the next status added.
 *
 * A claim about a property is worth what enforces it, so this enforces it.
 */

const SRC = path.join(__dirname, "..")
const VOCABULARY = path.join(SRC, "lib/vocabulary.ts")

/** Every `.ts`/`.tsx` under `src/`, except this file and vocabulary itself. */
function sourceFiles(): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.tsx?$/.test(entry.name)) continue
      if (full === VOCABULARY) continue
      found.push(full)
    }
  }
  walk(SRC)
  return found
}

/**
 * The operator-facing strings this module owns, as a flat set.
 *
 * Only the labels. A className is not a label — a page may legitimately keep a
 * dot colour or a layout class keyed by status, and refusing those would be a
 * rule about styling rather than about vocabulary.
 */
const OWNED_LABELS = new Set(
  [
    ...Object.values(ORDER_STATUS_CONFIG).map((badge) => badge.label),
    ...Object.values(ORDER_PAYMENT_STATUS_CONFIG).map((badge) => badge.label),
    ...Object.values(ORDER_TYPE_LABELS),
    ...Object.values(STORE_STATUS_CONFIG).map((badge) => badge.label),
  ].filter(Boolean),
)

/**
 * How many of this module's labels a file writes as its own string literal.
 *
 * One is a coincidence — "En attente" is ordinary French and a screen may say
 * it about something that is not an order status. A file spelling out four or
 * more of them has rebuilt a status map, which is the defect.
 */
function duplicatedLabels(source: string): string[] {
  return [...OWNED_LABELS].filter((label) => source.includes(`"${label}"`))
}

describe("status labels live in lib/vocabulary.ts", () => {
  const files = sourceFiles()

  it("read the package it is about", () => {
    // Guards the guard: an empty file list would pass every assertion below.
    expect(files.length).toBeGreaterThan(50)
    expect(OWNED_LABELS.size).toBeGreaterThan(10)
  })

  it("no screen rebuilds a status map of its own", () => {
    const REBUILT_AT = 4
    const offenders = files
      .map((file) => ({
        file: path.relative(SRC, file),
        labels: duplicatedLabels(fs.readFileSync(file, "utf8")),
      }))
      .filter(({ labels }) => labels.length >= REBUILT_AT)
      .map(({ file, labels }) => `${file} (${labels.length}: ${labels.join(", ")})`)

    expect(offenders).toEqual([])
  })

  it("the dashboard's recent-orders table reads from here", () => {
    // The specific file the header's claim was false about.
    const source = fs.readFileSync(
      path.join(SRC, "pages/dashboard/recent-orders-table.tsx"),
      "utf8",
    )
    expect(source).toContain('from "../../lib/vocabulary"')
    expect(source).toContain("ORDER_STATUS_CONFIG[order.status].label")
    expect(source).toContain("ORDER_TYPE_LABELS[order.type]")
    // And keeps its dot colour, which is not a label.
    expect(source).toContain("statusColors")
  })
})
