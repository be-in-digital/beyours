import type { Metadata } from "next"
import { cookies } from "next/headers"
import { getStorePageData } from "@/lib/convex-server"
import { buildSeoMetadata } from "@/lib/seo"
import { CategoryMenuClient } from "./CategoryMenuClient"

interface Props {
  params: Promise<{ storeSlug: string; categorySlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { storeSlug, categorySlug } = await params
  const locale = (await cookies()).get("locale")?.value ?? null
  const { store, cms } = await getStorePageData(storeSlug, "category-menu", locale)

  if (!store || !cms) return { title: "Category" }

  const categoryName = categorySlug.replace(/-/g, " ")

  return buildSeoMetadata({
    cms,
    fallbackTitle: `${categoryName} - ${store.name}`,
    fallbackDescription: `Explore ${categoryName} at ${store.name}`,
    pathname: `/s/${storeSlug}/menu/${categorySlug}`,
  })
}

export default function CategoryMenuPage() {
  return <CategoryMenuClient />
}
