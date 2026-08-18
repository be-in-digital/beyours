"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { KickoffCallButton } from "./kickoff-call-button";

/**
 * Gates the kickoff booking button behind a paid order.
 *
 * Stripe already appends ?orderId=… to the success URL (convex/stripe.ts), but
 * the page ignored it, so /checkout/success — and the post-purchase booking it
 * offers — was reachable by anyone. This checks the id against the order before
 * showing the button.
 *
 * The orderId is a bearer token in a URL: forwarding the confirmation link
 * forwards the access. That is the usual trade-off for a post-payment page, and
 * a different problem from the page being wide open.
 */
export function KickoffGate() {
  const orderId = useSearchParams().get("orderId");
  // `undefined` while loading, `null` when the order is unknown or unpaid.
  const access = useQuery(
    api.orders.getCheckoutAccess,
    orderId ? { orderId } : "skip",
  );

  if (!orderId) return <Refused />;
  if (access === undefined) {
    return (
      <div
        className="h-12 w-56 mx-auto rounded-full bg-surface-2 animate-pulse"
        aria-label="Vérification de votre commande"
      />
    );
  }
  if (!access?.paid) return <Refused />;

  return <KickoffCallButton />;
}

function Refused() {
  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">
        Nous n&apos;avons pas retrouvé de commande réglée pour ce lien. Si vous
        venez de payer, ouvrez le lien reçu par email.
      </p>
      <Link
        href="/contact"
        className="mt-3 inline-flex items-center justify-center rounded-full border border-[color:var(--border)] px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Nous contacter
      </Link>
    </div>
  );
}
