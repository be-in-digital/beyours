/**
 * A refusal the person on the other end can act on.
 *
 * WHY THIS EXISTS: Convex redacts a thrown `Error` in production. The browser
 * receives "Server Error" and nothing else; only a `ConvexError` carries its
 * `data` across the wire. `auth.ts` learned that for the authorisation path and
 * gave it `denied()`. The customer checkout path never got the same treatment,
 * so eight carefully written French sentences — « Pizza » est épuisé, « Pizza »
 * exige un choix : Taille, the minimum order, the delivery radius — all arrived
 * at the moment of payment as two English words. The diner was blocked with no
 * reason and no action, and abandoned. It made the entire server-side
 * validation effort invisible.
 *
 * The order path does not throw bare errors, which is why the fix is small:
 * each stage already has a class carrying a machine-readable reason —
 * `LineRejectedError`, `OrderZoneRejectedError`, `QuoteRejectedError`,
 * `PromotionRejectedError`, `RateLimitedError`. They are caught by `instanceof`
 * in production code and in tests, so they are kept, and this is what they now
 * extend.
 *
 * Two things it guarantees:
 *
 * - `data` is the flat `{ code, message, ... }` shape `auth.ts` established and
 *   `lib/convex-error.ts` reads in both apps. `code` is the class's own reason
 *   union, so a screen can switch on it; `message` is the French sentence,
 *   shown as-is by a screen that has no copy of its own.
 * - `message` stays that sentence. `ConvexError` sets `message` to the JSON of
 *   `data`, which would turn every `error.message` the storefront already
 *   renders — and every `toThrow(/épuisé/)` in the suite — into a serialized
 *   object. Restoring it costs one assignment and keeps the class readable
 *   everywhere it was already read.
 */

import { ConvexError } from "convex/values"

/**
 * The flat payload a refusal crosses the wire as.
 *
 * Extra keys are machine-readable specifics for a screen or a log — a quantity,
 * a limit, a retry time. They are deliberately not sentence material: the
 * sentence is `message`.
 */
export type RefusalPayload<Code extends string = string> = {
  code: Code
  message: string
} & Record<string, string | number>

/**
 * The base every checkout refusal extends.
 *
 * `name` is passed in rather than derived: minified builds rename classes, and
 * the name is what a log reads.
 */
export class RefusalError<Code extends string = string> extends ConvexError<
  RefusalPayload<Code>
> {
  constructor(
    name: string,
    code: Code,
    message: string,
    details?: Record<string, string | number>
  ) {
    super({ code, message, ...(details ?? {}) })
    this.name = name
    // `ConvexError` has just overwritten `message` with the JSON of `data`.
    this.message = message
  }
}

/**
 * The deployment cannot take a card at all — no Stripe key, SumUp not
 * connected, or a connection state the charge path refuses to honour.
 *
 * Thrown only by the diner-facing "start a card payment" actions in both apps'
 * `convex/stripe.ts` and `convex/sumup.ts`. Their configuration throws were
 * plain `Error`s, which production redacts to "Server Error", so a diner on a
 * fresh deployment — where card was the pre-selected tile — read the generic
 * « Erreur lors de la commande. Veuillez réessayer. » and retried a payment
 * that could never work (#374). The staff-facing paths (verify, refund,
 * reconcile) keep their plain errors: their reader is a log, not a diner.
 */
export class CardPaymentUnavailableError extends RefusalError<"card_payment_unavailable"> {
  constructor() {
    super(
      "CardPaymentUnavailableError",
      "card_payment_unavailable",
      "Le paiement par carte est indisponible pour le moment. Choisissez un autre moyen de paiement."
    )
  }
}
