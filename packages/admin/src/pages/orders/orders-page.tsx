"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { Tabs, TabsContent, TabsList, TabsTrigger, SearchInput } from "@beindigital-engine/ui"
import { OrdersTable } from "./orders-table"
import type { Order, OrderStatus } from "../../lib/types"

/**
 * Order status filter type (includes "all" for no-filter)
 */
type OrderStatusFilter = "all" | OrderStatus

/**
 * Main content component for orders list page
 * Displays orders in tabs filtered by status with search functionality
 */
export function OrdersPage() {
  const storeId = useAdminStoreId()
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const api = useAdminApiStore((s) => s.api)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeStatus, setActiveStatus] = useState<OrderStatusFilter>("all")

  // Fetch orders for the current store
  const orders = useQuery(
    api?.orders?.list ?? ("skip" as never),
    storeId ? { storeId } : "skip"
  ) as Order[] | undefined

  // Filter orders by status and search query
  const filteredOrders = orders?.filter((order: Order) => {
    const matchesStatus = activeStatus === "all" || order.status === activeStatus
    const matchesSearch =
      searchQuery === "" ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerInfo.name.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesStatus && matchesSearch
  })

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
          placeholder="Rechercher par n° de commande ou nom du client..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
      </div>

      {/* Status filter tabs */}
      <Tabs value={activeStatus} onValueChange={(value) => setActiveStatus(value as OrderStatusFilter)} data-tour="orders-tabs">
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

        <TabsContent value={activeStatus} className="mt-6">
          <OrdersTable orders={filteredOrders || []} isLoading={orders === undefined} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
