"use client"

import { useParams } from "next/navigation"
import { useCmsPage } from "@/lib/cms"

export function OrderTrackingClient() {
  const params = useParams<{ orderId: string }>()

  const { block } = useCmsPage("order-tracking")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "Order Tracking"}
      </h1>
      <p className="text-muted-foreground mt-2">
        {header.field("subtitle").text ?? `Order ID: ${params.orderId}`}
      </p>
    </div>
  )
}
