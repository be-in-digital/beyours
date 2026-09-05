import { COMPANY, LATE_PAYMENT, VAT } from "../lib/legal/company";

/* ── Legal mentions carried by every invoice ──
   French law lists what an invoice must state (art. L441-9 of the commercial
   code, art. 242 nonies A of annex II to the tax code). Stripe supplies the
   date, the number, the lines, the totals and the buyer; everything about the
   SELLER has to be handed to it.

   Built from lib/legal/company.ts, which is the single source of truth for the
   company's identity and says so: « never hard-code a duplicate elsewhere ».
   convex/stripe.ts used to hold its own copy, pointing at a file path that no
   longer exists — a wrong SIRET on an invoice is a real problem, and two
   copies is how one gets there.

   Bundling: Convex builds convex/ with esbuild, which follows this relative
   import out of the directory. company.ts imports nothing, so nothing else
   comes with it. */

/* Grouped by hand rather than through toLocaleString("fr-FR"): the Convex
   runtime is not guaranteed to carry French locale data, and a capital
   rendered « 1,000 € » on an invoice reads as a thousandth of the amount. */
function formatCapital(): string {
  if (COMPANY.capitalEuros === null) return "";
  const grouped = String(COMPANY.capitalEuros).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    "\u00a0",
  );
  return ` au capital de ${grouped} €`;
}

/**
 * Identity of the seller, as the law wants it named: the trade name we lead
 * with, then the dénomination sociale, legal form, capital, registered office
 * and RCS entry.
 */
export function sellerIdentity(): string {
  return (
    `${COMPANY.operatorName}, nom commercial de ${COMPANY.legalName}, ` +
    `${COMPANY.legalForm.replace(/\s*\(.*\)$/, "")}${formatCapital()}, ` +
    `${COMPANY.address.street}, ${COMPANY.address.postalCode} ${COMPANY.address.city}. ` +
    `${COMPANY.rcs}.`
  );
}

/**
 * The VAT sentence for the regime in force.
 *
 * Under the franchise en base nothing is charged and the invoice has to say
 * why. On the régime réel the rate shows on each line and the intra-EU number
 * is what the invoice needs instead — adding the 293 B mention there would
 * state something false (see the VAT block in lib/legal/company.ts).
 */
export function vatMention(): string {
  return VAT.regime === "franchise"
    ? "TVA non applicable, art. 293 B du CGI."
    : `TVA intracommunautaire ${COMPANY.vatNumber}.`;
}

/**
 * Late payment terms, mandatory between professionals (art. L441-9 and
 * L441-10). Deliberately the statutory fallback rather than an invented rate:
 * with nothing agreed in the terms of sale, that is exactly what applies.
 * Choosing three times the legal interest rate instead is a commercial
 * decision, and it belongs in the CGV before it belongs here.
 *
 * Left off a consumer's invoice, where these terms have no place.
 */
export function latePaymentTerms(): string {
  const discount =
    LATE_PAYMENT.earlyPaymentDiscount ?? "Aucun escompte pour paiement anticipé";
  return (
    `En cas de retard de paiement, pénalités au ${LATE_PAYMENT.penaltyRate}, ` +
    "exigibles sans rappel, et indemnité forfaitaire pour frais de recouvrement " +
    `de ${LATE_PAYMENT.indemnityEuros} € (art. L441-10 du code de commerce). ` +
    `${discount}.`
  );
}

/**
 * The footer Stripe prints at the bottom of the invoice.
 * A consumer sale drops the late payment terms, which only bind professionals.
 */
export function invoiceFooter(buyerType: "business" | "personal"): string {
  const parts = [sellerIdentity(), vatMention()];
  if (buyerType === "business") parts.push(latePaymentTerms());
  return parts.join(" ");
}

/** SIRET, which the footer has no room to carry legibly. */
export function invoiceCustomFields(): { name: string; value: string }[] {
  return [{ name: "SIRET", value: COMPANY.siret }];
}

/**
 * Everything Stripe needs to print a compliant invoice, in the shape both
 * `checkout.sessions.create` (invoice_data) and `customers.update`
 * (invoice_settings) accept.
 */
export function invoiceLegalSettings(buyerType: "business" | "personal"): {
  footer: string;
  custom_fields: { name: string; value: string }[];
} {
  return {
    footer: invoiceFooter(buyerType),
    custom_fields: invoiceCustomFields(),
  };
}

/**
 * Flags a configuration that would issue a wrong invoice: a company on the
 * régime réel that charges no VAT is billing something it owes the state
 * anyway. Returns the problem to report, or null.
 *
 * Fatal at both ends since the regime was settled (#174): `validateSiteEnv`
 * refuses a deployment whose NEXT_PUBLIC_TVA_ENABLED contradicts the regime or
 * is missing, and this refuses the sale — an invoice is a legal document, and
 * one stating a VAT position the company does not hold cannot be taken back,
 * while a refused sale can be retried once the env is right.
 *
 * The two ends read two different envs, and only this one can see
 * STRIPE_TAX_ENABLED: in production it lives on the Convex deployment, where
 * `validateSiteEnv` — a Next-side function — has no visibility at all. That is
 * why absence is the case that matters here. `stripeTaxEnabled()` maps an
 * unset variable to `false`, so a Convex deployment that never heard of the
 * flag lands in the `reel && !taxCharged` branch below and is refused, rather
 * than quietly selling without the VAT it owes.
 *
 * The wording says what to fix, not what to decide: the decision is made, and
 * this text is what an operator reads when a deploy or a sale is turned away.
 */
export function vatConfigurationProblem(taxCharged: boolean): string | null {
  if (VAT.regime === "reel" && !taxCharged) {
    return (
      "Régime réel déclaré (VAT.regime, lib/legal/company.ts) mais TVA non " +
      "facturée : la TVA reste due et les factures émises seraient " +
      "incohérentes. Activer Stripe Tax sur le compte Stripe " +
      "(tax_behavior=exclusive sur les Prices), puis poser " +
      "STRIPE_TAX_ENABLED=true côté Convex et NEXT_PUBLIC_TVA_ENABLED=true " +
      "côté Next — les deux vont ensemble. Voir apps/site/MISE_EN_PROD.md."
    );
  }
  if (VAT.regime === "franchise" && taxCharged) {
    return (
      "Franchise en base déclarée (VAT.regime, lib/legal/company.ts) mais TVA " +
      "facturée par Stripe : la facture porterait une TVA que l'entreprise " +
      "n'a pas à collecter. Poser STRIPE_TAX_ENABLED=false côté Convex et " +
      "NEXT_PUBLIC_TVA_ENABLED=false côté Next, ou corriger VAT.regime si le " +
      "régime a changé. Voir apps/site/MISE_EN_PROD.md."
    );
  }
  return null;
}

/**
 * Flags a checkout whose displayed total cannot match its invoice.
 *
 * The two halves of the VAT configuration live in two different envs and never
 * met. `STRIPE_TAX_ENABLED` is read here, on the Convex deployment;
 * `NEXT_PUBLIC_TVA_ENABLED` is read in the browser, out of a bundle frozen at
 * build time. `vatConfigurationProblem` above measures the Convex half against
 * the regime and `validateSiteEnv` measures the Next half against the same
 * regime, so both are anchored — but nothing ever compared them to each other,
 * and each was blind to the env the other one holds.
 *
 * The gap that leaves is narrow and expensive: a bundle built with the flag
 * explicitly wrong, or built before the flag was set, against a Convex
 * deployment whose own flag is right. Both ends then pass their own check and
 * disagree in front of the customer — the summary quotes 8 750 €, Stripe
 * charges 10 500 €, and the first anyone hears of it is the card statement.
 *
 * So the caller declares what it displayed, and the sale is refused when that
 * is not what Stripe is about to charge. `taxDisplayed` is what the client
 * genuinely rendered rather than what it thinks ought to be true, which is the
 * only value worth comparing: a browser that lies about it buys itself a
 * refused sale or a total higher than the one it showed, never a cheaper one.
 *
 * Scope, stated plainly because the name invites more: this compares the VAT
 * STANCE, not the amount. Two summaries that agree VAT was quoted can still
 * differ in total — a founders slot consumed between render and submit, a
 * referral discount revalued server-side — and nothing here detects that. A
 * guard on the total would need the client to send the figure and the server
 * to recompute it; that is a different check against a different defect, and
 * it does not exist yet.
 */
export function taxDisplayMismatch(
  taxCharged: boolean,
  taxDisplayed: boolean,
): string | null {
  if (taxCharged === taxDisplayed) return null;

  return taxCharged
    ? "Le récapitulatif affiché ne comporte pas de TVA alors que Stripe la " +
        "facturerait : le client verrait un total inférieur de 20 % à celui " +
        "qui lui serait débité. Poser NEXT_PUBLIC_TVA_ENABLED=true côté Next " +
        "et redéployer — la valeur est figée dans le bundle au build. " +
        "Voir apps/site/MISE_EN_PROD.md."
    : "Le récapitulatif affiché comporte une TVA que Stripe ne facturerait " +
        "pas : le client verrait un total supérieur de 20 % à celui qui lui " +
        "serait débité. Aligner NEXT_PUBLIC_TVA_ENABLED côté Next et " +
        "STRIPE_TAX_ENABLED côté Convex sur VAT.regime " +
        "(lib/legal/company.ts). Voir apps/site/MISE_EN_PROD.md.";
}
