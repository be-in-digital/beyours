import type { Metadata } from "next"
import { cookies } from "next/headers"
import { getStorePageData } from "@/lib/convex-server"
import { buildSeoMetadata } from "@/lib/seo"
import { MenuClient } from "./MenuClient"

interface Props {
  params: Promise<{ storeSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { storeSlug } = await params
  const locale = (await cookies()).get("locale")?.value ?? null
  const { store, cms } = await getStorePageData(storeSlug, "menu", locale)

  if (!store || !cms) return { title: "Menu" }

  return buildSeoMetadata({
    cms,
    fallbackTitle: `Menu - ${store.name}`,
    fallbackDescription: `Browse the full menu at ${store.name}`,
    pathname: `/s/${storeSlug}/menu`,
  })
}

export default function MenuPage() {
  return <MenuClient />
}
