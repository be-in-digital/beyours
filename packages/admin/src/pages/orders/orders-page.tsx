"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@beindigital-engine/ui"
import { Search } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@beindigital-engine/ui"
import { OrdersTable } from "./orders-table"

/**
 * Order status type for filtering
 */
type OrderStatus =
  | "all"
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled"

/**
 * Main content component for orders list page
 * Displays orders in tabs filtered by status with search functionality
 */
export function OrdersPage() {
  const storeId = useAdminStoreId()
  const api = useAdminApiStore((s) => s.api) as Record<string, any> | null
  const [searchQuery, setSearchQuery] = useState("")
  const [activeStatus, setActiveStatus] = useState<OrderStatus>("all")

  // Fetch orders for the current store
  const orders = useQuery(
    api?.orders?.list ?? ("skip" as any),
    storeId ? { storeId } : "skip"
  )

  // Filter orders by status and search query
  const filteredOrders = orders?.filter((order: any) => {
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
      <div className="max-w-md">
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Rechercher par n° de commande ou nom du client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>
      </div>

      {/* Status filter tabs */}
      <Tabs value={activeStatus} onValueChange={(value) => setActiveStatus(value as OrderStatus)}>
        <TabsList variant="line">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmées</TabsTrigger>
          <TabsTrigger value="preparing">En préparation</TabsTrigger>
          <TabsTrigger value="ready">Prêtes</TabsTrigger>
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
