/**
 * What a diner reads before they play, and agrees to by ticking.
 *
 * FRENCH, AND STAYING FRENCH: this is customer-facing copy on a screen a guest
 * opens at a restaurant table. It is also the text a consent record points at,
 * so it is not CMS-editable the way `game-copy.ts` is — a restaurant may
 * reword its own welcome message, but it may not reword the sentence its legal
 * basis rests on, and a store that emptied this field would be collecting a
 * fingerprint against nothing at all.
 *
 * THE VERSION IS OWNED HERE, deliberately. The browser renders this text and
 * sends this identifier from the same bundle, so a play records the wording
 * that was on screen rather than the wording the server currently believes is
 * current. `GAME_CONSENT_NOTICE_VERSIONS` in
 * `@be-in-digital/convex-functions/gamePlay` is the set the server accepts:
 * reword the text, bump the version here, add it there. `consent-copy.test.ts`
 * pins the text to the version so the first two cannot be done separately.
 */

/** The wording below, by version. Bump on ANY change to the text. */
export const GAME_CONSENT_NOTICE_VERSION = "fr-2026-09"

export interface GameConsentNotice {
  version: string
  /** The checkbox's own label — the sentence the diner is agreeing to. */
  label: string
  /** What it covers, underneath. */
  detail: string
}

/**
 * How long, said the way someone says it out loud.
 *
 * « 1095 jours » is accurate and unreadable; a retention notice nobody parses
 * informs nobody. Whole years get years, whole months get months, and anything
 * else stays in days rather than being rounded into a claim that is not true.
 */
export function formatRetention(days: number): string {
  if (days >= 365 && days % 365 === 0) {
    const years = days / 365
    return years === 1 ? "un an" : `${years} ans`
  }
  if (days >= 30 && days % 30 === 0) {
    const months = days / 30
    return months === 1 ? "un mois" : `${months} mois`
  }
  return days === 1 ? "un jour" : `${days} jours`
}

/**
 * The notice, for one establishment and one retention window.
 *
 * `storeName` falls back to « le restaurant » rather than leaving a gap: a
 * consent that does not name a controller is not one, and an empty span in the
 * middle of the sentence is what an unset store name would produce.
 */
export function gameConsentNotice(params: {
  storeName?: string
  retentionDays: number
}): GameConsentNotice {
  const who = params.storeName?.trim() || "le restaurant"
  return {
    version: GAME_CONSENT_NOTICE_VERSION,
    label: `J'accepte que ${who} enregistre ma partie.`,
    detail:
      "Votre appareil est reconnu pour la limite d'une partie toutes les 24 h. " +
      "Si vous gagnez, votre nom et votre e-mail servent à vous envoyer votre lot. " +
      `Ces informations sont conservées pendant ${formatRetention(params.retentionDays)}, puis supprimées. ` +
      "Vous pouvez demander au restaurant de les consulter ou de les effacer.",
  }
}
