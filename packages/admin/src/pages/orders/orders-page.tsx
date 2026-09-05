"use client"

import { useMemo, useState } from "react"
import { usePaginatedQuery } from "convex/react"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { Tabs, TabsContent, TabsList, TabsTrigger, SearchInput, Button } from "@be-in-digital/ui"
import { OrdersTable } from "./orders-table"
import { ADMIN_PAGE_SIZE } from "../../lib/constants"
import { ResolvingStore } from "../../components/resolving-store"
import type { Order, OrderStatus } from "../../lib/types"

/**
 * Order status filter type (includes "all" for no-filter)
 */
type OrderStatusFilter = "all" | OrderStatus

/**
 * Main content component for orders list page
 * Displays orders in tabs filtered by status with search functionality
 *
 * `usePaginatedQuery` needs a real function reference on its first render and
 * `api` is injected by the admin layout a render later, so the query lives in a
 * child that is not mounted until there is something to query with — the same
 * shape `MessagesPage` uses.
 */
export function OrdersPage() {
  const storeId = useAdminStoreId()
  const api = useAdminApiStore((s) => s.api)

  if (!storeId || !api) return <ResolvingStore />

  return <OrdersList api={api} storeId={storeId} />
}

function OrdersList({
  api,
  storeId,
}: {
  // The Convex API is injected at runtime and has no static type here.
  api: any
  storeId: string
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeStatus, setActiveStatus] = useState<OrderStatusFilter>("all")

  /**
   * One page of orders, narrowed by status on the server.
   *
   * This screen used to subscribe to every order the establishment had ever
   * taken and do both the filtering and the paging in the browser. Measured on
   * a seeded store: 5,000 rows and 3.07 MB per load, on a live subscription
   * that re-sent all of it whenever a new order arrived — and past Convex's
   * 16,384-document transaction limit the screen would simply have stopped
   * loading. The status tabs are an equality the schema indexes, so each tab
   * now reads the page it shows.
   */
  const { results, status, loadMore } = usePaginatedQuery(
    api.orders.list,
    activeStatus === "all" ? { storeId } : { storeId, status: activeStatus },
    { initialNumItems: ADMIN_PAGE_SIZE }
  )

  const orders = results as Order[]

  /**
   * Search narrows the orders already loaded, not the whole table.
   *
   * `orderNumber` and the customer's name are not indexed and a substring match
   * cannot use an index anyway, so a server-side search would be the full scan
   * this screen was just rescued from. "Charger plus" widens what the search
   * can see, and the placeholder and the empty state both say so — a paginated
   * list that answers "Aucune commande trouvée" is claiming something about the
   * whole history that it has not looked at.
   */
  const searching = searchQuery.trim().length > 0
  const filteredOrders = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return orders
    return orders.filter(
      (order: Order) =>
        order.orderNumber.toLowerCase().includes(needle) ||
        order.customerInfo.name.toLowerCase().includes(needle)
    )
  }, [orders, searchQuery])

  const moreToLoad = status === "CanLoadMore" || status === "LoadingMore"
  const emptyMessage = searching
    ? moreToLoad
      ? "Aucune commande trouvée parmi celles chargées. Cliquez sur « Charger plus » pour chercher plus loin."
      : "Aucune commande ne correspond à cette recherche."
    : undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Commandes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez et suivez toutes les commandes du restaurant.
        </p>
      </div>

      {/* Search */}
      <div className="max-w-md" data-tour="orders-search">
        <SearchInput
          placeholder="Rechercher parmi les commandes chargées (n° ou nom du client)..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
      </div>

      {/* Status filter tabs */}
      <Tabs
        value={activeStatus}
        onValueChange={(value) => setActiveStatus(value as OrderStatusFilter)}
        data-tour="orders-tabs"
      >
        <TabsList variant="line">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmées</TabsTrigger>
          <TabsTrigger value="preparing">En préparation</TabsTrigger>
          <TabsTrigger value="ready">Prêtes</TabsTrigger>
          <TabsTrigger value="out_for_delivery">En livraison</TabsTrigger>
          <TabsTrigger value="delivered">Livrées</TabsTrigger>
          <TabsTrigger value="completed">Terminées</TabsTrigger>
          <TabsTrigger value="cancelled">Annulées</TabsTrigger>
        </TabsList>

        <TabsContent value={activeStatus} className="mt-6 space-y-4">
          <OrdersTable
            orders={filteredOrders}
            isLoading={status === "LoadingFirstPage"}
            emptyMessage={emptyMessage}
          />
          {moreToLoad ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(ADMIN_PAGE_SIZE)}
              >
                {status === "LoadingMore" ? "Chargement…" : "Charger plus"}
              </Button>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
