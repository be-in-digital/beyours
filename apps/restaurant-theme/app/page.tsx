import { redirect } from "next/navigation"
import { resolveDefaultStoreSlug } from "@/lib/resolve-default-store"

/**
 * Root page — resolves the default store and redirects.
 * If multi-store and no preference, redirects to /store-selector.
 */
export default async function RootPage() {
  const slug = await resolveDefaultStoreSlug()

  if (slug) {
    redirect(`/s/${slug}`)
  }

  redirect("/store-selector")
}
