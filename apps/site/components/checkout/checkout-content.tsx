"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useCheckoutStore } from "@/lib/store";
import { isPlanOpenForSale } from "@/convex/planAvailability";
import { CheckoutFlow } from "./checkout-flow";

export function CheckoutContent() {
  const searchParams = useSearchParams();
  const store = useCheckoutStore();

  useEffect(() => {
    /* A closed plan is refused server-side (convex/stripe.ts), but letting the
       buyer fill in six fields first and only then be told the offer does not
       exist is a worse way to say it. The URL is the only route here — no page
       links to a closed plan — so ignoring it leaves the default in place. */
    const plan = searchParams.get("plan");
    if ((plan === "essentielle" || plan === "premium") && isPlanOpenForSale(plan)) {
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
