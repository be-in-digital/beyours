/**
 * Source of truth — the art. L. 221-28 waiver ticked at checkout.
 *
 * The CGV (« 12. Droit de rétractation ») say the waiver is given « En cochant
 * la case de consentement prévue à cet effet lors de la commande ». That
 * sentence is a promise about a record: when a consumer exercises a 14-day
 * withdrawal on a 3 500 € build, the company has to produce the tick.
 *
 * So both ends read this file. The checkout renders `text` beside the checkbox,
 * and `createCheckoutSession` writes `text`, `version` and a server clock onto
 * the order. Neither can drift from the other, and the recorded wording is the
 * server's — a caller cannot submit a clause of its own invention.
 *
 * The text is customer-facing legal copy: it stays in French, and it is not
 * ours to reword. Changing it means bumping `version` in the same commit, so
 * an order signed under the old wording still says which wording that was.
 */

export interface WithdrawalWaiverClause {
  /** Bumped whenever `text` changes. Stored verbatim on every order. */
  version: string;
  /** The exact sentence shown next to the checkbox, and recorded on the order. */
  text: string;
  /** The CGV clause the tick evidences, for the audit trail. */
  cgvClause: string;
}

export const WITHDRAWAL_WAIVER: WithdrawalWaiverClause = {
  version: "2026-09-05",
  text:
    "Je demande l'exécution immédiate de la prestation et reconnais perdre " +
    "mon droit de rétractation une fois le service pleinement exécuté " +
    "(art. L. 221-28 du Code de la consommation).",
  cgvClause: "CGV, art. 12 — Droit de rétractation (art. L. 221-28, 1°)",
};

/** Refusal returned when the box was not ticked. Customer-facing, French. */
export const WITHDRAWAL_WAIVER_REQUIRED =
  "Votre demande expresse d'exécution immédiate est requise pour valider la " +
  "commande (art. L. 221-28 du Code de la consommation).";
