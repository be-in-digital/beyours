/**
 * The fields of an article that are prose are stored as prose.
 *
 * `saveDraft` cleaned `content` and nothing else, so the title, the excerpt
 * and the two meta fields were stored exactly as typed. The title travels
 * further than the body does — the page `<title>`, the breadcrumb JSON-LD, the
 * Open Graph tags, the card on the blog index — and none of those go through
 * the renderer that sanitises the body on the way out.
 *
 * The JSON-LD serialiser now escapes `<` unconditionally, so this is the
 * second of two independent layers rather than the only one. It is worth
 * having on its own terms: a title is one line an establishment writes about
 * its own article, and markup has no business in it whichever way it is
 * rendered.
 */

import { describe, expect, it } from "vitest"

import { sanitizePlainText } from "../htmlSanitize"

describe("sanitizePlainText", () => {
  it("leaves ordinary French copy exactly as written", () => {
    // The case that matters most: this runs over every title on every save,
    // and a sanitiser that mangles normal prose gets removed rather than fixed.
    for (const text of [
      "Nos pâtes fraîches de l'été",
      "Pizza & Co — l'ardoise du jour",
      'Le "vrai" tiramisù',
      "Menu à 19,90 € (midi)",
      "3 < 5 pizzas par table",
    ]) {
      expect(sanitizePlainText(text)).toBe(text)
    }
  })

  it("keeps the words of a stray tag and drops the tag", () => {
    // A title pasted out of a word processor. Emptying it would lose the
    // article's name over a formatting artefact.
    expect(sanitizePlainText("Nos <b>pâtes</b> fraîches")).toBe("Nos pâtes fraîches")
  })

  it("discards a script rather than promoting its source to text", () => {
    expect(sanitizePlainText("Menu<script>alert(1)</script>")).toBe("Menu")
    expect(sanitizePlainText("<style>body{display:none}</style>Menu")).toBe("Menu")
  })

  it("removes the markup that used to end a JSON-LD script tag", () => {
    for (const payload of ["</script>", "</script >", "</script/>", "<!--<script>"]) {
      const out = sanitizePlainText(`Pizza ${payload}`)
      expect(out).not.toContain("<")
      expect(out).not.toContain(">")
    }
  })

  it("strips an image with an event handler entirely", () => {
    expect(sanitizePlainText('Pizza <img src=x onerror="alert(1)">')).toBe("Pizza")
  })

  it("trims, so a title is not padded by the markup it lost", () => {
    expect(sanitizePlainText("  <p>Menu</p>  ")).toBe("Menu")
  })

  it("is idempotent — saving twice must not double-escape", () => {
    // The failure this guards is subtle and visible to the diner: an
    // ampersand stored as `&amp;` reads as `&amp;` on the page, and the next
    // save turns it into `&amp;amp;`.
    const once = sanitizePlainText("Bar & Grill")
    expect(once).toBe("Bar & Grill")
    expect(sanitizePlainText(once)).toBe(once)
  })
})
