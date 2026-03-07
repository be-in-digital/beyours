"use client"

import { useCmsPage } from "@/lib/cms"

export function FavoritesClient() {
  const { block } = useCmsPage("account-favorites")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "Favorite Products"}
      </h1>
      <p className="text-muted-foreground mt-2">
        {header.field("subtitle").text ??
          "Your saved favorite items for quick ordering."}
      </p>
    </div>
  )
}
