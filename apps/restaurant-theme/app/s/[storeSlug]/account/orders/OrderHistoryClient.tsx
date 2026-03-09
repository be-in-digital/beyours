"use client"

import { useCmsPage } from "@/lib/cms"

export function OrderHistoryClient() {
  const { block } = useCmsPage("account-orders")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "Order History"}
      </h1>
      <p className="text-muted-foreground mt-2">
        {header.field("subtitle").text ??
          "View your past orders and their status."}
      </p>
    </div>
  )
}
