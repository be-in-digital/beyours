/**
 * Where a Stripe charge is allowed to go.
 *
 * WHY THIS EXISTS: `convex/stripe.ts` builds its client from the PLATFORM
 * secret key and sends no `stripeAccount`, no `on_behalf_of` and no
 * `transfer_data`. Every euro a customer pays by card therefore lands in the
 * platform balance, whatever `paymentConnections` says. For a while the connect
 * flow wrote `status: "connected"` the moment Stripe reported `charges_enabled`,
 * so the admin showed a green "Connecté" to an owner whose takings were going
 * somewhere else entirely. The connect flow was corrected to write
 * `onboarding_complete` — the honest literal — and the admin now says where the
 * money goes.
 *
 * Nothing, though, stopped the next person from writing `"connected"` again.
 * The charge path never read the row at all, so the deception could come back
 * with no test going red anywhere. This module is that missing reader.
 *
 * THE RULE, and the trap next to it:
 *
 *   `connected`                 → REFUSE. That literal means "charges are
 *                                 routed to the connected account", which this
 *                                 codebase cannot do. It is unreachable today
 *                                 — nothing writes it for Stripe — so refusing
 *                                 costs nothing now and makes reintroducing the
 *                                 lie impossible to do quietly.
 *
 *   `onboarding_complete`       → PROCEED on the platform key, exactly as
 *   `disconnected` / `error`      before. The tempting rule is "refuse whenever
 *   no row at all                 a Stripe connection exists"; that would be a
 *                                 severe regression — finishing Connect
 *                                 onboarding would break card payments outright
 *                                 for that restaurant, and the admin already
 *                                 tells the owner the truth in that state.
 *
 * This is deliberately only half of Stripe Connect. Actually routing the charge
 * — `stripeAccount` for direct charges, or `transfer_data` / `on_behalf_of` for
 * destination charges — needs two product decisions and a live Connect account,
 * and is written up in `tasks/stripe-connect-runbook.md`. When that lands,
 * `connected` becomes legal, this function grows a second mode, and the call
 * sites switch on it instead of assuming the platform.
 *
 * Pure on purpose: `convex/stripe.ts` is `"use node"` and dynamically imports
 * the Stripe SDK, so the decision has to live somewhere a unit test can reach.
 * Same reasoning as `paymentSettlement.ts`, and a separate module because it
 * answers a different question at a different moment — that one asks "does this
 * payment settle this order" after the fact, this one asks "may this charge run
 * at all" before anything is sent.
 */

/** Which Stripe account a charge is created on. */
export type StripeChargeMode = "platform"

/** The answer: where the money about to move is going. */
export interface StripeChargeRoute {
  mode: StripeChargeMode
}

/**
 * The `paymentConnections` row for provider `stripe`, as a money path sees it.
 *
 * Structural rather than the generated `Doc<"paymentConnections">`, so this
 * package stays free of the app's generated types and the function can be
 * called with a plain object from a test.
 */
export interface StripeConnectionState {
  /** A member of the `paymentConnections.status` union. */
  status: string
  /** `acct_…`, named in the refusal so an operator can find the account. */
  merchantId?: string | null
}

export type StripeChargeRefusalReason = "connected_without_routing"

/** Thrown when the recorded connection state and the charge path disagree. */
export class StripeChargeRouteError extends Error {
  readonly reason: StripeChargeRefusalReason
  readonly merchantId?: string

  constructor(
    reason: StripeChargeRefusalReason,
    message: string,
    merchantId?: string
  ) {
    super(message)
    this.name = "StripeChargeRouteError"
    this.reason = reason
    this.merchantId = merchantId
  }
}

/**
 * The status that promises something this codebase cannot deliver.
 *
 * Not a general "is the provider usable" check — SumUp's `connected` is
 * correct, because the SumUp token really does charge the merchant's account.
 * This is specifically about Stripe, where `connected` and the charge path
 * contradict each other.
 */
const ROUTING_CLAIMED = "connected"

/**
 * Decide where a Stripe charge goes, or refuse.
 *
 * Throws `StripeChargeRouteError` when the stored connection claims charges are
 * routed to the restaurant's own account. Returns `{ mode: "platform" }` for
 * every other state, including no connection at all — which is what the caller
 * was already doing, unchanged.
 *
 * Call it from EVERY Stripe money path, not just checkout. A refund that
 * ignored the rule while checkout honoured it would leave the two halves of the
 * same charge disagreeing about which account they belong to.
 */
export function resolveStripeCharge(
  connection: StripeConnectionState | null | undefined
): StripeChargeRoute {
  if (connection && connection.status === ROUTING_CLAIMED) {
    const account = connection.merchantId ? ` (compte ${connection.merchantId})` : ""

    throw new StripeChargeRouteError(
      "connected_without_routing",
      `Stripe est enregistré comme « connecté »${account}, mais les encaissements ` +
        `partent toujours sur la clé de la plateforme : l'argent n'arriverait pas ` +
        `sur le compte du restaurant. Aucun paiement par carte n'est traité tant ` +
        `que les deux ne disent pas la même chose. Soit le routage vers le compte ` +
        `connecté est réellement en place — voir tasks/stripe-connect-runbook.md — ` +
        `soit la connexion doit revenir à « onboarding_complete ».`,
      connection.merchantId ?? undefined
    )
  }

  return { mode: "platform" }
}
