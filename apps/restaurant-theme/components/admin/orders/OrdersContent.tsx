"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { OrdersTable } from "./OrdersTable"

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
export function OrdersContent() {
  const storeId = useAdminStoreId()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeStatus, setActiveStatus] = useState<OrderStatus>("all")

  // Fetch orders for the current store
  const orders = useQuery(
    api.orders.list,
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
        <h1 className="text-3xl font-bold">Orders</h1>
        <p className="text-muted-foreground mt-2">
          Manage and track all restaurant orders.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by order number or customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs with status filters */}
      <Tabs value={activeStatus} onValueChange={(value) => setActiveStatus(value as OrderStatus)}>
        <TabsList variant="line">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="preparing">Preparing</TabsTrigger>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={activeStatus} className="mt-6">
          <OrdersTable orders={filteredOrders || []} isLoading={orders === undefined} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
