"use client"

import { useMutation } from "convex/react"
import { toast } from "sonner"
import { useState } from "react"
import { CheckCircleIcon, XCircleIcon } from "lucide-react"
import { Button, Badge } from "@beindigital-engine/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"

interface PrizeRedemption {
  _id: string
  playerFirstName?: string
  playerLastName?: string
  playerEmail?: string
  redemptionCode: string
  status: "pending" | "claimed" | "redeemed" | "expired" | "cancelled"
  redeemedAt?: number
  redeemedBy?: string
  expiresAt: number
  createdAt: number
  prizeId: string
}

interface Prize {
  _id: string
  name: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  claimed: "Réclamé",
  redeemed: "Échangé",
  expired: "Expiré",
  cancelled: "Annulé",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  claimed: "default",
  redeemed: "secondary",
  expired: "destructive",
  cancelled: "destructive",
}

interface RedemptionsTableProps {
  redemptions: PrizeRedemption[]
  prizes: Prize[]
}

export function RedemptionsTable({ redemptions, prizes }: RedemptionsTableProps) {
  const { api } = useAdminApiStore()
  const prizeMap = new Map(prizes.map((p) => [p._id, p.name]))
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const markRedeemed = useMutation(api.prizeRedemptions.markRedeemed)
  const markExpired = useMutation(api.prizeRedemptions.markExpired)

  const handleMarkRedeemed = async (id: string) => {
    setLoadingId(id)
    try {
      await markRedeemed({ id })
      toast.success("Lot marqué comme échangé")
    } catch (error: unknown) {
      toast.error("Échec du marquage")
      console.error(error)
    } finally {
      setLoadingId(null)
    }
  }

  const handleMarkExpired = async (id: string) => {
    setLoadingId(id)
    try {
      await markExpired({ id })
      toast.success("Lot marqué comme expiré")
    } catch (error: unknown) {
      toast.error("Échec du marquage")
      console.error(error)
    } finally {
      setLoadingId(null)
    }
  }

  if (redemptions.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Aucun lot</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Joueur</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Prix</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Code</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Statut</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Expire</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {redemptions.map((r) => (
            <tr key={r._id} className="border-b border-border/30">
              <td className="py-3 px-2 text-xs">
                {new Date(r.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </td>
              <td className="py-3 px-2 text-xs">
                {[r.playerFirstName, r.playerLastName].filter(Boolean).join(" ") || r.playerEmail || "—"}
              </td>
              <td className="py-3 px-2 text-xs">{prizeMap.get(r.prizeId) ?? "—"}</td>
              <td className="py-3 px-2">
                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{r.redemptionCode}</code>
              </td>
              <td className="py-3 px-2">
                <Badge variant={STATUS_VARIANTS[r.status] ?? "outline"} className="text-xs">
                  {STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </td>
              <td className="py-3 px-2 text-xs">
                {new Date(r.expiresAt).toLocaleDateString("fr-FR")}
              </td>
              <td className="py-3 px-2 text-right">
                {r.status === "claimed" && (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRedeemed(r._id)}
                      disabled={loadingId === r._id}
                      title="Marquer comme échangé (le client a présenté son code)"
                    >
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      Réclamer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkExpired(r._id)}
                      disabled={loadingId === r._id}
                    >
                      <XCircleIcon className="h-4 w-4 mr-1" />
                      Expirer
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
