import { redirect } from "next/navigation"
import { resolveDefaultStoreSlug } from "@/lib/resolve-default-store"

/** Legacy redirect: /checkout → /s/<default-store>/checkout */
export default async function CheckoutRedirect() {
  const slug = await resolveDefaultStoreSlug()
  if (slug) redirect(`/s/${slug}/checkout`)
  redirect("/store-selector")
}
