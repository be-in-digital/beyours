"use client"

import { useCmsPage } from "@/lib/cms"

export function MenuClient() {
  const { block } = useCmsPage("menu")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "Menu"}
      </h1>
      <p className="text-muted-foreground mt-2">
        {header.field("subtitle").text ??
          "Browse our full menu and find your favorites."}
      </p>
    </div>
  )
}
