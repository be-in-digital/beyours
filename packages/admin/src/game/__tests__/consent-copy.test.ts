import { describe, expect, it } from "vitest"
import { GAME_CONSENT_NOTICE_VERSIONS } from "@be-yours/convex-functions/gamePlay"
import {
  GAME_CONSENT_NOTICE_VERSION,
  formatRetention,
  gameConsentNotice,
} from "../consent-copy"

/**
 * The consent notice, pinned to its version.
 *
 * A `gamePlays.consent` row records a version, not the sentence. That is only
 * worth anything while the version still identifies one exact wording — so the
 * text is asserted here verbatim, and rewording it without bumping the version
 * fails. Bumping it then fails the round-trip test below until the new version
 * is added to the set the server accepts, which is the whole handshake.
 *
 * Yes, this test has to be edited whenever the copy changes. That is the point.
 */

describe("the consent notice", () => {
  it("is the exact wording version fr-2026-09 identifies", () => {
    const notice = gameConsentNotice({
      storeName: "Pizzeria Napoli",
      retentionDays: 1095,
    })

    expect(notice.version).toBe("fr-2026-09")
    expect(notice.label).toBe("J'accepte que Pizzeria Napoli enregistre ma partie.")
    expect(notice.detail).toBe(
      "Votre appareil est reconnu pour la limite d'une partie toutes les 24 h. " +
        "Si vous gagnez, votre nom et votre e-mail servent à vous envoyer votre lot. " +
        "Ces informations sont conservées pendant 3 ans, puis supprimées. " +
        "Vous pouvez demander au restaurant de les consulter ou de les effacer."
    )
  })

  it("is a version the backend will accept", () => {
    // The half that catches a bump made on one side only: a browser rendering
    // a notice the server refuses cannot play at all, and the failure would
    // otherwise show up as every diner in the restaurant being turned away.
    expect(GAME_CONSENT_NOTICE_VERSIONS).toContain(GAME_CONSENT_NOTICE_VERSION)
  })

  it("names the establishment, and says something when it cannot", () => {
    expect(gameConsentNotice({ storeName: "Le Comptoir", retentionDays: 1095 }).label).toContain(
      "Le Comptoir"
    )
    // A consent that names no controller is not one, so an unset or blank name
    // falls back rather than leaving a hole mid-sentence.
    expect(gameConsentNotice({ retentionDays: 1095 }).label).toBe(
      "J'accepte que le restaurant enregistre ma partie."
    )
    expect(gameConsentNotice({ storeName: "   ", retentionDays: 1095 }).label).toBe(
      "J'accepte que le restaurant enregistre ma partie."
    )
  })

  it("says the retention period the way a person would", () => {
    expect(formatRetention(1095)).toBe("3 ans")
    expect(formatRetention(365)).toBe("un an")
    expect(formatRetention(730)).toBe("2 ans")
    expect(formatRetention(180)).toBe("6 mois")
    expect(formatRetention(30)).toBe("un mois")
    expect(formatRetention(45)).toBe("45 jours")
    expect(formatRetention(1)).toBe("un jour")
  })

  it("never rounds a window into a claim that is not true", () => {
    // 400 days is not "un an". Saying so in a consent notice would make the
    // notice wrong in the restaurant's favour, which is the direction that
    // matters.
    expect(formatRetention(400)).toBe("400 jours")
  })
})
