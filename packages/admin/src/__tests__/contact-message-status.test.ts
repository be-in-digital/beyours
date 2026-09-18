import { describe, expect, test } from "vitest"
import { statusOnOpening } from "../pages/messages/message-status"

/**
 * What opening a contact message does to it.
 *
 * The two halves of the screen are guarded differently: `contactMessages.list`
 * asks for `customers:read`, `updateStatus` for `customers:write`. A manager
 * and a waiter hold the first and not the second (`ROLE_PERMISSIONS` in
 * `@be-yours/core`), so a screen that marks every opened message read
 * would throw for both of them on every click and archive for neither.
 *
 * The rule is here, out of the component, because that is where it can be
 * asserted: the package renders nothing under test.
 */
describe("opening a contact message", () => {
  test("marks a new message read", () => {
    expect(statusOnOpening({ status: "new" }, { canWrite: true })).toBe("read")
  })

  test("leaves a message that has already been read alone", () => {
    expect(statusOnOpening({ status: "read" }, { canWrite: true })).toBeNull()
  })

  test("does not re-open an archived message by reading it", () => {
    expect(statusOnOpening({ status: "archived" }, { canWrite: true })).toBeNull()
  })

  test("changes nothing for a reader who may not write", () => {
    expect(statusOnOpening({ status: "new" }, { canWrite: false })).toBeNull()
  })
})
