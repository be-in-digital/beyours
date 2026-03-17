"use client"

import { Suspense, useEffect, useState, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { CreditCard, Loader2, ArrowLeft, ShieldCheck } from "lucide-react"
import { Button } from "@beindigital-engine/ui/components"

declare global {
  interface Window {
    SumUpCard?: {
      mount: (options: {
        id: string
        checkoutId: string
        onResponse: (type: string, body: any) => void
        onLoad?: () => void
      }) => { unmount: () => void }
    }
  }
}

export default function CheckoutPayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <CheckoutPayContent />
    </Suspense>
  )
}

function CheckoutPayContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get("orderId")
  const checkoutId = searchParams.get("checkoutId")

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const mounted = useRef(false)
  const widgetRef = useRef<{ unmount: () => void } | null>(null)

  const handleResponse = useCallback(
    (type: string, body: any) => {
      if (type === "success" || body?.status === "PAID") {
        setProcessing(false)
        router.push(
          `/checkout/success?orderId=${orderId}&sumup_checkout_id=${checkoutId}`
        )
      } else if (type === "error" || type === "invalid") {
        setProcessing(false)
        setError(body?.message ?? "Le paiement a échoué. Veuillez réessayer.")
      } else if (type === "sent") {
        setProcessing(true)
      }
    },
    [orderId, checkoutId, router]
  )

  useEffect(() => {
    if (mounted.current || !checkoutId) return
    mounted.current = true

    // Load SumUp Card SDK from CDN
    const script = document.createElement("script")
    script.src = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js"
    script.async = true
    script.onload = () => {
      if (window.SumUpCard) {
        widgetRef.current = window.SumUpCard.mount({
          id: "sumup-card-widget",
          checkoutId,
          onLoad: () => setLoading(false),
          onResponse: handleResponse,
        })
      }
    }
    script.onerror = () => {
      setLoading(false)
      setError("Impossible de charger le module de paiement.")
    }
    document.head.appendChild(script)

    return () => {
      widgetRef.current?.unmount()
    }
  }, [checkoutId, handleResponse])

  if (!orderId || !checkoutId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
        <p className="text-lg text-zinc-500">Paramètres de paiement manquants.</p>
        <Link href="/checkout" className="mt-4">
          <Button className="h-14 rounded-2xl bg-[#0D5C3F] px-8 font-black uppercase tracking-widest text-white hover:bg-[#0A412D]">
            Retour au checkout
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 pb-20 pt-32">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <Link
          href="/checkout"
          className="group mb-6 inline-flex items-center text-sm font-bold uppercase tracking-widest text-zinc-400 transition-colors hover:text-[#0D5C3F]"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Retour
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-zinc-800">
            Paiement{" "}
            <span className="not-italic text-orange-500">par carte</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Entrez vos informations de carte pour finaliser votre commande.
          </p>
        </div>

        {/* Card Widget Container */}
        <div className="rounded-[2rem] border border-zinc-100 bg-white p-8 shadow-xl shadow-black/[0.03]">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Informations de carte
            </span>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          )}

          {/* SumUp Card Widget mounts here */}
          <div
            id="sumup-card-widget"
            className={loading ? "hidden" : ""}
          />

          {processing && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Traitement en cours...
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 p-4 text-center text-sm font-medium text-rose-600">
              {error}
            </div>
          )}
        </div>

        {/* Security badge */}
        <div className="mt-6 flex items-center gap-4 rounded-[2rem] border border-emerald-100 bg-emerald-50 p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-950">
              Paiement 100% Sécurisé
            </p>
            <p className="text-xs text-emerald-900/60">
              Vos informations sont cryptées via SumUp.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
