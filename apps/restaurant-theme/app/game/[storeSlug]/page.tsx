import type { Metadata } from "next"
import { GameClient } from "./GameClient"

export const metadata: Metadata = {
  title: "Jouez et Gagnez !",
  description: "Tentez votre chance à la roue de la fortune et gagnez des prix !",
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ storeSlug: string }>
}) {
  const { storeSlug } = await params

  return <GameClient storeSlug={storeSlug} />
}
