/**
 * Refund policy
 *
 * Pure decisions about a refund: is it allowed, what does it leave behind, and
 * can it actually be executed against the provider?
 *
 * WHY THIS EXISTS: `payments.refund` was a database patch and nothing else. It
 * set `refundedAmount`, flipped the payment and the order to "refunded", and
 * never called Stripe, SumUp or PayPal — a repository-wide search for `refund`
 * in those three files returned nothing. The restaurant saw "remboursé", the
 * customer never got their money, and the gap only surfaced at reconciliation
 * or in a dispute.
 *
 * It also refunded payments in any state, including `failed` ones.
 *
 * The rule now: nothing is recorded as refunded until the provider confirms it,
 * or until a human explicitly records an out-of-band refund (cash at the till).
 */

export type PaymentProviderName =
  | "stripe"
  | "sumup"
  | "paypal"
  | "square"
  | "cash"

/** The subset of a payment document these decisions need. */
export interface PaymentForRefund {
  provider: PaymentProviderName
  status: string
  /** Amount originally captured, in cents. */
  amount: number
  /** Cumulative amount already refunded, in cents. */
  refundedAmount?: number
  /** The provider's identifier for the captured payment. */
  externalId?: string
}

export type RefundRejectionReason =
  | "not_settled"
  | "amount_not_positive"
  | "exceeds_balance"

/** Thrown when a refund must not proceed. */
export class RefundRejectedError extends Error {
  readonly reason: RefundRejectionReason

  constructor(reason: RefundRejectionReason, message: string) {
    super(message)
    this.name = "RefundRejectedError"
    this.reason = reason
  }
}

export interface RefundPlan {
  /** Amount to refund now, in cents. */
  amount: number
  /** Cumulative refunded amount once this refund lands. */
  refundedAmount: number
  isFullRefund: boolean
  paymentStatus: "refunded" | "partially_refunded"
  orderPaymentStatus: "refunded" | "partially_refunded"
}

/** Statuses from which money can still be sent back. */
const REFUNDABLE_STATUSES = new Set(["succeeded", "partially_refunded"])

/**
 * Validate a refund request and describe the state it should leave behind.
 *
 * Throws rather than returning a null plan: a refused refund is an event the
 * operator needs to see, not a silent no-op.
 */
export function planRefund(params: {
  payment: PaymentForRefund
  amount: number
}): RefundPlan {
  const { payment, amount } = params

  // The old code refunded anything, including payments that never succeeded.
  if (!REFUNDABLE_STATUSES.has(payment.status)) {
    throw new RefundRejectedError(
      "not_settled",
      `Un paiement au statut « ${payment.status} » ne peut pas être remboursé.`
    )
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RefundRejectedError(
      "amount_not_positive",
      "Le montant du remboursement doit être supérieur à 0."
    )
  }

  if (!Number.isInteger(amount)) {
    throw new RefundRejectedError(
      "amount_not_positive",
      "Le montant du remboursement doit être un entier de centimes."
    )
  }

  const alreadyRefunded = payment.refundedAmount ?? 0
  const refundedAmount = alreadyRefunded + amount

  if (refundedAmount > payment.amount) {
    const remaining = payment.amount - alreadyRefunded
    throw new RefundRejectedError(
      "exceeds_balance",
      `Le remboursement dépasse le solde restant (${remaining} c).`
    )
  }

  const isFullRefund = refundedAmount >= payment.amount
  const status = isFullRefund ? "refunded" : "partially_refunded"

  return {
    amount,
    refundedAmount,
    isFullRefund,
    paymentStatus: status,
    orderPaymentStatus: status,
  }
}

/** How a refund can be carried out for a given payment. */
export type RefundRoute =
  | {
      kind: "api"
      provider: "stripe" | "sumup" | "paypal"
      /** The provider's id for the captured payment, to refund against. */
      externalId: string
    }
  | { kind: "manual"; provider: "cash" }
  | { kind: "unsupported"; provider: PaymentProviderName; reason: string }

/**
 * Decide how — or whether — a refund can actually be executed.
 *
 * Returning `unsupported` is a feature: it is what stops the system claiming a
 * refund it has no way to perform. The caller must surface the reason instead
 * of recording anything.
 */
export function routeRefund(payment: PaymentForRefund): RefundRoute {
  if (payment.provider === "cash") {
    // Cash is handed back at the counter. There is no provider to call, so the
    // record is the staff's declaration — labelled as such, never as an
    // API-confirmed refund.
    return { kind: "manual", provider: "cash" }
  }

  if (payment.provider === "square") {
    return {
      kind: "unsupported",
      provider: "square",
      reason:
        "Aucune intégration Square n'existe : effectuez le remboursement depuis le tableau de bord Square.",
    }
  }

  if (!payment.externalId) {
    return {
      kind: "unsupported",
      provider: payment.provider,
      reason: `Ce paiement ${payment.provider} n'a pas d'identifiant de transaction enregistré : effectuez le remboursement depuis le tableau de bord ${payment.provider}.`,
    }
  }

  return {
    kind: "api",
    provider: payment.provider,
    externalId: payment.externalId,
  }
}
