"use client"

import { StorefrontHeader } from "./storefront-header"
import { StorefrontFooter } from "./storefront-footer"
import { StoreClosedBanner } from "./store-closed-banner"
import { StorefrontI18nProvider } from "./storefront-i18n-provider"
import { DynamicFavicon } from "../dynamic-favicon"
import { useStoreId } from "@/lib/hooks/use-store-id"
import { useStoreStatus } from "@/lib/hooks/use-store-status"

interface StorefrontShellProps {
  children: React.ReactNode
}

export function StorefrontShell({ children }: StorefrontShellProps) {
  const { storeId, store } = useStoreId()
  const { isOpen, isLoading, hoursStatus } = useStoreStatus(storeId)

  // The Design screen's Logo tab writes `branding.logoUrl` and
  // `branding.faviconUrl`, and nothing read either of them: the storefront
  // takes its logo and favicon from the CMS block, which an owner reaches from
  // a different screen. Rather than a second source of truth, these are the
  // FALLBACK — the CMS block wins wherever it is filled in, and the Design
  // screen's fields cover the establishment that never opened it. The store
  // document is already in hand here, so neither child needs its own query.
  const branding = store?.branding

  const nextOpenTime = hoursStatus?.nextChange
    ? hoursStatus.nextChange.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  const showBanner = !!storeId && !isLoading && !isOpen

  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontI18nProvider />
      <DynamicFavicon fallbackUrl={branding?.faviconUrl} />
      {showBanner && <StoreClosedBanner nextOpenTime={nextOpenTime} />}
      <StorefrontHeader hasBanner={showBanner} fallbackLogoUrl={branding?.logoUrl} />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
    </div>
  )
}
