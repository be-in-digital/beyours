/**
 * Where this site lives, decided by the server (#527).
 *
 * WHY IT IS NOT AN ARGUMENT. `stripe.createCheckoutSession` is a PUBLIC,
 * unauthenticated action — the deployment URL ships in the browser bundle, so
 * every argument it takes is attacker-chosen. It took `successUrl` and
 * `cancelUrl` and handed them to Stripe verbatim, so a genuine BeYours Checkout
 * session, with the real company name and the real card form, could be made to
 * land on any domain after payment. A buyer who paid would then be on a page
 * somebody else controlled, having just typed their card details on a page
 * they had every reason to trust.
 *
 * The origin is not information the caller has and the server lacks. It is the
 * server's own address.
 *
 * WHY IT LIVES HERE RATHER THAN IN EACH CALLER. `email/send.ts` already had this
 * resolver, and a second copy is how two answers to one question start to
 * differ — the class of defect this batch of issues is mostly about. One
 * definition, both callers.
 */

/**
 * The public marketing site's origin, without a trailing slash.
 *
 * `SITE_URL` first, `NEXT_PUBLIC_SITE_URL` second, then the production domain.
 * The literal fallback is deliberate and was already the behaviour: a
 * misconfigured deployment sends a buyer to the real site rather than to
 * `undefined/checkout/success`.
 */
export function siteOrigin(): string {
  return (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://beyours.fr"
  ).replace(/\/$/, "");
}
