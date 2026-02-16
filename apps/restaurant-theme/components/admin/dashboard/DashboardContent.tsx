"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAdminStoreId, formatPrice } from "@/lib/admin"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Clock
} from "lucide-react"
import { RecentOrdersTable } from "./RecentOrdersTable"
import { QuickActions } from "./QuickActions"

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled"

interface Order {
  _id: string
  status: OrderStatus
  createdAt: number
  total: number
}

interface StatCardProps {
  icon: React.ReactNode
  title: string
  value: string
  subtitle?: string
}

function StatCard({ icon, title, value, subtitle }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardContent() {
  const storeId = useAdminStoreId()
  const orders = useQuery(
    api.orders.list,
    storeId ? { storeId } : "skip"
  )

  // Loading state
  if (orders === undefined) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate today's stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTimestamp = today.getTime()

  const todayOrders =
    orders?.filter(
      (o: Order) => o.createdAt >= todayTimestamp && o.status !== "cancelled"
    ) ?? []

  const revenue = todayOrders.reduce((sum: number, o: Order) => sum + o.total, 0)
  const orderCount = todayOrders.length
  const averageBasket = orderCount > 0 ? revenue / orderCount : 0

  const activeOrders =
    orders?.filter((o: Order) =>
      ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(o.status)
    ) ?? []

  // Empty state
  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          Veuillez sélectionner un restaurant pour afficher le tableau de bord.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          title="Chiffre d'affaires du jour"
          value={formatPrice(revenue)}
          subtitle={`${orderCount} commande${orderCount > 1 ? "s" : ""}`}
        />
        <StatCard
          icon={<ShoppingCart className="h-4 w-4" />}
          title="Commandes du jour"
          value={orderCount.toString()}
          subtitle="Commandes validées"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          title="Panier moyen"
          value={formatPrice(averageBasket)}
          subtitle="Moyenne du jour"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          title="Commandes actives"
          value={activeOrders.length.toString()}
          subtitle="En cours de traitement"
        />
      </div>

      {/* Recent Orders */}
      <RecentOrdersTable orders={orders?.slice(0, 10) ?? []} />

      {/* Quick Actions */}
      <QuickActions />
    </div>
  )
}
