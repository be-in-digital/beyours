"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useCheckoutStore } from "@/lib/store";
import {
  FOUNDERS_OFFER,
  getCheckoutTotals,
  TVA_ENABLED,
  type PaymentMethodSlug,
} from "@/lib/payment-providers";
import { WITHDRAWAL_WAIVER } from "@/lib/legal/withdrawal-waiver";
import { FadeIn } from "@/components/ui/motion";
import { BuyerTypeSelector } from "./buyer-type-selector";
import { BillingPeriodSelector } from "./billing-period-selector";
import { CheckoutForm } from "./checkout-form";
import { PaymentMethodSelector } from "./payment-method-selector";
import { OrderSummary } from "./order-summary";
import { ReferralCodeInput } from "./referral-code-input";

export function CheckoutFlow() {
  const store = useCheckoutStore();
  const createCheckout = useAction(api.stripe.createCheckoutSession);

  // Express consent to immediate performance (art. L. 221-28 of the French
  // consumer code): never pre-checked, it evidences the waiver of the
  // withdrawal right and blocks payment until it is given. PROPOSED TEXT, to be
  // validated by counsel (IP lawyer / attorney) before going live.
  //
  // This checkbox is the buyer's affordance, not the guard. The guard is in
  // `createCheckoutSession`, which refuses an order whose
  // `withdrawalWaiverConsent` is false and records the clause server-side —
  // a public action cannot be gated by React state.
  const [consentRetractation, setConsentRetractation] = useState(false);

  const foundersSold = useQuery(api.orders.countFoundersSold, {});
  const foundersActive =
    FOUNDERS_OFFER.enabled &&
    (foundersSold ?? 0) < FOUNDERS_OFFER.totalSlots;

  const { total: totalCents } = getCheckoutTotals(
    store.plan,
    store.billingPeriod,
    store.appliedReferral?.discountPercent,
    foundersActive,
  );

  const handleBuyerTypeNext = () => {
    store.setStep("info");
  };

  const handleInfoSubmit = (info: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    restaurantName: string;
    city: string;
    siret?: string;
  }) => {
    store.setCustomerInfo(info);
    store.setStep("method");
  };

  const handlePay = async (
    method: PaymentMethodSlug,
    infoOverride?: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      restaurantName: string;
      city: string;
      siret?: string;
    },
  ) => {
    const info = infoOverride ?? store.customerInfo;
    if (!info) return;

    store.setStep("processing");
    store.setError(null);

    try {
      const origin = window.location.origin;
      const referral = store.appliedReferral;
      const referralArgs = referral
        ? {
            referralCode: referral.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            referralCodeId: referral.referralCodeId as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            referrerId: referral.affiliateUserId as any,
            discountPercent: referral.discountPercent,
          }
        : {};
      const result = await createCheckout({
        plan: store.plan,
        orderType: store.orderType,
        buyerType: store.buyerType,
        billingPeriod: store.billingPeriod,
        customerEmail: info.email,
        customerFirstName: info.firstName,
        customerLastName: info.lastName,
        customerPhone: info.phone,
        restaurantName: info.restaurantName,
        city: info.city,
        siret: info.siret || undefined,
        successUrl: `${origin}/checkout/success`,
        cancelUrl: `${origin}/checkout/cancel`,
        /* What OrderSummary just rendered above this button — the same
           constant, so the two cannot drift. The Convex side compares this
           with what Stripe is about to do and refuses the sale when the two
           disagree; nothing else can make that comparison, since the two flags
           live in two envs that never meet.

           It is one bit, and only one: whether VAT was quoted. It does NOT
           certify the total. Two summaries agreeing on the tax stance can
           still differ in amount — a founders slot taken between render and
           submit, a referral discount revalued server-side — and this argument
           says nothing about those. Widening it to carry the total would be a
           different guard against a different defect; do not read this one as
           already being it. */
        taxDisplayed: TVA_ENABLED,
        withdrawalWaiverConsent: consentRetractation,
        ...referralArgs,
      });

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      store.setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue. Veuillez réessayer.",
      );
      store.setStep("method");
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <FadeIn>
        <OrderSummary
          plan={store.plan}
          billingPeriod={store.billingPeriod}
          discountPercent={store.appliedReferral?.discountPercent}
          foundersActive={foundersActive}
        />
      </FadeIn>

      <div className="mt-4">
        <ReferralCodeInput />
      </div>

      <div className="mt-6">
        {store.error && (
          <FadeIn>
            <div
              role="alert"
              className="mb-6 rounded-xl border border-[color:var(--destructive)]/30 bg-[color:var(--destructive)]/5 px-4 py-3 text-sm text-[color:var(--destructive)]"
            >
              {store.error}
            </div>
          </FadeIn>
        )}

        {store.step === "buyer-type" && (
          <FadeIn>
            <div className="space-y-6">
              <BuyerTypeSelector
                value={store.buyerType}
                onChange={store.setBuyerType}
              />
              <BillingPeriodSelector
                value={store.billingPeriod}
                onChange={store.setBillingPeriod}
              />
              <button
                onClick={handleBuyerTypeNext}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--glow-primary)] transition-all duration-200 hover:brightness-105"
              >
                Continuer
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          </FadeIn>
        )}

        {store.step === "info" && (
          <FadeIn>
            <div className="space-y-4">
              <button
                onClick={() => store.setStep("buyer-type")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                ← Retour
              </button>
              <CheckoutForm
                initialData={store.customerInfo}
                onSubmit={handleInfoSubmit}
                buyerType={store.buyerType}
              />
            </div>
          </FadeIn>
        )}

        {store.step === "method" && (
          <FadeIn>
            <div className="space-y-4">
              <button
                onClick={() => store.setStep("info")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                ← Retour
              </button>

              {/* Express consent to immediate performance (art. L. 221-28):
                  never pre-checked, it unlocks the payment methods. */}
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--border)] bg-surface-1 p-4">
                <input
                  type="checkbox"
                  checked={consentRetractation}
                  onChange={(e) => {
                    setConsentRetractation(e.target.checked);
                    if (e.target.checked) store.setError(null);
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  aria-describedby="consent-retractation-desc"
                />
                {/* Rendered from lib/legal/withdrawal-waiver.ts, the same
                    constant the server stores on the order — so what the buyer
                    read and what the audit trail says can never diverge. */}
                <span
                  id="consent-retractation-desc"
                  className="text-xs leading-relaxed text-muted-foreground"
                >
                  {WITHDRAWAL_WAIVER.text}
                </span>
              </label>

              <div
                aria-disabled={!consentRetractation}
                className={
                  consentRetractation
                    ? undefined
                    : "pointer-events-none opacity-50"
                }
              >
                <PaymentMethodSelector
                  buyerType={store.buyerType}
                  amountCents={totalCents}
                  onSelect={(method) => {
                    if (!consentRetractation) {
                      store.setError(
                        "Veuillez confirmer votre demande d'exécution immédiate pour continuer.",
                      );
                      return;
                    }
                    handlePay(method);
                  }}
                />
              </div>
            </div>
          </FadeIn>
        )}

        {store.step === "processing" && (
          <FadeIn>
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Redirection vers le paiement...
              </p>
            </div>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
