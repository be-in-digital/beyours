import { redirect } from "next/navigation"
import { resolveDefaultStoreSlug } from "@/lib/resolve-default-store"

interface Props {
  params: Promise<{ productSlug: string }>
}

/** Legacy redirect: /product/:slug → /s/<default-store>/product/:slug */
export default async function ProductRedirect({ params }: Props) {
  const { productSlug } = await params
  const slug = await resolveDefaultStoreSlug()
  if (slug) redirect(`/s/${slug}/product/${productSlug}`)
  redirect("/store-selector")
}
