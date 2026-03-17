"use client"

import { useEffect, useReducer } from "react"
import { CheckCircle, Clock, PartyPopper } from "lucide-react"

interface TrackingCountdownProps {
  estimatedReadyAt?: number
  status: string
}

function computeRemaining(estimatedReadyAt: number | undefined, status: string): number | null {
  if (!estimatedReadyAt || status === "ready" || status === "completed") return null
  return Math.max(0, estimatedReadyAt - Date.now())
}

export function TrackingCountdown({
  estimatedReadyAt,
  status,
}: TrackingCountdownProps) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    if (!estimatedReadyAt || status === "ready" || status === "completed") return

    const id = setInterval(() => {
      if (estimatedReadyAt - Date.now() <= 0) {
        clearInterval(id)
      }
      forceUpdate()
    }, 1000)
    return () => clearInterval(id)
  }, [estimatedReadyAt, status])

  const remaining = computeRemaining(estimatedReadyAt, status)

  if (status === "ready") {
    return (
      <div className="rounded-[2rem] bg-[#0D5C3F] p-8 text-center shadow-xl shadow-emerald-900/10">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-white/20 backdrop-blur-md p-3">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
        </div>
        <p className="text-2xl font-black text-white tracking-tight">
          Votre commande est prête !
        </p>
        <p className="text-sm text-white/60 mt-2 font-medium">
          Présentez-vous au comptoir pour la récupérer
        </p>
      </div>
    )
  }

  if (status === "completed") {
    return (
      <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 text-center shadow-2xl shadow-black/[0.04]">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-zinc-100 p-3">
            <PartyPopper className="h-8 w-8 text-[#0D5C3F]" />
          </div>
        </div>
        <p className="text-2xl font-black text-zinc-900 tracking-tight">
          Commande terminée
        </p>
        <p className="text-sm text-zinc-400 mt-2 font-medium">
          Merci pour votre visite !
        </p>
      </div>
    )
  }

  if (remaining === null) {
    return null
  }

  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)

  return (
    <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 text-center shadow-2xl shadow-black/[0.04]">
      <div className="flex justify-center mb-4">
        <div className="rounded-full bg-orange-100 p-3">
          <Clock className="h-8 w-8 text-[#F97316]" />
        </div>
      </div>
      <p className="text-zinc-400 font-bold uppercase tracking-widest text-[10px] mb-3">
        Temps estimé restant
      </p>
      <p className="text-5xl font-black text-[#0D5C3F] tabular-nums font-mono tracking-tight">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </p>
    </div>
  )
}
