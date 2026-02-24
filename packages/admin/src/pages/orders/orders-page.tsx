"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { ADMIN_PAGE_SIZE } from "../../lib/constants"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@beindigital-engine/ui"
import { OrdersTable } from "./orders-table"
import { StoresPagination } from "../stores/stores-pagination"
import type { Order, OrderSource, OrderPaymentStatus } from "../../lib/types"

/**
 * Status group filter: groups multiple statuses together for a recap view
 */
type StatusGroup = "all" | "active" | "completed" | "cancelled"

/**
 * Map status groups to their underlying statuses
 */
const STATUS_GROUP_MAP: Record<StatusGroup, string[]> = {
  all: [],
  active: ["pending", "confirmed", "preparing", "ready", "out_for_delivery"],
  completed: ["completed", "delivered"],
  cancelled: ["cancelled"],
}

type SourceFilter = "all" | OrderSource
type PaymentFilter = "all" | OrderPaymentStatus

/**
 * Main content component for orders list page
 * Displays orders with filters optimized for a recap/summary view
 */
export function OrdersPage() {
  const storeId = useAdminStoreId()
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const api = useAdminApiStore((s) => s.api)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusGroup, setStatusGroup] = useState<StatusGroup>("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all")
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch orders for the current store
  const orders = useQuery(
    api?.orders?.list ?? ("skip" as never),
    storeId ? { storeId } : "skip"
  ) as Order[] | undefined

  // Filter orders by all criteria
  const filteredOrders = orders?.filter((order: Order) => {
    // Status group filter
    const statusList = STATUS_GROUP_MAP[statusGroup]
    const matchesStatus = statusGroup === "all" || statusList.includes(order.status)

    // Source filter
    const matchesSource = sourceFilter === "all" || order.source === sourceFilter

    // Payment status filter
    const matchesPayment = paymentFilter === "all" || order.paymentStatus === paymentFilter

    // Search filter
    const matchesSearch =
      searchQuery === "" ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerInfo.name.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesStatus && matchesSource && matchesPayment && matchesSearch
  })

  // Pagination calculations
  const totalItems = filteredOrders?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedOrders = filteredOrders?.slice(
    (safePage - 1) * ADMIN_PAGE_SIZE,
    safePage * ADMIN_PAGE_SIZE
  )

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }
  const handleStatusGroupChange = (value: string) => {
    setStatusGroup(value as StatusGroup)
    setCurrentPage(1)
  }
  const handleSourceChange = (value: string) => {
    setSourceFilter(value as SourceFilter)
    setCurrentPage(1)
  }
  const handlePaymentChange = (value: string) => {
    setPaymentFilter(value as PaymentFilter)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Commandes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez et suivez toutes les commandes du restaurant.
        </p>
      </div>

      {/* Search + Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="Rechercher par n° de commande ou nom du client..."
            value={searchQuery}
            onValueChange={handleSearchChange}
          />
        </div>
        <div className="flex gap-3">
          <Select value={sourceFilter} onValueChange={handleSourceChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sources</SelectItem>
              <SelectItem value="website">Site web</SelectItem>
              <SelectItem value="uber_eats">Uber Eats</SelectItem>
              <SelectItem value="deliveroo">Deliveroo</SelectItem>
              <SelectItem value="pos">POS</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={handlePaymentChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Paiement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les paiements</SelectItem>
              <SelectItem value="paid">Payé</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="refunded">Remboursé</SelectItem>
              <SelectItem value="partially_refunded">Part. remboursé</SelectItem>
              <SelectItem value="failed">Échoué</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status group tabs */}
      <Tabs value={statusGroup} onValueChange={handleStatusGroupChange}>
        <TabsList variant="line">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="active">En cours</TabsTrigger>
          <TabsTrigger value="completed">Terminées</TabsTrigger>
          <TabsTrigger value="cancelled">Annulées</TabsTrigger>
        </TabsList>

        <TabsContent value={statusGroup} className="mt-6 space-y-4">
          <OrdersTable orders={paginatedOrders || []} isLoading={orders === undefined} />

          <StoresPagination
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
