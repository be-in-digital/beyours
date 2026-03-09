"use client"

import { useState, useEffect } from "react"

export interface CooldownScreenProps {
  nextPlayAt: number
  storeName: string
  primaryColor?: string
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00"

  const totalSeconds = Math.ceil(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/**
 * Cooldown screen shown when the player has already played recently.
 * Displays a live countdown until nextPlayAt.
 */
export function CooldownScreen({
  nextPlayAt,
  storeName,
  primaryColor = "#000000",
}: CooldownScreenProps) {
  const [remaining, setRemaining] = useState(nextPlayAt - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = nextPlayAt - Date.now()
      setRemaining(diff)

      if (diff <= 0) {
        clearInterval(interval)
        // Reload the page to re-check
        window.location.reload()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [nextPlayAt])

  return (
    <div className="flex flex-col items-center justify-center text-center gap-6 p-8 min-h-screen">
      <div className="text-6xl">{"\u23F3"}</div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Vous avez déjà joué !
        </h2>
        <p className="text-white/70">
          Revenez chez <strong>{storeName}</strong> pour retenter votre chance dans :
        </p>
      </div>

      <div
        className="text-4xl font-mono font-bold px-8 py-4 rounded-2xl"
        style={{ backgroundColor: primaryColor, color: "#ffffff" }}
      >
        {formatTimeRemaining(remaining)}
      </div>

      <p className="text-white/50 text-sm">
        La page se rechargera automatiquement
      </p>
    </div>
  )
}
