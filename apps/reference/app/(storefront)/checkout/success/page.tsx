"use client"

/**
 * Post-payment landing page.
 *
 * Every card, PayPal and SumUp checkout redirected here and got a 404: the
 * route was referenced from `checkout/page.tsx` but never written. The customer
 * had just paid and had no idea whether the order existed.
 *
 * This page finishes the transaction: it asks the provider to confirm the
 * payment, empties the cart, and hands over a tracking link.
 */

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@be-in-digital/restaurant"

type Outcome =
  | { state: "verifying" }
  | {
      state: "paid"
      orderId?: string
      orderNumber?: string
      viewToken?: string
      email?: string
    }
  | { state: "pending"; label: string }
  | { state: "failed"; message: string }

function CheckoutSuccessContent() {
  const params = useSearchParams()
  const clearCart = useCartStore((s) => s.clearCart)

  const orderId = params.get("orderId") ?? undefined
  // Stripe appends session_id; PayPal appends token; SumUp carries checkoutId.
  const sessionId = params.get("session_id") ?? undefined
  const paypalToken = params.get("token") ?? undefined
  const checkoutId = params.get("checkoutId") ?? undefined

  const verifyStripe = useAction(api.stripe.verifyCheckoutSession)
  const capturePayPal = useAction(api.paypal.capturePayPalOrder)
  const verifySumUp = useAction(api.sumup.verifyCheckout)

  const [outcome, setOutcome] = useState<Outcome>({ state: "verifying" })
  // Verification must run once: capturing a PayPal order twice is an error, and
  // React would otherwise re-run this on every render.
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    async function finish() {
      try {
        if (sessionId) {
          const result = await verifyStripe({ sessionId })
          settle(result.status, result)
        } else if (paypalToken && orderId) {
          const result = await capturePayPal({
            paypalOrderId: paypalToken,
            orderId: orderId as Id<"orders">,
          })
          settle(result.status, result)
        } else if (checkoutId && orderId) {
          const result = await verifySumUp({
            checkoutId,
            orderId: orderId as Id<"orders">,
          })
          settle(result.status, result)
        } else {
          // No provider reference to check — a cash order, or a manual visit.
          // The order exists; there is simply nothing to confirm here.
          setOutcome({ state: "paid", orderId })
          clearCart()
        }
      } catch (error) {
        setOutcome({
          state: "failed",
          message:
            error instanceof Error
              ? error.message
              : "La confirmation du paiement a échoué.",
        })
      }
    }

    function settle(
      status: string,
      result: {
        orderId?: string
        orderNumber?: string
        viewToken?: string
        email?: string
      }
    ) {
      if (status === "paid") {
        setOutcome({ state: "paid", ...result, orderId: result.orderId ?? orderId })
        // Only now: the basket must survive a failed or abandoned payment.
        clearCart()
      } else {
        setOutcome({ state: "pending", label: status })
      }
    }

    void finish()
  }, [
    sessionId,
    paypalToken,
    checkoutId,
    orderId,
    verifyStripe,
    capturePayPal,
    verifySumUp,
    clearCart,
  ])

  if (outcome.state === "verifying") {
    return (
      <Shell>
        <Loader2 className="mx-auto mb-8 h-12 w-12 animate-spin text-zinc-400" />
        <h1 className="mb-4 text-3xl font-black uppercase italic tracking-tighter text-zinc-800">
          Confirmation en cours
        </h1>
        <p className="text-lg text-zinc-500">
          Nous vérifions votre paiement. Ne fermez pas cette page.
        </p>
      </Shell>
    )
  }

  if (outcome.state === "failed") {
    return (
      <Shell tone="danger">
        <AlertTriangle className="mx-auto mb-8 h-12 w-12 text-red-500" />
        <h1 className="mb-4 text-3xl font-black uppercase italic tracking-tighter text-zinc-800">
          Confirmation impossible
        </h1>
        <p className="mb-2 text-lg text-zinc-500">{outcome.message}</p>
        <p className="mb-8 text-sm text-zinc-500">
          Si votre compte a été débité, contactez le restaurant avec le numéro de
          commande — la commande n&apos;a pas été perdue.
        </p>
        <Actions orderId={orderId} />
      </Shell>
    )
  }

  if (outcome.state === "pending") {
    return (
      <Shell>
        <Loader2 className="mx-auto mb-8 h-12 w-12 text-amber-500" />
        <h1 className="mb-4 text-3xl font-black uppercase italic tracking-tighter text-zinc-800">
          Paiement en attente
        </h1>
        <p className="mb-8 text-lg text-zinc-500">
          Votre banque n&apos;a pas encore confirmé le paiement (statut&nbsp;:{" "}
          {outcome.label}). La commande sera préparée dès réception.
        </p>
        <Actions orderId={orderId} />
      </Shell>
    )
  }

  // Only offer tracking when we hold a view token. `/order/[orderId]` without
  // one resolves to nothing for a guest, so the button would be a dead end for
  // exactly the people who need it most.
  const trackHref =
    outcome.orderId && outcome.viewToken
      ? `/order/${outcome.orderId}?token=${outcome.viewToken}`
      : undefined

  return (
    <Shell>
      <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-12 w-12" />
      </div>
      <h1 className="mb-4 text-4xl font-black uppercase italic tracking-tighter text-zinc-800">
        Commande <span className="not-italic text-orange-500">Confirmée</span>
      </h1>

      {(outcome.orderNumber ?? outcome.orderId) && (
        <div className="mb-6">
          <span className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-black uppercase leading-none tracking-widest text-zinc-500">
            Commande #
            {outcome.orderNumber ?? outcome.orderId?.slice(-6).toUpperCase()}
          </span>
        </div>
      )}

      <p className="mb-8 text-lg leading-relaxed text-zinc-500">
        Votre paiement a bien été reçu.
        {outcome.email && (
          <>
            {" "}
            Une confirmation part à{" "}
            <span className="font-bold text-zinc-800">{outcome.email}</span>.
          </>
        )}
      </p>

      <div className="flex flex-col justify-center gap-4 sm:flex-row">
        {trackHref && (
          <Link href={trackHref}>
            <Button className="h-14 rounded-2xl bg-[#0D5C3F] px-8 font-black uppercase tracking-widest text-white transition-all hover:bg-[#0A412D]">
              Suivre ma commande
            </Button>
          </Link>
        )}
        <Link href="/menu">
          <Button
            variant={trackHref ? "outline" : "default"}
            className={
              trackHref
                ? "h-14 rounded-2xl border-zinc-200 px-8 font-black uppercase tracking-widest transition-all"
                : "h-14 rounded-2xl bg-[#0D5C3F] px-8 font-black uppercase tracking-widest text-white transition-all hover:bg-[#0A412D]"
            }
          >
            Retour au menu
          </Button>
        </Link>
      </div>

      {trackHref && (
        <p className="mt-6 text-xs text-zinc-400">
          Gardez ce lien : c&apos;est le seul moyen de retrouver cette commande
          sans compte.
        </p>
      )}
    </Shell>
  )
}

function Actions({ orderId }: { orderId?: string }) {
  return (
    <div className="flex flex-col justify-center gap-4 sm:flex-row">
      {orderId && (
        <Link href={`/order/${orderId}`}>
          <Button className="h-14 rounded-2xl bg-[#0D5C3F] px-8 font-black uppercase tracking-widest text-white transition-all hover:bg-[#0A412D]">
            Voir la commande
          </Button>
        </Link>
      )}
      <Link href="/cart">
        <Button
          variant="outline"
          className="h-14 rounded-2xl border-zinc-200 px-8 font-black uppercase tracking-widest transition-all"
        >
          Retour au panier
        </Button>
      </Link>
    </div>
  )
}

function Shell({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: "neutral" | "danger"
}) {
  return (
    <div
      className={`min-h-screen px-4 pb-20 pt-32 ${
        tone === "danger" ? "bg-red-50/40" : "bg-zinc-50"
      }`}
    >
      <div className="mx-auto max-w-xl text-center">{children}</div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-zinc-400" />
        </Shell>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  )
}
