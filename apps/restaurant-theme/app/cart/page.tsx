import { redirect } from "next/navigation"
import { resolveDefaultStoreSlug } from "@/lib/resolve-default-store"

/** Legacy redirect: /cart → /s/<default-store>/cart */
export default async function CartRedirect() {
  const slug = await resolveDefaultStoreSlug()
  if (slug) redirect(`/s/${slug}/cart`)
  redirect("/store-selector")
}
