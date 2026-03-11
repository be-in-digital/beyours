"use client"

import { useEffect, useState } from "react"

interface TrackingCountdownProps {
  estimatedReadyAt?: number
  status: string
}

export function TrackingCountdown({
  estimatedReadyAt,
  status,
}: TrackingCountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!estimatedReadyAt || status === "ready" || status === "completed") {
      setRemaining(null)
      return
    }

    const update = () => {
      const diff = estimatedReadyAt - Date.now()
      setRemaining(Math.max(0, diff))
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [estimatedReadyAt, status])

  if (status === "ready") {
    return (
      <div className="bg-green-50 rounded-2xl p-6 text-center">
        <p className="text-2xl font-bold text-green-700">
          Votre commande est prete !
        </p>
        <p className="text-sm text-green-600 mt-1">
          Presentez-vous au comptoir pour la recuperer
        </p>
      </div>
    )
  }

  if (status === "completed") {
    return (
      <div className="bg-gray-50 rounded-2xl p-6 text-center">
        <p className="text-xl font-bold text-gray-700">
          Commande terminee
        </p>
        <p className="text-sm text-gray-500 mt-1">
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
    <div className="bg-amber-50 rounded-2xl p-6 text-center">
      <p className="text-sm text-amber-600 font-medium mb-2">
        Temps estime restant
      </p>
      <p className="text-4xl font-bold text-amber-700 tabular-nums font-mono">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </p>
    </div>
  )
}
