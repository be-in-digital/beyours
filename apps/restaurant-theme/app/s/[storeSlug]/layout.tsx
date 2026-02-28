import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getStoreBySlug } from "@/lib/convex-server"
import { fetchCmsPage } from "@/lib/cms/server"
import { buildRestaurantSchema, JsonLd } from "@/lib/json-ld"
import type { Id } from "@/convex/_generated/dataModel"
import { StoreProvider } from "@/components/storefront/StoreProvider"
import { StorefrontShell } from "./StorefrontShell"

interface StoreLayoutProps {
  children: React.ReactNode
  params: Promise<{ storeSlug: string }>
}

export default async function StoreLayout({ children, params }: StoreLayoutProps) {
  const { storeSlug } = await params

  // Resolve store from URL (canonical source, NOT cookie)
  const store = await getStoreBySlug(storeSlug)
  if (!store) notFound()

  // Fetch CMS layout data (header/footer) server-side
  const cms = await fetchCmsPage(store._id as Id<"stores">, "storefront-layout")

  const headerData = {
    brandName: cms.block("header").field("brandName").text ?? store.name,
    menuLabel: cms.block("header").field("menuLabel").text ?? "Menu",
    cartLabel: cms.block("header").field("cartLabel").text ?? "Cart",
    accountLabel: cms.block("header").field("accountLabel").text ?? "Mon compte",
    signinLabel: cms.block("header").field("signinLabel").text ?? "Se connecter",
  }

  const footerData = {
    poweredBy: cms.block("footer").field("poweredBy").text ?? "Powered by BeInDigital Engine",
  }

  // Build JSON-LD (Restaurant schema)
  const h = await headers()
  const host = h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  const baseUrl = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://localhost:3000"

  const restaurantLd = buildRestaurantSchema(
    store as unknown as Parameters<typeof buildRestaurantSchema>[0],
    baseUrl,
  )

  return (
    <StoreProvider initialStore={store as unknown as { _id: string; slug: string; name: string }}>
      <JsonLd data={restaurantLd} />
      <StorefrontShell
        storeSlug={storeSlug}
        headerData={headerData}
        footerData={footerData}
      >
        {children}
      </StorefrontShell>
    </StoreProvider>
  )
}
