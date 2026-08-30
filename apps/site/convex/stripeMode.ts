/**
 * May this deployment run a money path without Stripe?
 *
 * `getStripe()` returning `null` used to answer two questions at once: "a
 * developer has no key" and "production lost its key". Every money path assumed
 * the first. So a key forgotten, cleared during the test→live swap or mistyped
 * on the production deployment did not stop a sale — it completed it for free:
 * the order reached `paid`, a founders seat was consumed, the confirmation
 * email went out and the ops console reported revenue, with no money taken.
 * Nothing downstream could tell the difference, `getCheckoutAccess` included —
 * it only asks whether `status === "paid"`.
 *
 * The absent key is now the failure it always was, and the fake path has to be
 * asked for by name. `BEYOURS_TEST_CHECKOUT="true"` is a deliberate act on a
 * deployment; forgetting a key is not.
 *
 * Kept apart from the two `"use node"` modules that call it, and free of the
 * Stripe SDK, so the decision can be read and tested on its own — it is the
 * part that can be wrong.
 */

/** How a money path may proceed. */
export type StripeAccess =
  /* A key is configured: real money moves. */
  | { mode: "live"; secretKey: string }
  /* No key, and this deployment has said so on purpose. Nothing is charged. */
  | { mode: "test" };

/** Thrown when Stripe is simply unconfigured — never for a deliberate test run. */
export class StripeNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeNotConfiguredError";
  }
}

/** The env var that turns the no-payment path on, and the only thing that does. */
export const TEST_CHECKOUT_ENV = "BEYOURS_TEST_CHECKOUT";

/**
 * Resolve how `operation` may proceed, or refuse it.
 *
 * `operation` is quoted back in the error after a colon, so pass the thing that
 * will not happen ("ouvrir une session de paiement") rather than the function's
 * name. It sits on its own there, so no elision to get wrong.
 *
 * Only the exact string `"true"` enables the test path. A typo — `1`, `yes`,
 * `TRUE` — refuses, which is the safe direction: the failure mode of a
 * mistyped flag is a checkout that stops, not one that gives the product away.
 */
export function resolveStripeAccess(
  operation: string,
  env: Record<string, string | undefined> = process.env,
): StripeAccess {
  const secretKey = env.STRIPE_SECRET_KEY;
  if (secretKey) return { mode: "live", secretKey };

  if (env[TEST_CHECKOUT_ENV] === "true") return { mode: "test" };

  throw new StripeNotConfiguredError(
    `STRIPE_SECRET_KEY absente de ce déploiement — opération refusée : ${operation}. ` +
      `Poser la clé Stripe sur l'env Convex, ou ${TEST_CHECKOUT_ENV}="true" pour ` +
      `activer volontairement le parcours sans paiement. Sans clé, la commande ` +
      `passerait à « payée » et le produit partirait gratuitement.`,
  );
}
