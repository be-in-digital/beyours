"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation } from "convex/react"
import { useAdminApiStore } from "../../stores/admin-api-store"
import type { KitchenTicket } from "../../lib/types"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { Card, CardHeader, CardTitle } from "@be-in-digital/ui"
import { Skeleton } from "@be-in-digital/ui"
import { Empty, EmptyHeader, EmptyTitle } from "@be-in-digital/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@be-in-digital/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@be-in-digital/ui"
import { toast } from "sonner"
import { TicketCard } from "./ticket-card"
import { StationFilter } from "./station-filter"
import { resolveSoundConfig } from "../../lib/kitchen-alerts"
import { KitchenSoundManager } from "./kitchen-sound-manager"
import { KitchenPrintTrigger } from "./kitchen-print-trigger"
import { PrintStatusBadge } from "./print-status-badge"
import { CompletedTickets } from "./completed-tickets"
import { ResolvingStore } from "../../components/resolving-store"

type ActiveStatus = "pending" | "in_progress" | "ready"

const ACTIVE_STATUSES: ActiveStatus[] = ["pending", "in_progress", "ready"]

const STATUS_CONFIG: Record<ActiveStatus, { title: string; color: string }> = {
  pending: { title: "En attente", color: "bg-yellow-500" },
  in_progress: { title: "En cours", color: "bg-blue-500" },
  ready: { title: "Prêt", color: "bg-green-500" },
}

interface KitchenPageProps {
  /**
   * Rendered beside the page title.
   *
   * `apps/reference` puts its kitchen seeder there. The engine has no business
   * knowing about a test-bench button, and the test bench has no business
   * re-implementing the screen to host one.
   */
  headerAction?: React.ReactNode
}

/**
 * The kitchen display, and the only copy of it.
 *
 * It lived in `apps/reference/components/admin/kitchen/` and, byte for byte,
 * in `apps/themes/` — while this package exported a third, older `KitchenPage`
 * that nothing rendered: no order-mode control, no completed tab, no sound, no
 * print trigger, and a four-column board for three statuses. `mcp-server`
 * advertised that one to client builds. The live screen is now here, and both
 * apps render it.
 */
export function KitchenPage({ headerAction }: KitchenPageProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const tickets = useQuery(
    api.kitchenTickets.getByStore,
    storeId ? { storeId } : "skip"
  ) as KitchenTicket[] | undefined
  const store = useQuery(api.stores.getById, storeId ? { id: storeId } : "skip")
  const updateStoreOrderMode = useMutation(api.stores.updateOrderMode)

  const [selectedStation, setSelectedStation] = useState<string | null>(null)

  // Resolve current order mode: store.orderMode or fallback to "manual"
  const currentOrderMode = store?.orderMode ?? "manual"

  const handleOrderModeChange = async (value: string) => {
    if (!storeId) return
    try {
      await updateStoreOrderMode({
        id: storeId,
        orderMode: value as "auto_accept" | "auto_reject" | "manual",
      })
      const labels: Record<string, string> = {
        auto_accept: "Auto-accept",
        auto_reject: "Auto-reject",
        manual: "Manuel",
      }
      toast.success(`Mode commandes: ${labels[value]}`)
    } catch (error) {
      toast.error("Échec de la mise à jour")
      console.error(error)
    }
  }

  // Get unique stations from tickets
  const stations = useMemo(() => {
    if (!tickets) return []
    const stationSet = new Set<string>()
    tickets.forEach((ticket: KitchenTicket) => {
      if (ticket.station) {
        stationSet.add(ticket.station)
      }
    })
    return Array.from(stationSet)
  }, [tickets])

  // Filter tickets by station if selected
  const filteredTickets = useMemo(() => {
    if (!tickets) return null
    if (!selectedStation) return tickets
    return tickets.filter((ticket: KitchenTicket) => ticket.station === selectedStation)
  }, [tickets, selectedStation])

  // Group tickets by status
  const ticketsByStatus = useMemo(() => {
    if (!filteredTickets) return null

    return {
      pending: filteredTickets.filter((t: KitchenTicket) => t.status === "pending"),
      in_progress: filteredTickets.filter((t: KitchenTicket) => t.status === "in_progress"),
      ready: filteredTickets.filter((t: KitchenTicket) => t.status === "ready"),
    }
  }, [filteredTickets])

  // `StoreGuard` does not render a page before a store is selected, so the
  // only way here is the frame before the selection is read back.
  if (!storeId) return <ResolvingStore />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cuisine (KDS)</h1>
          <p className="text-muted-foreground">
            Écran de gestion des tickets cuisine en temps réel
          </p>
        </div>
        {headerAction}
      </div>

      {/* KDS singletons */}
      {store && (
        <>
          <KitchenSoundManager
            storeId={storeId!}
            // Resolved rather than defaulted whole: an establishment
            // configured before an alert existed carries only the alerts it
            // knew about, and reading `undefined.enabled` here would take the
            // kitchen screen down.
            soundConfig={resolveSoundConfig(store.soundConfig)}
            ticketCount={tickets?.length}
          />
          {store.printConfig?.enabled && (
            <KitchenPrintTrigger
              storeId={storeId!}
              printConfig={store.printConfig}
              storeName={store.name}
              onToast={(msg, type) => {
                if (type === "error") toast.error(msg)
                else if (type === "success") toast.success(msg)
                else toast.info(msg)
              }}
            />
          )}
        </>
      )}

      {/* Station filter + controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {stations.length > 0 && (
            <StationFilter
              stations={stations}
              selectedStation={selectedStation}
              onStationChange={setSelectedStation}
            />
          )}
        </div>
        <div className="flex items-center gap-4">
          <Select value={currentOrderMode} onValueChange={handleOrderModeChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_accept">Auto-accept</SelectItem>
              <SelectItem value="auto_reject">Auto-reject</SelectItem>
              <SelectItem value="manual">Manuel</SelectItem>
            </SelectContent>
          </Select>
          {storeId && <PrintStatusBadge storeId={storeId} />}
        </div>
      </div>

      {/* Tabs: active / completed */}
      <Tabs defaultValue="active">
        <TabsList variant="line">
          <TabsTrigger value="active">Actif</TabsTrigger>
          <TabsTrigger value="completed">Terminées</TabsTrigger>
        </TabsList>

        {/* Active kanban */}
        <TabsContent value="active" className="mt-4">
          {!ticketsByStatus ? (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              data-tour="kitchen-board"
            >
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ))}
            </div>
          ) : (
            // The guided tour anchors its KDS step here
            // (`components/onboarding/tour-steps.ts`). The attribute existed
            // only on the packaged board nothing rendered, so the step has been
            // anchorless on the live screen; it is on the live screen now.
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              data-tour="kitchen-board"
            >
              {ACTIVE_STATUSES.map((status) => (
                <div key={status} className="space-y-4">
                  {/* Column header */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {STATUS_CONFIG[status].title}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-3 w-3 rounded-full ${STATUS_CONFIG[status].color}`}
                          />
                          <span className="text-sm font-medium">
                            {ticketsByStatus[status].length}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Tickets */}
                  <div className="space-y-3">
                    {ticketsByStatus[status].length === 0 ? (
                      <Empty className="py-8">
                        <EmptyHeader>
                          <EmptyTitle>Aucun ticket</EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                    ) : (
                      ticketsByStatus[status].map((ticket: KitchenTicket) => (
                        <TicketCard key={ticket._id} ticket={ticket} />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Completed tickets */}
        <TabsContent value="completed" className="mt-4">
          <CompletedTickets storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
