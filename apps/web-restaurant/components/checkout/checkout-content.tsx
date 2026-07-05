"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCheckoutStore } from "@/lib/store";
import { CheckoutFlow } from "./checkout-flow";

export function CheckoutContent() {
  const searchParams = useSearchParams();
  const store = useCheckoutStore();

  useEffect(() => {
    const plan = searchParams.get("plan");
    if (plan === "essentielle" || plan === "premium") {
      store.setPlan(plan);
    }

    const ref = searchParams.get("ref");
    if (ref && ref.trim().length > 0 && !store.appliedReferral) {
      store.setReferralInput(ref.trim());
      store.setReferralStatus("checking");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return <CheckoutFlow />;
}
