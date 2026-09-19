/* ── Founders coupon audit ──

   The sibling of stripePriceAudit.ts, for the object that side deliberately
   left alone. The runbook says so in its own §7: « stripeAudit:run does not
   audit the coupon ». That was the expensive omission — the four Prices bill a
   renewal at 100 to 2 000 € and drift shows up on an invoice, while the coupon
   gives away a 3 500 € build and drift shows up nowhere at all.

   What was actually checked before this file, measured on the two scripts:

   | field            | stripeAudit:run | stripe-founders-launch.sh |
   |------------------|-----------------|---------------------------|
   | max_redemptions  | no              | yes                       |
   | times_redeemed   | no              | yes                       |
   | applies_to       | no              | yes                       |
   | percent_off      | NO              | NO                        |
   | amount_off       | NO              | NO                        |
   | duration         | no              | no                        |
   | redeem_by        | no              | no                        |
   | valid            | no              | no                        |
   | livemode         | no              | no                        |

   `percent_off` is the one that decides whether the creation is free, and
   nothing in the repository read it. A coupon created at 50 % passed both
   scripts and every test: the checkout would open, the cap would hold, the
   applies_to would target the right line — and the founder would be invoiced
   1 750 € for a build the sales page gave away. The launch script's only
   mention of the field is in a comment explaining why `percent_off` is
   preferred to `amount_off`.

   And the launch script's coupon section runs only where the Stripe CLI is
   installed; without it the whole section degrades to « unknown » and the run
   still passes. So on a machine without the CLI — which is most of them — the
   coupon had no automated check of any kind.

   Plain module on purpose — no "use node", no Stripe import, no Convex
   registration — so every rule below is unit-testable without credentials.
   The action that talks to Stripe is convex/stripeAudit.ts. Same split as
   stripePriceAudit, and for the same reason. */

import { foundersOffer } from "./foundersOffer";
import { planPrices } from "./planPrices";
import { CREATION_PRODUCT_ENV } from "./stripePriceAudit";

/** Env var holding the persistent founders coupon id. No `prod_`/`price_`
    prefix to check: a coupon id is whatever the account chose (runbook §5). */
export const FOUNDERS_COUPON_ENV = "STRIPE_FOUNDERS_COUPON_ID";

/**
 * The env var holding the creation Product the founders coupon must target.
 *
 * Derived from `foundersOffer.plan`, never written as "essentielle": the offer
 * names its own plan, and the PREMIUM creation product is not a legitimate
 * applies_to target — a coupon restricted to it would leave the Essentielle
 * creation line undiscounted while looking configured.
 *
 * The throw is unreachable while the map stays total over PlanId, and it is a
 * narrowing the compiler can follow rather than a cast: if the map ever loses
 * the entry this fails at module load, instead of indexing process.env with
 * `undefined` and quietly auditing applies_to against nothing. Same shape, and
 * the same reasoning, as envNameFor in stripePriceAudit.
 */
export const FOUNDERS_CREATION_PRODUCT_ENV: string = (() => {
  const envName = CREATION_PRODUCT_ENV[foundersOffer.plan];
  if (!envName) {
    throw new Error(
      `CREATION_PRODUCT_ENV has no entry for the founders plan « ${foundersOffer.plan} »`,
    );
  }
  return envName;
})();

/**
 * What the founders coupon must be, derived from the offer rather than
 * restated.
 *
 * `creationCents: 0` is the offer saying the build is given outright, so the
 * discount has to cover the whole creation line — 100 %, or the exact list
 * price in cents. `totalSlots` is the cap. Both move with foundersOffer.ts,
 * which is the point: the drift this catches is Stripe drifting from the repo.
 */
export const EXPECTED_FOUNDERS_COUPON = {
  percentOff: 100,
  /** The `amount_off` alternative, in cents — the full creation line. */
  amountOffCents: planPrices[foundersOffer.plan].creation,
  currency: "eur",
  duration: "once",
  maxRedemptions: foundersOffer.totalSlots,
} as const;

/** The subset of a Stripe Coupon this audit reads. */
export interface StripeCouponFacts {
  id: string;
  /** Stripe's own verdict: false once exhausted, expired or deleted. */
  valid: boolean;
  /** Exactly one of these two is set on any coupon. */
  percentOff: number | null;
  amountOff: number | null;
  /** Only meaningful alongside `amountOff`. */
  currency: string | null;
  duration: string;
  /** `null` means UNCAPPED — the most expensive value this object can hold. */
  maxRedemptions: number | null;
  timesRedeemed: number;
  /** Unix seconds, as Stripe sends it. `null` when unset, which is correct. */
  redeemBy: number | null;
  /**
   * `null` when Stripe did not return the field — which, measured, is always.
   * An empty array is different and means genuinely unrestricted; the two must
   * never be collapsed. See {@link auditFoundersCoupon}.
   */
  appliesToProducts: string[] | null;
  livemode: boolean;
}

/**
 * How bad a finding is, and whether it is a finding at all.
 *
 * `unverifiable` exists because of `applies_to`, and it is the distinction the
 * create wizard learned the hard way: an earlier version failed the run
 * whenever that field was missing — which is always — and two correctly
 * restricted coupons were deleted and rebuilt on its word. A check that cannot
 * tell « unrestricted » from « unreadable » must report, not accuse.
 */
export type CouponSeverity =
  /** The offer is mispriced, uncapped, or lands on the wrong line. */
  | "blocking"
  /** Correct today, fragile tomorrow. */
  | "warning"
  /** The API does not hand the field back. Not a pass and not a failure. */
  | "unverifiable";

/** One thing wrong with the coupon, named so an operator can go and fix it. */
export interface CouponFinding {
  field: string;
  expected: string;
  actual: string;
  message: string;
  /** What to actually do about it — see {@link recreateInstruction}. */
  remedy: string;
  severity: CouponSeverity;
}

const euros = (cents: number) => `${(cents / 100).toFixed(2)} €`;

/* ── Why almost every remedy is « delete and recreate » ──

   A Stripe Coupon is immutable but for `name` and `metadata`. `percent_off`,
   `amount_off`, `duration`, `max_redemptions`, `redeem_by` and `applies_to`
   cannot be patched: POST /v1/coupons/:id accepts the first two and silently
   ignores nothing else, because it does not accept anything else. So « mettre
   à jour le coupon » is always delete-then-create, and that is a money
   operation, not a config edit. */

/**
 * The `max_redemptions` a REPLACEMENT coupon must carry.
 *
 * This is the trap in the whole file. Deleting a coupon and recreating it
 * resets `times_redeemed` to 0 — Stripe keeps no ledger across a deleted id —
 * so recreating at `foundersOffer.totalSlots` after four founders have already
 * redeemed hands out **fourteen** free builds, not ten. Four extra at 3 500 €
 * excl. tax is 14 000 € given away by an operation that reads like a typo fix.
 *
 * The seats already spent are spent. A replacement carries the remainder.
 */
export function replacementMaxRedemptions(timesRedeemed: number): number {
  return Math.max(0, EXPECTED_FOUNDERS_COUPON.maxRedemptions - timesRedeemed);
}

/**
 * The remedy line for anything that needs the coupon rebuilt.
 *
 * Always quotes the remaining-seats arithmetic, even when it comes out at the
 * full ten: an operator who has read it once at `max_redemptions=10` and then
 * sees `max_redemptions=6` has been told why, rather than left to wonder
 * whether the script is wrong.
 */
function recreateInstruction(timesRedeemed: number): string {
  const remaining = replacementMaxRedemptions(timesRedeemed);
  const spent =
    timesRedeemed > 0
      ? ` ${timesRedeemed} place(s) déjà consommée(s) : un coupon recréé remet ` +
        `times_redeemed à 0, donc le remplaçant doit porter ` +
        `max_redemptions=${remaining}, PAS ${EXPECTED_FOUNDERS_COUPON.maxRedemptions} ` +
        `— sinon ${timesRedeemed} création(s) supplémentaire(s) partent gratuitement.`
      : ` Aucune place consommée : max_redemptions=${remaining}.`;
  return (
    `Un coupon Stripe est immuable (seuls name et metadata se modifient) : ` +
    `le supprimer puis le recréer.${spent}`
  );
}

/**
 * Audits the founders coupon against what `foundersOffer` and `planPrices` say
 * it must be.
 *
 * `facts` is `null` when Stripe has no such coupon under the key in force —
 * which is what a TEST-mode id set on a LIVE deployment looks like from here.
 * Unlike a missing Price, that one fails BEFORE the customer is charged
 * (`resolveFoundersPricing` refuses the sale), so it costs a support ticket
 * rather than a debit; it is still blocking, because no Essentielle sells.
 */
export function auditFoundersCoupon(
  facts: StripeCouponFacts | null | undefined,
  context: { creationProductId: string | null; liveMode: boolean },
): CouponFinding[] {
  if (!facts) {
    return [
      {
        field: "existence",
        expected: `un coupon de ${EXPECTED_FOUNDERS_COUPON.percentOff} % sur la création`,
        actual: "aucun coupon sous cet id",
        message:
          `${FOUNDERS_COUPON_ENV} ne correspond à aucun coupon Stripe sous la clé en ` +
          `cours. resolveFoundersPricing refuse alors toute vente Essentielle tant ` +
          `que des places fondateurs restent — la vente s'arrête AVANT le débit, ` +
          `mais elle s'arrête.`,
        remedy:
          `Créer le coupon : bash scripts/wizards/stripe-founders-create.sh --apply`,
        severity: "blocking",
      },
    ];
  }

  const findings: CouponFinding[] = [];
  const add = (f: CouponFinding) => findings.push(f);

  /* ── The discount itself — the field nothing read ── */
  if (facts.percentOff !== null) {
    if (facts.percentOff !== EXPECTED_FOUNDERS_COUPON.percentOff) {
      const billed = Math.round(
        (EXPECTED_FOUNDERS_COUPON.amountOffCents * (100 - facts.percentOff)) / 100,
      );
      add({
        field: "percent_off",
        expected: `${EXPECTED_FOUNDERS_COUPON.percentOff} %`,
        actual: `${facts.percentOff} %`,
        message:
          `Le coupon retire ${facts.percentOff} % de la création alors que l'offre ` +
          `fondateurs l'offre entièrement (foundersOffer.creationCents = 0). ` +
          `Le fondateur serait facturé ${euros(billed)} HT pour une création annoncée ` +
          `gratuite — et la commande Convex, elle, enregistre bien une remise de ` +
          `${euros(EXPECTED_FOUNDERS_COUPON.amountOffCents)} : la session Stripe et ` +
          `l'order ne diraient pas le même prix.`,
        remedy: recreateInstruction(facts.timesRedeemed),
        severity: "blocking",
      });
    }
  } else if (facts.amountOff !== null) {
    /* amount_off is allowed by §3 and is the fragile form: it pins a copy of
       planPrices.essentielle.creation inside Stripe, where nothing moves it. */
    if (facts.amountOff !== EXPECTED_FOUNDERS_COUPON.amountOffCents) {
      const remainder = EXPECTED_FOUNDERS_COUPON.amountOffCents - facts.amountOff;
      add({
        field: "amount_off",
        expected: euros(EXPECTED_FOUNDERS_COUPON.amountOffCents),
        actual: euros(facts.amountOff),
        message:
          `Le coupon retire ${euros(facts.amountOff)} alors que ` +
          `planPrices.${foundersOffer.plan}.creation vaut ` +
          `${euros(EXPECTED_FOUNDERS_COUPON.amountOffCents)}. ` +
          (remainder > 0
            ? `Il reste ${euros(remainder)} HT sur la ligne création d'une offre ` +
              `annoncée gratuite.`
            : `Le coupon dépasse la ligne création de ${euros(-remainder)} ; Stripe ` +
              `déborde alors sur la maintenance, qui n'est pas offerte.`),
        remedy: recreateInstruction(facts.timesRedeemed),
        severity: "blocking",
      });
    } else {
      add({
        field: "amount_off",
        expected: `percent_off=${EXPECTED_FOUNDERS_COUPON.percentOff}`,
        actual: `amount_off=${euros(facts.amountOff)}`,
        message:
          `Le montant est juste aujourd'hui, mais il est figé dans Stripe : c'est ` +
          `une copie de planPrices.${foundersOffer.plan}.creation que rien ne suit. ` +
          `Le jour où ce tarif bouge, le coupon laissera un reliquat sur une ` +
          `création annoncée gratuite, et cet audit sera le seul à le voir.`,
        remedy:
          `Non bloquant. À la prochaine recréation, préférer percent_off=100 ` +
          `(runbook §3) : il reste juste quel que soit le tarif.`,
        severity: "warning",
      });
    }

    if (facts.currency !== EXPECTED_FOUNDERS_COUPON.currency) {
      add({
        field: "currency",
        expected: EXPECTED_FOUNDERS_COUPON.currency,
        actual: facts.currency ?? "non définie",
        message:
          `Le coupon est libellé en ${facts.currency ?? "aucune devise"} : Stripe ` +
          `refuse d'appliquer un amount_off dont la devise diffère de celle de la ` +
          `session (eur). La remise ne s'appliquerait pas du tout.`,
        remedy: recreateInstruction(facts.timesRedeemed),
        severity: "blocking",
      });
    }
  } else {
    add({
      field: "discount",
      expected: `percent_off=${EXPECTED_FOUNDERS_COUPON.percentOff}`,
      actual: "ni percent_off ni amount_off",
      message:
        `Le coupon ne porte aucune remise lisible. Il s'appliquerait à la session ` +
        `sans rien en retirer : la création serait facturée plein tarif sous un ` +
        `intitulé « offre fondateurs ».`,
      remedy: recreateInstruction(facts.timesRedeemed),
      severity: "blocking",
    });
  }

  /* ── The cap. Stripe keeps the ledger; the Convex counter reads a snapshot. ── */
  if (facts.maxRedemptions === null) {
    add({
      field: "max_redemptions",
      expected: String(EXPECTED_FOUNDERS_COUPON.maxRedemptions),
      actual: "illimité",
      message:
        `Le coupon n'a pas de max_redemptions : l'offre n'est plafonnée par rien ` +
        `côté Stripe. countFoundersSold ne tient pas seule — elle lit un instantané ` +
        `et tient une place 30 min, là où Stripe tient le registre. Chaque site ` +
        `au-delà du dixième part à ` +
        `${euros(EXPECTED_FOUNDERS_COUPON.amountOffCents)} HT de perte.`,
      remedy: recreateInstruction(facts.timesRedeemed),
      severity: "blocking",
    });
  } else if (facts.maxRedemptions !== EXPECTED_FOUNDERS_COUPON.maxRedemptions) {
    const delta = facts.maxRedemptions - EXPECTED_FOUNDERS_COUPON.maxRedemptions;
    add({
      field: "max_redemptions",
      expected: String(EXPECTED_FOUNDERS_COUPON.maxRedemptions),
      actual: String(facts.maxRedemptions),
      message:
        `Le coupon plafonne à ${facts.maxRedemptions} alors que ` +
        `foundersOffer.totalSlots vaut ${EXPECTED_FOUNDERS_COUPON.maxRedemptions}. ` +
        (delta > 0
          ? `${delta} création(s) de plus que prévu peuvent partir gratuitement ` +
            `(${euros(delta * EXPECTED_FOUNDERS_COUPON.amountOffCents)} HT).`
          : `La page affiche ${EXPECTED_FOUNDERS_COUPON.maxRedemptions} places et ` +
            `Stripe en tient ${facts.maxRedemptions} : les ${-delta} dernières ` +
            `seraient refusées au paiement, après le parcours d'achat.`),
      remedy: recreateInstruction(facts.timesRedeemed),
      severity: "blocking",
    });
  }

  /* Not a fault — the state of the offer, which the runbook's §6b reads by
     hand before a go-live and which decides what a replacement may carry. */
  if (facts.timesRedeemed > 0) {
    const cap = facts.maxRedemptions ?? EXPECTED_FOUNDERS_COUPON.maxRedemptions;
    add({
      field: "times_redeemed",
      expected: "0 avant la première vente",
      actual: String(facts.timesRedeemed),
      message:
        `${facts.timesRedeemed} place(s) fondateurs déjà consommée(s) : il en reste ` +
        `${Math.max(0, cap - facts.timesRedeemed)}. Avant un go-live ce compteur doit ` +
        `être à 0 ; après, c'est simplement l'état de l'offre.`,
      remedy:
        `Rien à faire si des ventes ont eu lieu. En revanche, ne JAMAIS recréer ce ` +
        `coupon à max_redemptions=${EXPECTED_FOUNDERS_COUPON.maxRedemptions} : ` +
        recreateInstruction(facts.timesRedeemed),
      severity: "warning",
    });
  }

  if (!facts.valid) {
    add({
      field: "valid",
      expected: "true",
      actual: "false",
      message:
        `Stripe considère ce coupon comme épuisé ou expiré : il ne s'appliquera plus ` +
        `à aucune session. resolveFoundersPricing le voit pourtant « configuré » et ` +
        `laisse la vente s'ouvrir — la création serait facturée plein tarif sous ` +
        `l'intitulé fondateurs.`,
      remedy: recreateInstruction(facts.timesRedeemed),
      severity: "blocking",
    });
  }

  if (facts.duration !== EXPECTED_FOUNDERS_COUPON.duration) {
    add({
      field: "duration",
      expected: EXPECTED_FOUNDERS_COUPON.duration,
      actual: facts.duration,
      message:
        `Le coupon est en duration="${facts.duration}" au lieu de "once". La session ` +
        `de création est un paiement unique, mais ce coupon est aussi attaché au ` +
        `client Stripe que le checkout crée — et c'est ce client qui porte ensuite ` +
        `l'abonnement de maintenance. Une durée non ponctuelle peut donc suivre sur ` +
        `les renouvellements, qui ne sont pas offerts.`,
      remedy: recreateInstruction(facts.timesRedeemed),
      severity: "blocking",
    });
  }

  if (facts.redeemBy !== null) {
    const date = new Date(facts.redeemBy * 1000).toLocaleDateString("fr-FR");
    add({
      field: "redeem_by",
      expected: "non défini",
      actual: date,
      message:
        `Le coupon expire le ${date}. L'offre fondateurs « se termine quand les ` +
        `places sont épuisées, jamais à une date » (foundersOffer.ts). Passée celle-ci ` +
        `Stripe refuse le coupon et la page continue d'annoncer les places restantes.`,
      remedy: recreateInstruction(facts.timesRedeemed),
      severity: "blocking",
    });
  }

  /* ── applies_to: report, never accuse ──
     Stripe accepts and validates the field on create and then does not return
     it. Measured against a live test account on 2026-09-19 under five API
     versions: absent in all five, while the Dashboard showed the restriction
     correctly. `null` is « the API said nothing »; `[]` is « the API said
     none », and only the second is an accusation this file is entitled to
     make. */
  if (facts.appliesToProducts === null) {
    add({
      field: "applies_to",
      expected: context.creationProductId ?? "le produit de création Essentielle",
      actual: "non renvoyé par l'API",
      message:
        `Stripe accepte applies_to à la création et ne le relit jamais. La ` +
        `restriction ne peut donc pas être vérifiée ici — ce n'est ni un succès ni ` +
        `un échec. Un applies_to absent ou erroné donne le BON TOTAL : Stripe étale ` +
        `la remise au prorata sur les deux lignes au lieu d'annuler la création, ` +
        `donc aucun contrôle sur les montants ne peut le voir.`,
      remedy:
        `À vérifier à l'œil, une fois : ` +
        `https://dashboard.stripe.com/${context.liveMode ? "" : "test/"}coupons/${facts.id} ` +
        `— sous « Applicable Products » doit figurer ` +
        `${context.creationProductId ?? "le produit de création Essentielle"}, et rien d'autre. ` +
        `Puis le checkout du §6c : la ligne création doit afficher 0,00 €.`,
      severity: "unverifiable",
    });
  } else if (facts.appliesToProducts.length === 0) {
    add({
      field: "applies_to",
      expected: context.creationProductId ?? "le produit de création Essentielle",
      actual: "aucune restriction",
      message:
        `Le coupon ne vise aucun produit : Stripe étale la remise au prorata sur ` +
        `toutes les lignes de la session. Le total reste juste et la facture répartit ` +
        `un investissement amortissable et une charge déductible dans les mauvaises ` +
        `proportions — et la première année de maintenance part offerte avec.`,
      remedy: recreateInstruction(facts.timesRedeemed),
      severity: "blocking",
    });
  } else if (
    context.creationProductId !== null &&
    !facts.appliesToProducts.includes(context.creationProductId)
  ) {
    add({
      field: "applies_to",
      expected: context.creationProductId,
      actual: facts.appliesToProducts.join(", "),
      message:
        `Le coupon vise un autre produit que la création Essentielle ` +
        `(${context.creationProductId}). La remise n'atterrit pas sur la ligne qu'elle ` +
        `doit annuler.`,
      remedy: recreateInstruction(facts.timesRedeemed),
      severity: "blocking",
    });
  }

  if (facts.livemode !== context.liveMode) {
    add({
      field: "livemode",
      expected: String(context.liveMode),
      actual: String(facts.livemode),
      message:
        `${FOUNDERS_COUPON_ENV} pointe sur un coupon ${facts.livemode ? "live" : "de test"} ` +
        `alors que la clé en cours est ${context.liveMode ? "live" : "de test"}.`,
      remedy: `Poser l'id du coupon ${context.liveMode ? "live" : "de test"} sur ce déploiement.`,
      severity: "blocking",
    });
  }

  /* The applies_to rule is the one that needs something other than the coupon
     itself, and with no creation product id it cannot run. Reported rather
     than skipped in silence — same reasoning, and the same failure, as the
     coverage finding in stripePriceAudit. */
  if (context.creationProductId === null) {
    add({
      field: "coverage",
      expected: "STRIPE_PRODUCT_CREATION_ESSENTIELLE posé",
      actual: "absent",
      message:
        `STRIPE_PRODUCT_CREATION_ESSENTIELLE n'est pas posé sur ce déploiement, donc ` +
        `la cible d'applies_to n'a pas pu être comparée à quoi que ce soit. Les ` +
        `autres contrôles restent valables ; celui-là n'a pas été exécuté — ce n'est ` +
        `pas un succès. resolveFoundersPricing refuse d'ailleurs la vente sans lui.`,
      remedy: `pnpx convex env set STRIPE_PRODUCT_CREATION_ESSENTIELLE "prod_..." --prod`,
      severity: "unverifiable",
    });
  }

  return findings;
}

/** Splits findings by severity, so a caller can gate on the blocking ones. */
export function summariseCouponFindings(findings: CouponFinding[]): {
  blocking: number;
  warnings: number;
  unverifiable: number;
  summary: string;
} {
  const count = (s: CouponSeverity) =>
    findings.filter((f) => f.severity === s).length;
  const blocking = count("blocking");
  const warnings = count("warning");
  const unverifiable = count("unverifiable");

  const parts: string[] = [];
  if (blocking > 0) parts.push(`${blocking} bloquant(s)`);
  if (warnings > 0) parts.push(`${warnings} avertissement(s)`);
  if (unverifiable > 0) parts.push(`${unverifiable} non vérifiable(s)`);

  return {
    blocking,
    warnings,
    unverifiable,
    summary:
      parts.length === 0
        ? "Coupon fondateurs conforme à foundersOffer et planPrices."
        : `Coupon fondateurs : ${parts.join(", ")}.`,
  };
}
