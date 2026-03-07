"use client"

import { useParams } from "next/navigation"
import { useCmsPage } from "@/lib/cms"

export function ProductDetailClient() {
  const params = useParams<{ productSlug: string }>()

  const { block } = useCmsPage("product-detail")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "Product Details"}
      </h1>
      <p className="text-muted-foreground mt-2">
        Product: {params.productSlug}
      </p>
    </div>
  )
}
