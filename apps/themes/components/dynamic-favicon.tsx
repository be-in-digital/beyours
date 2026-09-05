"use client"

import { useEffect } from "react"
import { useCmsPage } from "@/lib/cms/useCmsPage"

/**
 * Injects a dynamic favicon <link> tag from CMS branding data.
 *
 * `fallbackUrl` is the establishment's `branding.faviconUrl`, saved on the
 * admin's Design screen. The CMS block wins because it holds uploaded media
 * an owner picked in the editor; the Design screen's URL covers a deployment
 * whose CMS block was never filled in — before it existed that field was
 * written by a form and read by nothing.
 *
 * Falls back to the static /favicon.ico when neither is set.
 */
export function DynamicFavicon({ fallbackUrl }: { fallbackUrl?: string }) {
  const cms = useCmsPage("storefront-layout")
  const faviconUrl = cms.block("branding").field("favicon").mediaUrl ?? fallbackUrl

  useEffect(() => {
    if (!faviconUrl) return

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement("link")
      link.rel = "icon"
      document.head.appendChild(link)
    }
    link.href = faviconUrl
  }, [faviconUrl])

  return null
}
