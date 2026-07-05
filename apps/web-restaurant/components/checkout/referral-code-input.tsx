"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCheckoutStore } from "@/lib/store";

export function ReferralCodeInput() {
  const referralInput = useCheckoutStore((s) => s.referralInput);
  const referralStatus = useCheckoutStore((s) => s.referralStatus);
  const appliedReferral = useCheckoutStore((s) => s.appliedReferral);
  const referralError = useCheckoutStore((s) => s.referralError);
  const setReferralInput = useCheckoutStore((s) => s.setReferralInput);
  const setReferralStatus = useCheckoutStore((s) => s.setReferralStatus);
  const applyReferral = useCheckoutStore((s) => s.applyReferral);
  const clearReferral = useCheckoutStore((s) => s.clearReferral);
  const setReferralError = useCheckoutStore((s) => s.setReferralError);

  const shouldValidate =
    referralStatus === "checking" && referralInput.trim().length > 0;
  const validationResult = useQuery(
    api.referralCodes.validateCode,
    shouldValidate ? { code: referralInput.trim() } : "skip",
  );

  useEffect(() => {
    if (referralStatus !== "checking" || validationResult === undefined) return;

    if (validationResult.valid) {
      applyReferral({
        code: validationResult.code!,
        referralCodeId: validationResult.referralCodeId!,
        affiliateUserId: validationResult.affiliateUserId!,
        discountPercent: validationResult.discountPercent!,
      });
    } else {
      setReferralError(validationResult.error || "Code invalide");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationResult, referralStatus]);

  const handleApply = () => {
    if (!referralInput.trim()) return;
    setReferralStatus("checking");
  };

  if (appliedReferral) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary">
                Code appliqué
              </span>
              <span className="text-xs font-mono text-foreground">
                {appliedReferral.code}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              -{appliedReferral.discountPercent}% sur la mise en service
            </p>
          </div>
          <button
            onClick={clearReferral}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Retirer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={referralInput}
          onChange={(e) => {
            setReferralInput(e.target.value);
            if (referralError) setReferralError(null);
          }}
          placeholder="Code parrainage"
          disabled={referralStatus === "checking"}
          className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary/40 focus:bg-white/[0.06] disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply();
            }
          }}
        />
        <button
          onClick={handleApply}
          disabled={referralStatus === "checking" || !referralInput.trim()}
          className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {referralStatus === "checking" ? (
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />
          ) : (
            "Appliquer"
          )}
        </button>
      </div>
      {referralError && (
        <p className="text-xs text-red-400">{referralError}</p>
      )}
    </div>
  );
}
