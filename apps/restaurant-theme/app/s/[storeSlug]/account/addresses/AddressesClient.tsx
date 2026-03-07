"use client"

import { useCmsPage } from "@/lib/cms"

export function AddressesClient() {
  const { block } = useCmsPage("account-addresses")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "Saved Addresses"}
      </h1>
      <p className="text-muted-foreground mt-2">
        {header.field("subtitle").text ?? "Manage your delivery addresses."}
      </p>
    </div>
  )
}
