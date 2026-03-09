"use client"

import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { AuthProvider } from "@/app/auth-provider"

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user

  return (
    <AuthProvider>
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl">
            BeInDigital
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <span className="text-sm text-muted-foreground">Menu</span>
            <span className="text-sm text-muted-foreground">Cart</span>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="text-sm font-medium hover:text-primary"
              >
                Mon compte
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="text-sm font-medium hover:text-primary"
              >
                Se connecter
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Powered by BeInDigital Engine
        </div>
      </footer>
    </div>
    </AuthProvider>
  )
}
