"use client"

import { Suspense, useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAction } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@beindigital-engine/ui/components"
import { useCartStore } from "@beindigital-engine/restaurant"

type PaymentResult = {
  status: string
  orderId?: string
  orderNumber?: string
  viewToken?: string
  email?: string
  error?: string
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  )
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId") as Id<"orders"> | null
  const sessionId = searchParams.get("session_id")
  const paypalOrderId = searchParams.get("paypal_order_id")
  const paypalToken = searchParams.get("token") // PayPal passes token param
  const sumupCheckoutId = searchParams.get("sumup_checkout_id")

  const verifyStripe = useAction(api.stripe.verifyCheckoutSession)
  const capturePayPal = useAction(api.paypal.capturePayPalOrder)
  const verifySumUp = useAction(api.sumup.verifyCheckout)
  const clearCart = useCartStore((s) => s.clearCart)

  const [result, setResult] = useState<PaymentResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const verified = useRef(false)

  useEffect(() => {
    if (verified.current) return
    verified.current = true

    async function verify() {
      try {
        let res: PaymentResult | undefined

        if (sessionId) {
          // Stripe verification
          res = await verifyStripe({ sessionId }) as PaymentResult
        } else if ((paypalOrderId || paypalToken) && orderId) {
          // PayPal capture
          res = await capturePayPal({
            paypalOrderId: paypalOrderId ?? paypalToken!,
            orderId,
          }) as PaymentResult
        } else if (sumupCheckoutId && orderId) {
          // SumUp verification
          res = await verifySumUp({
            checkoutId: sumupCheckoutId,
            orderId,
          }) as PaymentResult
        } else {
          setError("Paramètres de paiement manquants.")
          setLoading(false)
          return
        }

        if (res.status === "paid") {
          clearCart()
        }
        setResult(res)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Erreur lors de la vérification du paiement."
        )
      } finally {
        setLoading(false)
      }
    }

    verify()
  }, [sessionId, paypalOrderId, paypalToken, sumupCheckoutId, orderId, verifyStripe, capturePayPal, verifySumUp, clearCart])

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
          </div>
          <h1 className="mb-4 text-3xl font-black uppercase italic tracking-tighter text-zinc-800">
            Vérification{" "}
            <span className="not-italic text-orange-500">en cours</span>
          </h1>
          <p className="text-lg text-zinc-500">
            Nous vérifions votre paiement, veuillez patienter...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || (result && result.status !== "paid")) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-rose-100 text-rose-500">
            <XCircle className="h-12 w-12" />
          </div>
          <h1 className="mb-4 text-3xl font-black uppercase italic tracking-tighter text-zinc-800">
            Paiement{" "}
            <span className="not-italic text-rose-500">non confirmé</span>
          </h1>
          <p className="mb-8 text-lg text-zinc-500">
            {error ??
              "Le paiement n'a pas pu être confirmé. Si le montant a été débité, veuillez contacter le restaurant."}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/checkout">
              <Button className="h-14 rounded-2xl bg-[#0D5C3F] px-8 font-black uppercase tracking-widest text-white hover:bg-[#0A412D]">
                Réessayer
              </Button>
            </Link>
            <Link href="/menu">
              <Button
                variant="outline"
                className="h-14 rounded-2xl border-zinc-200 px-8 font-black uppercase tracking-widest"
              >
                Retour au menu
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-12 w-12" />
        </div>

        <h1 className="mb-4 text-4xl font-black uppercase italic tracking-tighter text-zinc-800">
          Commande{" "}
          <span className="not-italic text-orange-500">Confirmée</span>
        </h1>

        {result?.orderNumber && (
          <div className="mb-6">
            <span className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-black uppercase tracking-widest leading-none text-zinc-500">
              Commande #{result.orderNumber}
            </span>
          </div>
        )}

        <p className="mb-8 text-lg leading-relaxed text-zinc-500">
          Votre paiement a été accepté et votre commande est en cours de
          préparation.
          {result?.email && (
            <>
              {" "}
              Vous recevrez une confirmation à{" "}
              <span className="font-bold text-zinc-800">{result.email}</span>.
            </>
          )}
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          {result?.orderId && result.viewToken && (
            <Link
              href={`/order/${result.orderId}?token=${result.viewToken}`}
            >
              <Button className="group h-14 rounded-2xl bg-[#0D5C3F] px-8 font-black uppercase tracking-widest text-white hover:bg-[#0A412D]">
                Suivre ma commande
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          )}
          <Link href="/menu">
            <Button
              variant="outline"
              className="h-14 rounded-2xl border-zinc-200 px-8 font-black uppercase tracking-widest"
            >
              Retour au menu
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
