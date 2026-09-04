import type { GamePrize } from "./lib"

/**
 * The glyph that stands in for a prize wherever its image is absent.
 *
 * It used to live at the bottom of `welcome-screen.tsx`, which meant the
 * result and reward screens imported a *value* from a sibling screen — an
 * edge that survives a move by accident and drags a whole component into any
 * bundle that only wanted an emoji.
 */
export function prizeEmoji(type: GamePrize["type"]): string {
  switch (type) {
    case "discount_percentage":
    case "discount_fixed":
      return "💸"
    case "free_product":
      return "🍔"
    case "free_menu":
      return "🍽️"
    default:
      return "🎁"
  }
}
