"use client"

import { useCmsPage } from "@/lib/cms"

export function CartClient() {
  const { block } = useCmsPage("cart")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "Shopping Cart"}
      </h1>
      <p className="text-muted-foreground mt-2">
        {header.field("subtitle").text ??
          "Review your items and proceed to checkout."}
      </p>
    </div>
  )
}
