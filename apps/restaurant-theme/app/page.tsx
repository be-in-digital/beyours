"use client"

import Link from "next/link"
import { authClient } from "@/lib/auth-client"

export default function HomePage() {
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">
          Welcome to Our Restaurant
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Discover our menu, order online, and enjoy the best dining experience.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/menu"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            View Menu
          </Link>
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              Se connecter
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
