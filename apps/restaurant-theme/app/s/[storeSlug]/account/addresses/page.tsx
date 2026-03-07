import type { Metadata } from "next"
import { AddressesClient } from "./AddressesClient"

export const metadata: Metadata = {
  title: "Saved Addresses",
  robots: { index: false, follow: false },
}

export default function AddressesPage() {
  return <AddressesClient />
}
