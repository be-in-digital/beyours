"use client"

import { useCmsPage } from "@/lib/cms"

export function AccountClient() {
  const { block } = useCmsPage("account")
  const header = block("header")

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {header.field("title").text ?? "My Account"}
      </h1>
      <p className="text-muted-foreground mt-2">
        {header.field("subtitle").text ??
          "Manage your account settings and preferences."}
      </p>
    </div>
  )
}
