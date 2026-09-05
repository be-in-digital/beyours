/**
 * The link behind « Réserver une table ».
 *
 * The product has no reservation feature, so an establishment that takes
 * bookings points the storefront at the tool it already uses — TheFork,
 * Zenchef, Guestonline — and that tool owns availability, confirmations,
 * reminders and no-shows. Unset means no reservation call to action is
 * rendered at all.
 *
 * Shared by three callers that must agree: the admin form (via
 * `createStoreSchema`), the mutation that writes it (`assertReservationUrl`),
 * and the storefront that renders it (`isSafeReservationUrl`). The last one
 * matters even though the first two guard the write: a row predating this
 * validation, or one restored from a backup, still reaches an href.
 *
 * https only, deliberately. `javascript:` and `data:` are both well-formed
 * URLs and both are stored XSS the moment an owner-supplied string lands in an
 * `href`; plain http would send a guest's booking over the wire in clear.
 */

const ALLOWED_PROTOCOL = "https:"

/** True when this value is safe to put in an href. Never throws. */
export function isSafeReservationUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false
  try {
    return new URL(value).protocol === ALLOWED_PROTOCOL
  } catch {
    return false
  }
}

/**
 * Write-side guard. Accepts `undefined` (clearing the link is legitimate) and
 * refuses anything else that would not be safe to render.
 */
export function assertReservationUrl(value: string | undefined): void {
  if (value === undefined) return
  if (!isSafeReservationUrl(value)) {
    throw new Error(
      "Lien de réservation invalide : indiquez une adresse complète commençant par https://, " +
        "par exemple https://www.thefork.fr/restaurant/votre-etablissement.",
    )
  }
}
