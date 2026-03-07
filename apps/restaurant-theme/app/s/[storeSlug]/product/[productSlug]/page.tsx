import type { Metadata } from "next"
import { cookies } from "next/headers"
import { getStorePageData } from "@/lib/convex-server"
import { buildSeoMetadata } from "@/lib/seo"
import { ProductDetailClient } from "./ProductDetailClient"

interface Props {
  params: Promise<{ storeSlug: string; productSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { storeSlug, productSlug } = await params
  const locale = (await cookies()).get("locale")?.value ?? null
  const { store, cms } = await getStorePageData(storeSlug, "product-detail", locale)

  if (!store || !cms) return { title: "Product" }

  const productName = productSlug.replace(/-/g, " ")

  return buildSeoMetadata({
    cms,
    fallbackTitle: `${productName} - ${store.name}`,
    fallbackDescription: `Order ${productName} from ${store.name}`,
    pathname: `/s/${storeSlug}/product/${productSlug}`,
  })
}

export default function ProductDetailPage() {
  return <ProductDetailClient />
}
