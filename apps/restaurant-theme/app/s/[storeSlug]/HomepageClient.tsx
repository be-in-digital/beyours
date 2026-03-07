"use client"

import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { useCmsPage } from "@/lib/cms"
import { useStoreUrl } from "@/lib/store-url"

export function HomepageClient() {
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const url = useStoreUrl()

  const { block } = useCmsPage("homepage")
  const hero = block("hero")
  const cta = block("cta")

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">
          {hero.field("title").text ?? "Welcome to Our Restaurant"}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {hero.field("subtitle").text ??
            "Discover our menu, order online, and enjoy the best dining experience."}
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href={url("/menu")}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {cta.field("menuButtonLabel").text ?? "View Menu"}
          </Link>
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              {cta.field("dashboardButtonLabel").text ?? "Dashboard"}
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              {cta.field("signinButtonLabel").text ?? "Se connecter"}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
