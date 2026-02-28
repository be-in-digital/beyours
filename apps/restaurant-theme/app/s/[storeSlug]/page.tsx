import type { Metadata } from "next"
import { cookies } from "next/headers"
import { getStorePageData } from "@/lib/convex-server"
import { buildSeoMetadata } from "@/lib/seo"
import { HomepageClient } from "./HomepageClient"

interface Props {
  params: Promise<{ storeSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { storeSlug } = await params
  const locale = (await cookies()).get("locale")?.value ?? null
  const { store, cms } = await getStorePageData(storeSlug, "homepage", locale)

  if (!store || !cms) return { title: "Welcome" }

  return buildSeoMetadata({
    cms,
    fallbackTitle: store.name,
    fallbackDescription: store.description ?? undefined,
    pathname: `/s/${storeSlug}`,
  })
}

export default function HomePage() {
  return <HomepageClient />
}
