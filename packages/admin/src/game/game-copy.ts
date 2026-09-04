import type { GameCopy } from "./api-contract"

/**
 * The flow's own copy, once the CMS has had its say.
 *
 * Kept out of the JSX so it can be tested: the fallbacks used to sit inline as
 * seven `??` expressions spread over two components, one of them depending on
 * the game type, and there was no way to assert any of them without rendering
 * the whole screen.
 *
 * Two rules, and both are deliberate:
 *
 * - **Blank means unset.** A field the owner cleared arrives as `""` or
 *   whitespace, not `null`. Treating that as "set" printed an empty heading on
 *   a screen whose entire job is to announce a win, and an empty `<p>` holding
 *   open a gap on the losing one.
 * - **What is kept is trimmed**, so a stray trailing space in the editor does
 *   not reach the page.
 *
 * `winDescription` is the one field with no default: the win screen renders its
 * paragraph only when there is something to put in it. The losing screen always
 * says something, which is why `loseDescription` resolves to a string here
 * rather than being left for the component to patch up.
 */
export interface ResolvedGameCopy {
  heroTitle: string
  heroSubtitle: string
  winTitle: string
  winDescription: string | undefined
  loseTitle: string
  loseDescription: string
}

export type GameKind = "wheel" | "scratch_card"

const DEFAULTS = {
  heroTitle: "Tentez votre chance !",
  heroSubtitleWheel: "Faites tourner la roue, repartez peut-être avec un lot.",
  heroSubtitleScratch: "Grattez votre ticket, repartez peut-être avec un lot.",
  winTitle: "Vous avez gagné !",
  loseTitle: "Pas cette fois…",
  loseDescription: "La chance tourne… littéralement. Retentez votre chance demain !",
} as const

/** Blank and absent are the same answer. */
function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function resolveGameCopy(
  copy: Partial<GameCopy> | undefined,
  gameType: GameKind
): ResolvedGameCopy {
  return {
    heroTitle: text(copy?.heroTitle) ?? DEFAULTS.heroTitle,
    heroSubtitle:
      text(copy?.heroSubtitle) ??
      (gameType === "wheel"
        ? DEFAULTS.heroSubtitleWheel
        : DEFAULTS.heroSubtitleScratch),
    winTitle: text(copy?.winTitle) ?? DEFAULTS.winTitle,
    winDescription: text(copy?.winDescription),
    loseTitle: text(copy?.loseTitle) ?? DEFAULTS.loseTitle,
    loseDescription: text(copy?.loseDescription) ?? DEFAULTS.loseDescription,
  }
}
