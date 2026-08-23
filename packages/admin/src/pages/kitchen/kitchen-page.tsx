"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { Card, CardHeader, CardTitle } from "@be-in-digital/ui"
import { Skeleton } from "@be-in-digital/ui"
import { TicketCard } from "./ticket-card"
import { StationFilter } from "./station-filter"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { ResolvingStore } from "../../components/resolving-store"

type TicketStatus = "pending" | "in_progress" | "ready" | "completed"

const STATUS_CONFIG: Record<TicketStatus, { title: string; color: string }> = {
  pending: { title: "En attente", color: "bg-yellow-500" },
  in_progress: { title: "En cours", color: "bg-blue-500" },
  ready: { title: "Prêt", color: "bg-green-500" },
  completed: { title: "Terminé", color: "bg-gray-500" },
}

export function KitchenPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const tickets = useQuery(
    api.kitchenTickets.getByStore,
    storeId ? { storeId } : "skip"
  )

  const [selectedStation, setSelectedStation] = useState<string | null>(null)

  // Get unique stations from tickets
  const stations = useMemo(() => {
    if (!tickets) return []
    const stationSet = new Set<string>()
    tickets.forEach((ticket: any) => {
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
    return tickets.filter((ticket: any) => ticket.station === selectedStation)
  }, [tickets, selectedStation])

  // Group tickets by status
  const ticketsByStatus = useMemo(() => {
    if (!filteredTickets) return null

    return {
      pending: filteredTickets.filter((t: any) => t.status === "pending"),
      in_progress: filteredTickets.filter((t: any) => t.status === "in_progress"),
      ready: filteredTickets.filter((t: any) => t.status === "ready"),
      completed: filteredTickets.filter((t: any) => t.status === "completed"),
    }
  }, [filteredTickets])

  if (!storeId) return <ResolvingStore />

  return (
    <div className="space-y-6">
      {/* Station filter */}
      {stations.length > 0 && (
        <StationFilter
          stations={stations}
          selectedStation={selectedStation}
          onStationChange={setSelectedStation}
        />
      )}

      {/* Kanban board */}
      {!ticketsByStatus ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="kitchen-board">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="kitchen-board">
          {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map((status) => (
            <div key={status} className="space-y-4">
              {/* Column header */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {STATUS_CONFIG[status].title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded-full ${STATUS_CONFIG[status].color}`}
                      />
                      <span className="text-xs font-medium">
                        {ticketsByStatus[status].length}
                      </span>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Tickets */}
              <div className="space-y-3">
                {ticketsByStatus[status].length === 0 ? (
                  <Card>
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      Aucun ticket
                    </div>
                  </Card>
                ) : (
                  ticketsByStatus[status].map((ticket: any) => (
                    <TicketCard key={ticket._id} ticket={ticket} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
