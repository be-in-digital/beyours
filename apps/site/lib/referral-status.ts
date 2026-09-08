/**
 * How a commission's state is named to the affiliate who earned it.
 *
 * WHY IT IS NOT INSIDE THE PAGE THAT RENDERS IT. It was, and it was the second
 * hand-written copy of the same seven states — the ops console has the other,
 * in `components/admin/status.tsx`. #384 added an eighth, `paying`, and told
 * neither of them, so both fell through to their raw-literal fallback and
 * rendered the English word `paying` in a grey "unknown" badge, in French
 * screens, for the whole window in which money is moving to an affiliate
 * (#411).
 *
 * A guard test cannot import a Next.js page, so a map declared inside one is a
 * map nothing can check. Here it can: `tests/referral-status-vocabulary.test.ts`
 * reads the schema's own union and requires both vocabularies to cover it, so
 * a ninth state fails a build instead of reaching an affiliate as an English
 * literal.
 */

/** The badge label and its classes, for one commission state. */
export interface ReferralStatusBadge {
  label: string
  cls: string
}

export const AFFILIATE_REFERRAL_STATUS: Record<string, ReferralStatusBadge> = {
  pending: {
    label: "En attente",
    cls: "bg-warning-soft text-warning-strong border-warning-border",
  },
  validated: {
    label: "Validé",
    cls: "bg-info-soft text-info-strong border-info-border",
  },
  payable: {
    label: "À verser",
    cls: "bg-primary/10 text-primary border-primary/20",
  },
  /* Claimed by a payout run, transfer not yet confirmed. The affiliate's own
     totals have counted it as owed since #384; only the badge was missed. */
  paying: {
    label: "Versement en cours",
    cls: "bg-info-soft text-info-strong border-info-border",
  },
  paid: {
    label: "Payé",
    cls: "bg-success-soft text-success-strong border-success-border",
  },
  cancelled: {
    label: "Annulé",
    cls: "bg-danger-soft text-danger-strong border-danger-border",
  },
  blocked: {
    label: "Bloqué",
    cls: "bg-danger-soft text-danger-strong border-danger-border",
  },
}
