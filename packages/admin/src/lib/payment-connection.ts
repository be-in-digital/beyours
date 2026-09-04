/**
 * Which buttons the settings screen offers for a payment provider connection.
 *
 * WHY THIS EXISTS: the two provider cards each tested `status === "connected"`
 * inline to decide whether to show "Déconnecter". The day the Stripe callback
 * stopped writing `connected` — because onboarding finishing does not mean the
 * restaurant is being paid — that inline test silently stranded the row: a real
 * Stripe connected account, recorded with its account id, and no way to clear
 * it from the admin. The `paymentConnections.disconnect` mutation was fine the
 * whole time; it was simply unreachable.
 *
 * The rule below is written once so the two cards cannot drift again, and so it
 * can be asserted without rendering (this package has no jsdom).
 */

import type { PaymentConnectionStatus } from "./types"

/** The fields the decision needs — structurally satisfied by `PaymentConnection`. */
export interface ProviderConnection {
  status: PaymentConnectionStatus
  merchantId: string
}

/**
 * Whether the admin should offer to disconnect.
 *
 * Every status, deliberately — the row itself is what "Déconnecter" removes
 * (`disconnect` deletes it), and a row exists only when a provider account was
 * recorded against this restaurant. That is as true of `onboarding_complete`
 * and `error`, which both keep a real merchant id, as it is of `connected`:
 *
 * - `onboarding_complete` — a live Stripe connected account nobody is charging
 *   through. The owner must be able to sever it and pick another provider.
 * - `error` — onboarding never enabled charges, and the stored account id still
 *   points at a half-finished Stripe account. Leaving it in place blocks a
 *   clean retry under a different account.
 * - `disconnected` — written by the interim Stripe callback before this state
 *   had a name, so deployed rows carry it. Those are the stranded ones.
 *
 * Gating on status again would just be the same bug with a longer list.
 */
export function canDisconnectProvider(
  connection: ProviderConnection | undefined | null
): boolean {
  return connection != null
}

/**
 * Whether the admin should offer to (re)connect.
 *
 * Hidden for `connected` and for `onboarding_complete`: in both, the provider
 * side is finished and re-running onboarding changes nothing. What blocks
 * `onboarding_complete` is our charge routing, not the owner.
 */
export function canConnectProvider(
  connection: ProviderConnection | undefined | null
): boolean {
  if (connection == null) return true
  return connection.status === "disconnected" || connection.status === "error"
}
