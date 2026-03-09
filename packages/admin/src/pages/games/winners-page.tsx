"use client"

import { useQuery } from "convex/react"
import { TrophyIcon } from "lucide-react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@beindigital-engine/ui"
import { LoadingState } from "../../components/loading-state"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { GamePlaysTable } from "./game-plays-table"
import { RedemptionsTable } from "./redemptions-table"

export function WinnersPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const gamePlays = useQuery(api.gamePlays.list, storeId ? { storeId } : "skip") as any[] | undefined
  const redemptions = useQuery(api.prizeRedemptions.list, storeId ? { storeId } : "skip") as any[] | undefined
  const games = useQuery(api.games.list, storeId ? { storeId } : "skip") as any[] | undefined
  const prizes = useQuery(api.prizes.list, storeId ? { storeId } : "skip") as any[] | undefined

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TrophyIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Veuillez sélectionner un établissement pour voir les gagnants</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (gamePlays === undefined || redemptions === undefined || games === undefined || prizes === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Gagnants</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historique des parties et gestion des lots
        </p>
      </div>

      <Tabs defaultValue="plays" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plays">Parties ({gamePlays.length})</TabsTrigger>
          <TabsTrigger value="redemptions">Lots ({redemptions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plays">
          <GamePlaysTable plays={gamePlays} games={games} prizes={prizes} />
        </TabsContent>

        <TabsContent value="redemptions">
          <RedemptionsTable redemptions={redemptions} prizes={prizes} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
