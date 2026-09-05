/**
 * The personal-data policy, as pure decisions.
 *
 * WHAT LIVES HERE: constants and functions that decide *what should happen* to
 * a diner's data, with no database and no Convex context. `privacy.ts` is the
 * half that touches rows; this half is the half a test can pin down without a
 * harness, and the half `gamePlay.ts` can read without importing an erasure
 * engine into the game.
 *
 * WHY THE NUMBERS ARE HERE AND NOT INLINE: a retention window is a legal
 * position, not an implementation detail. It is quoted in the consent notice a
 * diner reads, in the runbook an operator follows, and in the sweep that
 * enforces it, and those three have to be the same number.
 */

/**
 * How long a restaurant keeps a diner's personal data, by default.
 *
 * Three years from last contact. That is the CNIL's guidance for the customer
 * and prospect data of a business selling to consumers, and it is the same
 * period the commercial site already publishes at /confidentialite §6 and
 * enforces in `apps/site/convex/retention.ts`. Using a different number in the
 * engine would mean the group answers one way about its own prospects and
 * another about its clients' diners.
 *
 * IT IS A DEFAULT, NOT A RULING. `globalSettings.dataRetention.customerDataDays`
 * overrides it, and the restaurant — not this file — is the data controller
 * that has to stand behind whatever number is set. See
 * `tasks/gdpr-diner-data-runbook.md`.
 */
export const DEFAULT_CUSTOMER_RETENTION_DAYS = 3 * 365

/** One day, in milliseconds. */
export const DAY_MS = 24 * 60 * 60 * 1000

/**
 * What replaces a diner's name on a record kept for the books.
 *
 * A constant rather than something order-scoped, and that is the whole point:
 * two anonymised orders must be indistinguishable as to who placed them. A
 * per-order token ("Client 4f2a") would be a pseudonym — still personal data
 * under art. 4.5, still re-identifiable by whoever holds the mapping — and
 * would leave the establishment believing it had erased something it had not.
 *
 * French, because it is read by a French restaurateur in their own order list.
 */
export const ANONYMISED_CUSTOMER_NAME = "Client anonymisé"

/**
 * Addresses compare folded and trimmed, wherever they were written.
 *
 * The storefront stores what the diner typed; `orders.create` lower-cases the
 * copy it writes into `promotionUsages` and nothing else folds anything. So
 * « Marie.Dupont@Example.FR » and « marie.dupont@example.fr » are one person
 * in two spellings, and an index seek on either spelling misses the other —
 * which is how an erasure reports success on a row it never saw. Everything
 * here compares folded, and pays for a scan to do it.
 */
export function foldEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Whether two addresses name the same person, however either was typed. */
export function sameEmail(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return foldEmail(a) === foldEmail(b)
}

/**
 * The retention window in force for this deployment, in milliseconds.
 *
 * An absent setting means the default, NOT "no retention": a client who never
 * opens the screen still gets the three years, because keeping a diner's
 * address for ever is the unlawful state. A window of zero or less is treated
 * as unset for the same reason — a misconfiguration must not turn into
 * "delete everything tonight".
 */
export function retentionWindowMs(settings: {
  dataRetention?: { customerDataDays?: number } | null
} | null | undefined): number {
  const days = settings?.dataRetention?.customerDataDays
  const effective = typeof days === "number" && days > 0 ? days : DEFAULT_CUSTOMER_RETENTION_DAYS
  return effective * DAY_MS
}

/**
 * Whether the sweep is allowed to write.
 *
 * Absent means armed. Only an explicit `enabled: false` pauses it, so a client
 * whose settings row predates this feature is protected by the default rather
 * than exempted from it.
 */
export function retentionIsArmed(settings: {
  dataRetention?: { enabled?: boolean } | null
} | null | undefined): boolean {
  return settings?.dataRetention?.enabled !== false
}
