import { describe, expect, it } from "vitest"
import { systemAuditLogTable } from "@be-in-digital/convex-schema"
import {
  AUDIT_ACTION_LABELS,
  formatActionLabel,
  formatAuditDetails,
} from "../helpers"

/** The `action` literals the schema actually allows. */
function schemaActions(): string[] {
  // Reaching into the validator is the point: the test has to read the schema
  // itself, not a copy of it, or it proves nothing.
  const validator = (systemAuditLogTable as any).validator
  return validator.fields.action.members.map((member: any) => member.value)
}

describe("audit action labels", () => {
  it("covers every action the schema can store", () => {
    const missing = schemaActions().filter((action) => !(action in AUDIT_ACTION_LABELS))
    expect(missing).toEqual([])
  })

  it("carries no label for an action the schema no longer allows", () => {
    const allowed = new Set(schemaActions())
    const stale = Object.keys(AUDIT_ACTION_LABELS).filter((a) => !allowed.has(a))
    expect(stale).toEqual([])
  })

  it("labels the three establishment actions", () => {
    expect(formatActionLabel("store_created")).toBe("Établissement créé")
    expect(formatActionLabel("store_updated")).toBe("Établissement modifié")
    expect(formatActionLabel("store_deleted")).toBe("Établissement supprimé")
  })

  it("falls back to the raw action rather than rendering nothing", () => {
    expect(formatActionLabel("something_new")).toBe("something_new")
  })
})

describe("formatAuditDetails", () => {
  it("reads an establishment edit as one line", () => {
    expect(
      formatAuditDetails({
        details: JSON.stringify({
          operation: "updateAddress",
          storeName: "Pizzeria Roma",
          changes: { address: { before: {}, after: {} } },
        }),
      })
    ).toBe("Pizzeria Roma · updateAddress · address")
  })

  it("says so when an edit moved nothing", () => {
    expect(
      formatAuditDetails({
        details: JSON.stringify({
          operation: "update",
          storeName: "Pizzeria Roma",
          changes: {},
        }),
      })
    ).toBe("Pizzeria Roma · update · aucun changement")
  })

  it("reads a creation, which carries a snapshot and no change list", () => {
    expect(
      formatAuditDetails({
        details: JSON.stringify({
          operation: "create",
          storeName: "Pizzeria Roma",
          snapshot: { name: "Pizzeria Roma" },
        }),
      })
    ).toBe("Pizzeria Roma · create")
  })

  it("reads the degraded form written when a payload was too large", () => {
    expect(
      formatAuditDetails({
        details: JSON.stringify({
          operation: "updateHours",
          storeName: "Pizzeria Roma",
          changedFields: ["hours"],
          truncated: true,
        }),
      })
    ).toBe("Pizzeria Roma · updateHours · hours")
  })

  it("leaves a system entry's payload exactly as it was stored", () => {
    const details = JSON.stringify({ targetProvider: "vercel", scope: ["code"] })
    expect(formatAuditDetails({ details })).toBe(details)
  })

  it("does not choke on a payload that is not JSON", () => {
    expect(formatAuditDetails({ details: "migration 003 applied" })).toBe(
      "migration 003 applied"
    )
  })

  it("shows the error over the details when the operation failed", () => {
    expect(
      formatAuditDetails({ details: '{"operation":"create"}', errorMessage: "boom" })
    ).toBe("boom")
  })

  it("renders an em dash for an entry with no details at all", () => {
    expect(formatAuditDetails({})).toBe("—")
  })
})
