import type { Metadata } from "next"
import { FavoritesClient } from "./FavoritesClient"

export const metadata: Metadata = {
  title: "Favorite Products",
  robots: { index: false, follow: false },
}

export default function FavoritesPage() {
  return <FavoritesClient />
}
