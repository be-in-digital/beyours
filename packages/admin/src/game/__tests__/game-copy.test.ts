import { describe, expect, it } from "vitest"
import { resolveGameCopy } from "../game-copy"

/**
 * The CMS fallbacks used to be six inline `??` expressions inside the flow's
 * JSX, one of them branching on the game type. Nothing could assert them
 * without rendering the whole screen, so nothing did.
 */

describe("resolveGameCopy", () => {
  it("falls back to the flow's own copy when the CMS is absent", () => {
    const copy = resolveGameCopy(undefined, "wheel")
    expect(copy.heroTitle).toBe("Tentez votre chance !")
    expect(copy.winTitle).toBe("Vous avez gagné !")
    expect(copy.loseTitle).toBe("Pas cette fois…")
  })

  it("uses what the owner wrote", () => {
    const copy = resolveGameCopy(
      {
        heroTitle: "À vous de jouer",
        heroSubtitle: "Une chance par jour",
        winTitle: "Bravo !",
        winDescription: "Passez au comptoir",
        loseTitle: "Raté",
        loseDescription: "Revenez demain",
      },
      "wheel"
    )
    expect(copy).toEqual({
      heroTitle: "À vous de jouer",
      heroSubtitle: "Une chance par jour",
      winTitle: "Bravo !",
      winDescription: "Passez au comptoir",
      loseTitle: "Raté",
      loseDescription: "Revenez demain",
    })
  })

  it("names the right game in the subtitle", () => {
    // The one default that depends on the session, which is why the copy
    // cannot be resolved before the game type is known.
    expect(resolveGameCopy(undefined, "wheel").heroSubtitle).toContain("roue")
    expect(resolveGameCopy(undefined, "scratch_card").heroSubtitle).toContain(
      "ticket"
    )
  })

  it("treats a field the owner cleared as unset", () => {
    // A CMS text field emptied in the editor arrives as "" or whitespace, not
    // null. Printing it would leave the win screen with no heading at all.
    const copy = resolveGameCopy(
      { heroTitle: "", winTitle: "   ", loseTitle: null },
      "wheel"
    )
    expect(copy.heroTitle).toBe("Tentez votre chance !")
    expect(copy.winTitle).toBe("Vous avez gagné !")
    expect(copy.loseTitle).toBe("Pas cette fois…")
  })

  it("leaves the win description unset rather than blank", () => {
    // It is the one field with no default: the win screen renders its
    // paragraph only when there is something to put in it, so a blank must
    // arrive as undefined and not as an empty <p>.
    const copy = resolveGameCopy({ winDescription: "" }, "wheel")
    expect(copy.winDescription).toBeUndefined()
  })

  it("always gives the losing screen something to say", () => {
    // The losing paragraph is not guarded by the component — whatever this
    // returns is rendered. Cleared and absent must both land on the default,
    // or an owner who empties the field gets a blank <p> holding open a gap.
    for (const cleared of [undefined, null, "", "   "]) {
      const copy = resolveGameCopy({ loseDescription: cleared }, "wheel")
      expect(copy.loseDescription).toBe(
        "La chance tourne… littéralement. Retentez votre chance demain !"
      )
    }
    expect(
      resolveGameCopy({ loseDescription: "Revenez demain" }, "wheel").loseDescription
    ).toBe("Revenez demain")
  })

  it("trims what it keeps", () => {
    expect(resolveGameCopy({ heroTitle: "  Jouez  " }, "wheel").heroTitle).toBe("Jouez")
  })
})
