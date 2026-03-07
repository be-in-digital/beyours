"use client"

import { useParams } from "next/navigation"
import { useCmsPage } from "@/lib/cms"

export function CategoryMenuClient() {
  const params = useParams<{ categorySlug: string }>()

  const { block } = useCmsPage("category-menu")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "Category Menu"}
      </h1>
      <p className="text-muted-foreground mt-2">
        Viewing category: {params.categorySlug}
      </p>
    </div>
  )
}
