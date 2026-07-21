"use client"

import { useState } from "react"
import { REDEMPTION_STATUS_CONFIG } from "../../lib/vocabulary"
import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import {
  TrophyIcon,
  TicketCheckIcon,
  Gamepad2Icon,
  PercentIcon,
  ScanLineIcon,
  Loader2Icon,
} from "lucide-react"
import { Badge, Button, Input, Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@be-in-digital/ui"
import { LoadingState } from "../../components/loading-state"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"

/**
 * Winners dashboard: play/win stats, redemption list, and the staff
 * validation input (type or scan a redemption code to mark it used).
 */

interface Stats {
  totalPlays: number
  totalWins: number
  winRate: number
  totalRedeemed: number
  pendingRedemptions: number
}

interface Redemption {
  id: string
  code: string
  status: "pending" | "claimed" | "redeemed" | "expired" | "cancelled"
  playerName?: string
  playerEmail?: string
  prizeName?: string
  expiresAt: number
  redeemedAt?: number
  redeemedBy?: string
  createdAt: number
}


function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function GameWinnersPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const [codeInput, setCodeInput] = useState("")
  const [isRedeeming, setIsRedeeming] = useState(false)

  const stats = useQuery(
    api.prizeRedemptions.getStats,
    storeId ? { storeId } : "skip"
  ) as Stats | undefined
  const redemptions = useQuery(
    api.prizeRedemptions.listRedemptions,
    storeId ? { storeId } : "skip"
  ) as Redemption[] | undefined

  const redeemByCode = useMutation(api.prizeRedemptions.redeemByCode)

  const handleRedeem = async () => {
    const code = codeInput.trim().toUpperCase()
    if (!code) {
      toast.error("Saisissez un code")
      return
    }
    setIsRedeeming(true)
    try {
      await redeemByCode({ code })
      toast.success(`Lot ${code} validé !`)
      setCodeInput("")
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      if (message.includes("REDEMPTION_NOT_FOUND")) toast.error("Code introuvable")
      else if (message.includes("ALREADY_REDEEMED")) toast.error("Ce lot a déjà été utilisé")
      else if (message.includes("REDEMPTION_EXPIRED")) toast.error("Ce lot a expiré")
      else if (message.includes("REDEMPTION_CANCELLED")) toast.error("Ce lot a été annulé")
      else toast.error("Validation impossible")
      console.error(error)
    } finally {
      setIsRedeeming(false)
    }
  }

  if (!storeId) {
    return (
      <Empty className="min-h-[400px]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TrophyIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Sélectionnez un établissement pour voir les gagnants</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (stats === undefined || redemptions === undefined) {
    return <LoadingState />
  }

  const statCards = [
    { label: "Parties jouées", value: stats.totalPlays, icon: Gamepad2Icon },
    { label: "Victoires", value: stats.totalWins, icon: TrophyIcon },
    { label: "Taux de gain réel", value: `${stats.winRate}%`, icon: PercentIcon },
    { label: "Lots utilisés", value: stats.totalRedeemed, icon: TicketCheckIcon },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Gagnants</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historique des lots gagnés et validation en caisse
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="border border-border/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Staff validation */}
      <div className="border border-border/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ScanLineIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Valider un lot</h2>
          {stats.pendingRedemptions > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {stats.pendingRedemptions} en attente
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Saisissez le code du client (ou scannez son QR code, qui ouvre la page de validation).
        </p>
        <div className="flex gap-2">
          <Input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && void handleRedeem()}
            placeholder="Ex : K7NP2XWQ"
            className="font-mono uppercase tracking-widest"
            maxLength={12}
          />
          <Button onClick={() => void handleRedeem()} disabled={isRedeeming}>
            {isRedeeming ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Valider"}
          </Button>
        </div>
      </div>

      {/* Redemptions list */}
      {redemptions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrophyIcon />
            </EmptyMedia>
            <EmptyTitle>Aucun gagnant pour le moment</EmptyTitle>
            <EmptyDescription>
              Les lots gagnés par vos clients apparaîtront ici
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="border border-border/50 rounded-lg divide-y divide-border/50">
          {redemptions.map((redemption) => {
            const status = REDEMPTION_STATUS_CONFIG[redemption.status]
            return (
              <div
                key={redemption.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4"
              >
                <span className="font-mono text-sm font-semibold tracking-wider">
                  {redemption.code}
                </span>
                <Badge variant="outline" className={status.className}>
                  {status.label}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {redemption.prizeName ?? "Lot"}
                    {redemption.playerName && (
                      <span className="text-muted-foreground"> — {redemption.playerName}</span>
                    )}
                  </p>
                  {redemption.playerEmail && (
                    <p className="truncate text-xs text-muted-foreground">
                      {redemption.playerEmail}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Gagné le {formatDate(redemption.createdAt)}</p>
                  {redemption.status === "redeemed" && redemption.redeemedAt ? (
                    <p>Utilisé le {formatDate(redemption.redeemedAt)}</p>
                  ) : (
                    <p>Expire le {formatDate(redemption.expiresAt)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
