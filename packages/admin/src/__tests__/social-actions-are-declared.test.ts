import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * The product never claims to have verified a social action (#107).
 *
 * WHAT IT USED TO CLAIM. The diner was shown « Vérification… 12s » while a
 * countdown ran, and the owner configured a field labelled « Durée de
 * vérification (s) ». Nothing was verified in either case: the product opens a
 * link and counts seconds.
 *
 * IT CANNOT BE VERIFIED, WHICH IS WHY THE FIX IS THE WORDS. Google's Places API
 * exposes the reviews of a place, not the identity of the device that left one;
 * Instagram and Facebook offer no follow-check for a visitor with no account
 * link. There is no API behind the claim to go and call.
 *
 * WHY IT IS WORTH A GUARD RATHER THAN A CORRECTION. The owner sets the win ratio
 * — and therefore the prize budget, which is real money — against what they
 * believe the actions guarantee. "Verification" is also the obvious word for a
 * countdown, so it comes back the next time somebody renames a status.
 */

const HERE = path.dirname(new URL(import.meta.url).pathname)
const GAME = path.join(HERE, "..", "game")
const GAMES_ADMIN = path.join(HERE, "..", "pages", "games")

/** Source with block comments stripped, so a comment explaining the rule is exempt. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
}

const SURFACES = [
  path.join(GAME, "actions-screen.tsx"),
  path.join(GAMES_ADMIN, "actions-page.tsx"),
]

describe("the social-action surfaces", () => {
  it("reads the files it is about", () => {
    // A sweep that resolves nothing reports no violations, which is the same
    // green as a clean product.
    for (const file of SURFACES) {
      expect(fs.existsSync(file), file).toBe(true)
      expect(fs.readFileSync(file, "utf8").length).toBeGreaterThan(500)
    }
  })

  it("never labels anything « vérification »", () => {
    /*
     * The NOUN, which is what both labels used — « Vérification… 12s » on the
     * diner's screen and « Durée de vérification (s) » on the owner's form. It is
     * the form that makes the claim: it names a thing the product did.
     *
     * The negated VERB is deliberately allowed, and required by the test below:
     * « nous ne vérifions pas l'avis » is the sentence that replaces the claim,
     * and a guard that banned the root outright would forbid saying so.
     *
     * Comments are stripped first, because both files explain at length why the
     * word is wrong and a scan that could not tell a comment from a string would
     * make that explanation unwritable.
     */
    const offenders: string[] = []
    for (const file of SURFACES) {
      const code = withoutComments(fs.readFileSync(file, "utf8"))
      if (/[Vv]érification/.test(code)) offenders.push(path.basename(file))
    }
    expect(offenders).toEqual([])
  })

  it("does not call the dwell countdown a verification in code either", () => {
    // The status was named `verifying`, and that is exactly how the claim reached
    // the diner's screen: it was rendered.
    const screen = withoutComments(
      fs.readFileSync(path.join(GAME, "actions-screen.tsx"), "utf8")
    )
    expect(screen).not.toContain("verifying")
    expect(screen).toContain('"waiting"')
  })

  it("tells the owner the client declares the action", () => {
    // The positive half. Removing the false claim is not enough — an owner
    // setting a win ratio has to know what they are relying on.
    const page = fs.readFileSync(path.join(GAMES_ADMIN, "actions-page.tsx"), "utf8")
    expect(page).toMatch(/déclare lui-même/)
    expect(page).toMatch(/ne\s+vérifions pas/)
  })
})
