"use client"

import { useQuery } from "convex/react"
import { GamepadIcon, TrophyIcon, TargetIcon, GiftIcon } from "lucide-react"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  Badge,
} from "@beindigital-engine/ui"
import { LoadingState } from "../../components/loading-state"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"

export function GamesDashboardPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const stats = useQuery(api.gamePlays.stats, storeId ? { storeId } : "skip") as { totalPlays: number; totalWins: number; winRate: number } | undefined
  const games = useQuery(api.games.list, storeId ? { storeId } : "skip") as any[] | undefined
  const gamePlays = useQuery(api.gamePlays.list, storeId ? { storeId } : "skip") as any[] | undefined
  const redemptions = useQuery(api.prizeRedemptions.list, storeId ? { storeId, status: "claimed" as const } : "skip") as any[] | undefined
  const prizes = useQuery(api.prizes.list, storeId ? { storeId } : "skip") as any[] | undefined

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GamepadIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Veuillez sélectionner un établissement pour voir le tableau de bord</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (stats === undefined || games === undefined || gamePlays === undefined || redemptions === undefined || prizes === undefined) {
    return <LoadingState />
  }

  const activeGames = games.filter((g: any) => g.isActive).length
  const pendingRedemptions = redemptions.length

  // Last 10 winners
  const recentWinners = gamePlays
    .filter((p: any) => p.didWin)
    .slice(0, 10)

  const gameMap = new Map(games.map((g: any) => [g._id, g.name]))
  const prizeMap = new Map(prizes.map((p: any) => [p._id, p.name]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d'ensemble de la gamification
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="border border-border/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GamepadIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Total parties</span>
          </div>
          <p className="text-2xl font-semibold">{stats.totalPlays}</p>
        </div>
        <div className="border border-border/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TargetIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Taux de victoire</span>
          </div>
          <p className="text-2xl font-semibold">{stats.winRate}%</p>
        </div>
        <div className="border border-border/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrophyIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Jeux actifs</span>
          </div>
          <p className="text-2xl font-semibold">{activeGames}</p>
        </div>
        <div className="border border-border/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GiftIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Lots en attente</span>
          </div>
          <p className="text-2xl font-semibold">{pendingRedemptions}</p>
        </div>
      </div>

      {/* Recent winners */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Derniers gagnants</h2>
        {recentWinners.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Aucun gagnant pour le moment</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Joueur</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Jeu</th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Prix</th>
                </tr>
              </thead>
              <tbody>
                {recentWinners.map((play: any) => (
                  <tr key={play._id} className="border-b border-border/30">
                    <td className="py-3 px-2 text-xs">
                      {new Date(play.playedAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-2 text-xs">
                      {play.playerFirstName || play.playerEmail || "Anonyme"}
                    </td>
                    <td className="py-3 px-2 text-xs">{gameMap.get(play.gameId) ?? "—"}</td>
                    <td className="py-3 px-2 text-xs">
                      {play.prizeId ? (
                        <Badge variant="outline" className="text-xs">{prizeMap.get(play.prizeId) ?? "—"}</Badge>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
