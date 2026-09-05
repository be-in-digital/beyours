import { describe, expect, it } from "vitest"
import { ConvexError } from "convex/values"
import { convexErrorMessage, convexErrorPayload } from "../lib/convex-error"

/**
 * A refusal the owner cannot read is a dead end (#169-adjacent, NEW-Q).
 *
 * `products.remove` refuses while a formule, a promotion or a game prize still
 * points at the dish, and the sentence naming them is the entire value of
 * refusing. Convex redacts a plainly thrown `Error` in production, so that
 * sentence travels in `ConvexError.data` — and the admin screen has to be able
 * to get it back out. It arrives as an object from the browser client and as a
 * JSON string from `convex-test`; a reader that handles only one of those looks
 * correct on whichever side was exercised.
 */
describe("convexErrorPayload", () => {
  it("reads a payload the browser client hands back as an object", () => {
    const error = new ConvexError({ code: "product_in_menu", message: "Formule Midi" })
    expect(convexErrorPayload(error)).toEqual({
      code: "product_in_menu",
      message: "Formule Midi",
    })
  })

  it("reads a payload convex-test hands back as a JSON string", () => {
    const error = { data: JSON.stringify({ code: "product_in_prize", message: "Lot" }) }
    expect(convexErrorPayload(error)).toEqual({ code: "product_in_prize", message: "Lot" })
  })

  it("returns null for anything that is not a ConvexError", () => {
    expect(convexErrorPayload(new Error("Server Error"))).toBeNull()
    expect(convexErrorPayload(null)).toBeNull()
    expect(convexErrorPayload(undefined)).toBeNull()
    expect(convexErrorPayload({ data: "not json" })).toBeNull()
    expect(convexErrorPayload({ data: { message: "no code" } })).toBeNull()
  })
})

describe("convexErrorMessage", () => {
  it("shows the server's own sentence", () => {
    const error = new ConvexError({
      code: "product_in_menu",
      message: 'Ce produit est utilisé dans 1 formule : "Formule Midi".',
    })
    expect(convexErrorMessage(error, "Échec")).toBe(
      'Ce produit est utilisé dans 1 formule : "Formule Midi".'
    )
  })

  it("falls back when the message was redacted away", () => {
    // A plain `Error` from the backend reaches production as "Server Error";
    // there is nothing left to show, so the screen's own copy is all there is.
    expect(convexErrorMessage(new Error("Server Error"), "Échec")).toBe("Échec")
  })

  it("falls back when a ConvexError carries a code but no message", () => {
    expect(convexErrorMessage(new ConvexError({ code: "product_in_menu" }), "Échec")).toBe(
      "Échec"
    )
  })
})
