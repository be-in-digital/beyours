"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { GameFlow } from "@beindigital-engine/restaurant"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

const FINGERPRINT_KEY = "beid_gam_fp"

function getFingerprint(devMode: boolean): string {
  if (typeof window === "undefined") return ""
  // In dev mode, generate a fresh fingerprint each time to bypass cooldown
  if (devMode) return crypto.randomUUID()
  let fp = localStorage.getItem(FINGERPRINT_KEY)
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem(FINGERPRINT_KEY, fp)
  }
  return fp
}

export function GameClient({ storeSlug }: { storeSlug: string }) {
  const searchParams = useSearchParams()
  const devMode = searchParams.get("dev") === "true"
  const gameTypeRaw = searchParams.get("game")
  const gameTypeParam = gameTypeRaw === "wheel" || gameTypeRaw === "scratch_card" ? gameTypeRaw : null
  const [fingerprint, setFingerprint] = useState("")

  useEffect(() => {
    setFingerprint(getFingerprint(devMode))
  }, [devMode])

  // Fetch game data — optionally filter by game type via ?game=wheel or ?game=scratch_card
  const gameData = useQuery(api.gamification.getGameByStoreSlug, {
    storeSlug,
    ...(gameTypeParam ? { gameType: gameTypeParam } : {}),
  })

  // Fetch cooldown status (only when we have storeId and fingerprint)
  const cooldownResult = useQuery(
    api.gamification.checkCooldown,
    gameData?.store?._id && fingerprint
      ? {
          storeId: gameData.store._id,
          fingerprint,
          cooldownHours: gameData.settings.cooldownHours,
        }
      : "skip"
  )

  // Mutations
  const spinMutation = useMutation(api.gamification.spin)
  const claimMutation = useMutation(api.gamification.claimPrize)

  const handleSpin = async (args: {
    gameId: string
    storeId: string
    fingerprint: string
    completedActions: string[]
  }) => {
    const result = await spinMutation({
      gameId: args.gameId as any,
      storeId: args.storeId as any,
      fingerprint: args.fingerprint,
      completedActions: args.completedActions,
    })
    return result
  }

  const handleClaimPrize = async (args: {
    redemptionId: string
    firstName: string
    lastName: string
    email: string
    phone?: string
  }) => {
    const result = await claimMutation({
      redemptionId: args.redemptionId as any,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
    })
    return result
  }

  return (
    <GameFlow
      gameData={gameData ?? undefined}
      cooldownResult={cooldownResult ?? undefined}
      fingerprint={fingerprint}
      onSpin={handleSpin}
      onClaimPrize={handleClaimPrize}
      isLoading={gameData === undefined}
    />
  )
}
