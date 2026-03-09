"use client"

import { useCmsPage } from "@/lib/cms"

export default function StoreSelectorPage() {
  const { block } = useCmsPage("store-selector")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "Select Store"}
      </h1>
      <p className="text-muted-foreground mt-2">
        {header.field("subtitle").text ??
          "Choose your preferred store location."}
      </p>
    </div>
  )
}
