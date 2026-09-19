import { describe, it, expect } from "vitest"
import { create } from "@be-yours/convex-functions/stores"
import {
  buildStoreCreateArgs,
  type StoreCreateFormValues,
} from "../pages/stores/store-create-args"

/**
 * The create dialog's payload against `stores.create`'s validator (#125).
 *
 * Convex refuses a field the mutation does not declare. The dialog sent one —
 * a `settings` object — so creating an establishment threw every single time,
 * on a product billed per store. No unit test saw it: they call handlers
 * directly, past the validator.
 *
 * This is the comparison nobody was making. It reads the argument names off
 * the validator itself, so it cannot drift from what the server accepts.
 */

const FORM: StoreCreateFormValues = {
  name: "Pizzeria Napoli",
  description: "Napolitaine au feu de bois",
  address: {
    street: "12 rue Oberkampf",
    city: "Paris",
    postalCode: "75011",
    country: "France",
  },
  phone: "+33145678901",
  email: "napoli@example.com",
}

/** The fields `stores.create` declares, read from the validator. */
const DECLARED = Object.keys(create.args)

/** The fields the declared `address` object accepts. */
const DECLARED_ADDRESS = Object.keys(
  (create.args.address as unknown as { fields: Record<string, unknown> }).fields
)

describe("buildStoreCreateArgs", () => {
  it("sends no field the mutation does not declare", () => {
    // The regression itself: `settings` was here, and is not in `DECLARED`.
    const sent = Object.keys(buildStoreCreateArgs(FORM))
    expect(sent.filter((key) => !DECLARED.includes(key))).toEqual([])
  })

  it("sends no address field the mutation does not declare", () => {
    const sent = Object.keys(buildStoreCreateArgs(FORM).address)
    expect(sent.filter((key) => !DECLARED_ADDRESS.includes(key))).toEqual([])
  })

  it("carries what the owner typed", () => {
    const args = buildStoreCreateArgs(FORM)
    expect(args.name).toBe("Pizzeria Napoli")
    expect(args.address.street).toBe("12 rue Oberkampf")
    expect(args.phone).toBe("+33145678901")
    expect(args.email).toBe("napoli@example.com")
  })

  it("derives the slug from the name", () => {
    expect(buildStoreCreateArgs({ ...FORM, name: "Chez Marie & Fils" }).slug).toBe(
      "chez-marie-fils"
    )
  })

  it("leaves an empty optional field undefined rather than empty", () => {
    // An establishment with no phone number has none — `""` would be stored as
    // a phone number that is not one.
    const args = buildStoreCreateArgs({
      ...FORM,
      description: "",
      phone: "",
      email: "",
    })
    expect(args.description).toBeUndefined()
    expect(args.phone).toBeUndefined()
    expect(args.email).toBeUndefined()
  })

  it("passes the coordinates through when the autocomplete resolved them", () => {
    const args = buildStoreCreateArgs({
      ...FORM,
      address: { ...FORM.address, latitude: 48.8649, longitude: 2.3705 },
    })
    expect(args.address.latitude).toBe(48.8649)
    expect(args.address.longitude).toBe(2.3705)
  })
})
