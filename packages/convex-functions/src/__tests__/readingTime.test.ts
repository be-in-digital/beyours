import { describe, expect, test } from "vitest"
import { estimateReadingMinutes } from "../blog"

/**
 * The reading time shown on every blog card.
 *
 * It is computed inside `listPublishedArticles`, which is the query behind
 * every render of the public blog — so the cost of computing it is part of the
 * cost of serving the page, and the input is whatever an editor stored.
 */

describe("estimateReadingMinutes", () => {
  test("counts the words the tags wrap, not the markup", () => {
    expect(estimateReadingMinutes(`<p>${"mot ".repeat(400)}</p>`)).toBe(2)
  })

  test("rounds to the nearest minute", () => {
    expect(estimateReadingMinutes(`<p>${"mot ".repeat(300)}</p>`)).toBe(2)
    expect(estimateReadingMinutes(`<p>${"mot ".repeat(280)}</p>`)).toBe(1)
  })

  test("never returns zero", () => {
    expect(estimateReadingMinutes("<p>Bref.</p>")).toBe(1)
    expect(estimateReadingMinutes("")).toBe(1)
    expect(estimateReadingMinutes("<p></p>")).toBe(1)
  })

  test("ignores attribute text inside a tag", () => {
    const html = '<img src="https://example.com/a/very/long/path/to/a/photograph.png" alt="une photo" />'
    expect(estimateReadingMinutes(html)).toBe(1)
  })

  test("treats newlines and tabs as word breaks", () => {
    expect(estimateReadingMinutes("<p>un\ndeux\ttrois quatre</p>")).toBe(1)
  })

  /**
   * The reason this is a hand-written scan and not `/<[^>]*>/g`.
   *
   * That expression looks linear and is not: given many `<` and no `>`, the
   * engine restarts at each one. Measured at 15 seconds on this input, inside
   * the query that serves `/blog` — a page anyone can request.
   */
  test("does not go quadratic on markup that never closes a tag", () => {
    const pathological = "<".repeat(100_000)
    const started = Date.now()
    estimateReadingMinutes(pathological)
    expect(Date.now() - started).toBeLessThan(1_000)
  })

  test("bounds how much it will scan at all", () => {
    const enormous = `<p>${"mot ".repeat(200_000)}</p>`
    const started = Date.now()
    const minutes = estimateReadingMinutes(enormous)
    expect(Date.now() - started).toBeLessThan(1_000)
    // 200 kB of "mot " is 50k words, at 200 words a minute.
    expect(minutes).toBe(250)
  })
})
