import type { Metadata } from "next"
import { CartClient } from "./CartClient"

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
}

export default function CartPage() {
  return <CartClient />
}
