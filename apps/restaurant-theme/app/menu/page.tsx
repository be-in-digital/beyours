import { redirect } from "next/navigation"
import { resolveDefaultStoreSlug } from "@/lib/resolve-default-store"

/** Legacy redirect: /menu → /s/<default-store>/menu */
export default async function MenuRedirect() {
  const slug = await resolveDefaultStoreSlug()
  if (slug) redirect(`/s/${slug}/menu`)
  redirect("/store-selector")
}
