import type { Metadata } from "next"
import { StorefrontShell } from "@/components/storefront/storefront-shell"

export const metadata: Metadata = {
  title: "Commander en ligne - Restaurant",
  description: "Commandez en ligne, retirez en magasin ou faites-vous livrer.",
}

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StorefrontShell>{children}</StorefrontShell>
}
