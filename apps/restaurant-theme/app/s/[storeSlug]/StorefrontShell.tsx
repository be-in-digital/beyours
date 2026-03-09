"use client"

import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { TranslationProvider } from "@/components/storefront/TranslationProvider"
import { LanguageSwitcher } from "@/components/storefront/LanguageSwitcher"
import { storeUrl } from "@/lib/store-url"

interface StorefrontShellProps {
  storeSlug: string
  headerData: {
    brandName: string
    menuLabel: string
    cartLabel: string
    accountLabel: string
    signinLabel: string
  }
  footerData: {
    poweredBy: string
  }
  children: React.ReactNode
}

export function StorefrontShell({
  storeSlug,
  headerData,
  footerData,
  children,
}: StorefrontShellProps) {
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user

  const url = (path: string) => storeUrl(storeSlug, path)

  return (
    <TranslationProvider>
      <div className="min-h-screen flex flex-col">
        <header className="border-b">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href={url("/")} className="font-bold text-xl">
              {headerData.brandName}
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <LanguageSwitcher />
              <Link href={url("/menu")} className="text-sm text-muted-foreground hover:text-primary">
                {headerData.menuLabel}
              </Link>
              <Link href={url("/cart")} className="text-sm text-muted-foreground hover:text-primary">
                {headerData.cartLabel}
              </Link>
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="text-sm font-medium hover:text-primary"
                >
                  {headerData.accountLabel}
                </Link>
              ) : (
                <Link
                  href="/sign-in"
                  className="text-sm font-medium hover:text-primary"
                >
                  {headerData.signinLabel}
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t py-8">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            {footerData.poweredBy}
          </div>
        </footer>
      </div>
    </TranslationProvider>
  )
}
