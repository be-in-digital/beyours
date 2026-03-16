"use client"

import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { CheckCircle, Package, ArrowLeft, ExternalLink } from "lucide-react"
import { Button } from "@beindigital-engine/ui/components"
import { Separator } from "@beindigital-engine/ui/components"
import { Skeleton } from "@beindigital-engine/ui/components"
import { Badge } from "@beindigital-engine/ui/components"
import { OrderStatusBadge } from "@beindigital-engine/ui/restaurant"
import type { OrderStatus } from "@beindigital-engine/ui/restaurant"
import { formatPrice } from "@beindigital-engine/restaurant"

/** Map DB order statuses to OrderStatusBadge-compatible values */
function toDisplayStatus(status: string): OrderStatus {
  const map: Record<string, OrderStatus> = {
    out_for_delivery: "delivered",
    completed: "delivered",
  }
  return (map[status] ?? status) as OrderStatus
}

export default function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const searchParams = useSearchParams()
  const viewToken = searchParams.get("token") ?? undefined

  const order = useQuery(api.orders.getById, {
    id: orderId as Id<"orders">,
    viewToken,
  })

  // Loading
  if (order === undefined) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="mb-2 h-4 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  // Not found / not authorized
  if (order === null) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold">Commande introuvable</h1>
        <p className="mt-2 text-muted-foreground">
          Cette commande n&apos;existe pas ou vous n&apos;avez pas accès.
        </p>
        <Link href="/menu">
          <Button variant="outline" className="mt-6">
            Retour au menu
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/menu"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au menu
      </Link>

      {/* Success header */}
      <div className="mb-8 flex items-start gap-4">
        <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="font-black text-2xl tracking-tighter">
            Commande confirmée
          </h1>
          <p className="mt-1 text-muted-foreground">
            Numéro de commande : <span className="font-mono font-bold">{order.orderNumber}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Order details */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Détails</h2>
            <OrderStatusBadge status={toDisplayStatus(order.status)} />
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline">
                {order.type === "delivery"
                  ? "Livraison"
                  : order.type === "pickup"
                    ? "À emporter"
                    : "Sur place"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Client</span>
              <span>{order.customerInfo.name}</span>
            </div>
            {order.customerInfo.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{order.customerInfo.email}</span>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adresse</span>
                <span className="text-right">
                  {order.deliveryAddress.street}, {order.deliveryAddress.postalCode}{" "}
                  {order.deliveryAddress.city}
                </span>
              </div>
            )}
          </div>

          {/* Tracking link */}
          {order.orderNumber && (
            <div className="mt-4">
              <Link
                href={`/track/${order.orderNumber}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Suivre ma commande <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Items + totals */}
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="font-bold text-lg">Articles</h2>

          <div className="mt-4 space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div>
                  <span className="font-medium">{item.productName}</span>
                  <span className="text-muted-foreground"> x{item.quantity}</span>
                  {item.selectedOptions.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {item.selectedOptions
                        .map((o) => o.choiceName ?? o.optionName)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <span>{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sous-total</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxes</span>
              <span>{formatPrice(order.taxAmount)}</span>
            </div>
            {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Livraison</span>
                <span>{formatPrice(order.deliveryFee)}</span>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
