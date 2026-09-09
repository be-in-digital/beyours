/**
 * The one allow-list for article and rich-text HTML.
 *
 * Two paths write HTML into this database and only one of them was ever
 * cleaned. `blogAutoGenerate` ran the model's output through `sanitize-html`
 * with the list below, inlined in the app; the editor's own output — the
 * hand-authored path through `saveDraft` and `publishArticle` — was stored
 * verbatim. Both now come through here, so there is a single answer to "what
 * markup may a visitor's browser be asked to run", and changing it changes it
 * for both.
 *
 * This is sanitisation on write. The public renderer sanitises again at render:
 * a row written before this existed is still hostile, and the allow-list can be
 * tightened later without a migration.
 *
 * `sanitize-html` parses the markup rather than pattern-matching it, which is
 * the whole point — a regular expression over HTML loses to the first
 * `<img src=x onerror=…>` written with an unusual amount of whitespace.
 */

import sanitizeHtml from "sanitize-html"

/**
 * What the Tiptap editor can produce, and nothing else.
 *
 * `img` carries `class` because the AI path injects its own figure classes.
 * No `style`, no `id`, no event handlers, no `iframe`, no `script`.
 */
const ARTICLE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "h2", "h3", "h4",
    "strong", "em", "u", "s",
    "ul", "ol", "li",
    "a", "img",
    "blockquote", "hr", "br",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "class"],
  },
  // The library's default, named here so that tightening it is a visible edit:
  // `javascript:` and `data:` URLs never survive.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
}

/**
 * The smaller list for CMS rich-text fields — an "about" paragraph, the copy
 * above a sign-in form. No images and no headings: these are blocks inside a
 * page someone else designed.
 */
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "strong", "em", "u", "s",
    "ul", "ol", "li",
    "a", "blockquote", "br",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
}

/** Clean the HTML body of a blog article. */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, ARTICLE_OPTIONS)
}

/** Clean the HTML of a CMS `richtext` field. */
export function sanitizeRichTextHtml(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_OPTIONS)
}

/**
 * A field that is text, reduced to text.
 *
 * WHAT THIS IS FOR. `saveDraft` cleaned `content` and nothing else, so an
 * article's title, excerpt and meta description were stored exactly as typed.
 * A title is not a document — it is one line an establishment writes about its
 * own article — and it travels further than the body does: into the page
 * `<title>`, into the breadcrumb JSON-LD, into the Open Graph tags, into the
 * card on the blog index. Markup has no business in any of them.
 *
 * `allowedTags: []` drops every tag and keeps the text inside it, so a title
 * pasted from a word processor with a stray `<b>` survives as its words
 * rather than being emptied. `disallowedTagsMode: "discard"` throws away the
 * contents of `<script>` and `<style>` instead of promoting them to text — the
 * one place where keeping the inside would be worse than losing it.
 *
 * The entity decode afterwards is deliberate. `sanitize-html` escapes what it
 * keeps, so `Café & Co` comes back as `Café &amp; Co`, and this value is
 * rendered as JSX text and as a JSON-LD string — both of which escape again.
 * Storing the escaped form would show the ampersand's entity to the diner.
 */
export function sanitizePlainText(text: string): string {
  const stripped = sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  })
  return stripped
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Ampersand last, or `&amp;lt;` would decode to `<` in two steps.
    .replace(/&amp;/g, "&")
    .trim()
}
