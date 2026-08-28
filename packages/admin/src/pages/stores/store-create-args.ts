import type { AddressValue } from "@be-in-digital/ui"
import { slugify } from "../../lib/formatters"

/**
 * The arguments `stores.create` is called with, built in one place.
 *
 * WHY THIS EXISTS: the create dialog used to assemble this payload inline and
 * added a `settings` object — currency, timezone, service toggles, fees, a tax
 * rate — that the mutation does not declare. Convex refuses an undeclared
 * argument rather than ignoring it, so every creation threw and the dialog
 * showed nothing but "Échec de la création de l'établissement" (#125). No
 * establishment could be opened from the dashboard at all.
 *
 * A payload written inside a React handler is invisible to the test suite: the
 * unit tests call handlers directly, past the validator, and see nothing. Built
 * here, it is a plain value that `store-create-args.test.ts` compares field for
 * field against the validator itself.
 *
 * Adding a field means declaring it in `stores.create` first.
 */

export interface StoreCreateFormValues {
  name: string
  description: string
  address: AddressValue
  phone: string
  email: string
}

export interface StoreCreateArgs {
  name: string
  slug: string
  description: string | undefined
  address: {
    street: string
    city: string
    postalCode: string
    country: string
    latitude: number | undefined
    longitude: number | undefined
  }
  phone: string | undefined
  email: string | undefined
}

/**
 * Empty optional fields become `undefined`, not `""` — an establishment with
 * no phone number has no phone number, rather than an empty one.
 */
export function buildStoreCreateArgs(
  values: StoreCreateFormValues
): StoreCreateArgs {
  return {
    name: values.name,
    slug: slugify(values.name),
    description: values.description || undefined,
    address: {
      street: values.address.street,
      city: values.address.city,
      postalCode: values.address.postalCode,
      country: values.address.country,
      latitude: values.address.latitude,
      longitude: values.address.longitude,
    },
    phone: values.phone || undefined,
    email: values.email || undefined,
  }
}
