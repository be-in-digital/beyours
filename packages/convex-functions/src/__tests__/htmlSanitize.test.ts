import { describe, expect, test } from "vitest"
import { sanitizeArticleHtml, sanitizeRichTextHtml } from "../htmlSanitize"

/**
 * One allow-list, two writers.
 *
 * The AI path was cleaned by an allow-list inlined in the app; the editor's own
 * output was stored verbatim. These are the cases that decide whether the
 * public blog can be made to run somebody else's script.
 */

describe("sanitizeArticleHtml", () => {
  test("keeps the markup the editor legitimately produces", () => {
    const html =
      "<h2>Titre</h2><p>Un <strong>plat</strong> et un <em>vin</em>.</p><ul><li>Un</li></ul>"
    expect(sanitizeArticleHtml(html)).toBe(html)
  })

  test("drops a script tag and its contents", () => {
    const out = sanitizeArticleHtml("<p>hi</p><script>alert(document.cookie)</script>")
    expect(out).toBe("<p>hi</p>")
    expect(out).not.toContain("alert")
  })

  test("drops an event handler attribute", () => {
    const out = sanitizeArticleHtml('<img src="https://x/y.png" onerror="alert(1)" alt="a" />')
    expect(out).not.toContain("onerror")
    expect(out).toContain('src="https://x/y.png"')
  })

  test("refuses a javascript: link", () => {
    const out = sanitizeArticleHtml('<p><a href="javascript:alert(1)">clic</a></p>')
    expect(out).not.toContain("javascript:")
  })

  test("refuses a data: URL on an image", () => {
    const out = sanitizeArticleHtml(
      '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" alt="a" />',
    )
    expect(out).not.toContain("data:")
  })

  test("drops an iframe", () => {
    expect(sanitizeArticleHtml('<iframe src="https://evil.example"></iframe>')).toBe("")
  })

  test("drops a style attribute", () => {
    const out = sanitizeArticleHtml('<p style="position:fixed;top:0">x</p>')
    expect(out).toBe("<p>x</p>")
  })

  test("survives markup that never closes", () => {
    expect(() => sanitizeArticleHtml("<p><strong>oops")).not.toThrow()
  })

  test("an empty string stays empty", () => {
    expect(sanitizeArticleHtml("")).toBe("")
  })

  test("keeps an https link with its rel and target", () => {
    const html = '<p><a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a></p>'
    expect(sanitizeArticleHtml(html)).toBe(html)
  })
})

describe("sanitizeRichTextHtml", () => {
  test("keeps the inline formatting a CMS block is for", () => {
    const html = "<p>Notre <strong>histoire</strong> commence ici.</p>"
    expect(sanitizeRichTextHtml(html)).toBe(html)
  })

  test("drops images and headings, which belong to the page's own design", () => {
    const out = sanitizeRichTextHtml('<h2>Titre</h2><img src="https://x/y.png" alt="a" /><p>ok</p>')
    expect(out).not.toContain("<img")
    expect(out).not.toContain("<h2")
    expect(out).toContain("<p>ok</p>")
  })

  test("drops a script tag", () => {
    expect(sanitizeRichTextHtml("<p>a</p><script>alert(1)</script>")).toBe("<p>a</p>")
  })

  test("refuses a javascript: link", () => {
    expect(sanitizeRichTextHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:")
  })
})
