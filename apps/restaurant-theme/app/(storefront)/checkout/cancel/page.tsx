"use client"

import Link from "next/link"
import { XCircle, ArrowLeft, ShoppingBag } from "lucide-react"
import { Button } from "@beindigital-engine/ui/components"

export default function CheckoutCancelPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-orange-100 text-orange-500">
          <XCircle className="h-12 w-12" />
        </div>

        <h1 className="mb-4 text-4xl font-black uppercase italic tracking-tighter text-zinc-800">
          Paiement{" "}
          <span className="not-italic text-orange-500">Annulé</span>
        </h1>

        <p className="mb-8 text-lg leading-relaxed text-zinc-500">
          Votre paiement a été annulé. Aucun montant n&apos;a été débité.
          Votre panier est toujours disponible.
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/checkout">
            <Button className="group h-14 rounded-2xl bg-[#0D5C3F] px-8 font-black uppercase tracking-widest text-white hover:bg-[#0A412D]">
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Réessayer
            </Button>
          </Link>
          <Link href="/menu">
            <Button
              variant="outline"
              className="h-14 rounded-2xl border-zinc-200 px-8 font-black uppercase tracking-widest"
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              Retour au menu
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
