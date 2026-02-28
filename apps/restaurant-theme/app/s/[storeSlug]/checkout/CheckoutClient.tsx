"use client"

import { useCmsPage } from "@/lib/cms"

export function CheckoutClient() {
  const { block } = useCmsPage("checkout")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "Checkout"}
      </h1>
      <p className="text-muted-foreground mt-2">
        {header.field("subtitle").text ??
          "Complete your order and make payment."}
      </p>
    </div>
  )
}
