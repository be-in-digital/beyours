/**
 * Does this SVG carry anything that could execute?
 *
 * WHAT THIS IS FOR, AND WHAT IT IS NOT.
 *
 * This is a *refusal* check, not a sanitizer. It answers one question — does
 * the markup look active — and the caller refuses the upload if it does. It
 * never produces "cleaned" output, because a scrubber that misses a case hands
 * back a file the caller then believes is safe. That is exactly how the
 * previous `sanitizeSvg` failed: `<svg/onload=…>` and `&#106;avascript:` came
 * back unchanged and looking sanitized.
 *
 * It is deliberately **not** the security boundary. The boundary is that every
 * SVG this package's callers store is written with
 * `Content-Disposition: attachment`, so a browser downloads it instead of
 * opening it as a document — inert whether or not this function was fooled.
 * This check exists so an editor is told their logo carries active content
 * rather than silently having it stripped.
 *
 * DOM-free and dependency-free on purpose: it runs inside Convex isolate and
 * Node action modules, where DOMPurify cannot go (jsdom needs a filesystem the
 * bundler does not provide). Full sanitization is `sanitizeSvg`, in this same
 * folder, for Node callers only.
 */

/**
 * Decode the entity forms an attacker uses to spell a scheme without writing
 * it: `&#106;avascript:`, `&#x6A;avascript:`, `&#106avascript:`.
 */
function decodeEntities(markup: string): string {
  return markup
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);?/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
}

/**
 * Elements that can run code or fetch a document, and the animation elements
 * that can assign an attribute — `<set attributeName="href" to="javascript:…">`
 * never writes the URI into an href, which is why an href-shaped pattern could
 * not see it.
 */
const ACTIVE_ELEMENTS = [
  "script",
  "foreignobject",
  "iframe",
  "embed",
  "object",
  "applet",
  "handler",
  "listener",
  "set",
  "animate",
  "animatetransform",
  "animatemotion",
]

const ACTIVE_ELEMENT_PATTERN = new RegExp(`<\\s*/?\\s*(${ACTIVE_ELEMENTS.join("|")})\\b`, "i")

/**
 * An event handler attribute. The delimiter class is the fix for the bypass
 * that started this: the old pattern required `\s+` before the handler, and
 * `<svg/onload=…>` has a `/` there, not a space.
 */
const EVENT_HANDLER_PATTERN = /[\s/"'`<]on[a-z]{2,}\s*=/i

/** Schemes that execute, or that introduce a document which can. */
const ACTIVE_URI_PATTERN = /(javascript|vbscript|livescript|mocha)\s*:|data\s*:\s*(text\/html|image\/svg\+xml|application\/xhtml)/i

/** An external entity declaration — the XXE shape. */
const ENTITY_DECLARATION_PATTERN = /<!ENTITY/i

export interface ActiveContentReport {
  active: boolean
  /** Which checks fired, for the message shown to the uploader. */
  reasons: string[]
}

export function inspectSvgForActiveContent(svg: string): ActiveContentReport {
  // Entity-decode first, then strip nothing: every check runs against the text
  // a parser would see, not against the bytes as typed.
  const decoded = decodeEntities(svg)
  const reasons: string[] = []

  if (ACTIVE_ELEMENT_PATTERN.test(decoded)) {
    reasons.push("élément actif (script, animation ou objet embarqué)")
  }
  if (EVENT_HANDLER_PATTERN.test(decoded)) {
    reasons.push("attribut gestionnaire d'événement (on…)")
  }
  if (ACTIVE_URI_PATTERN.test(decoded)) {
    reasons.push("URI exécutable (javascript:, data:text/html…)")
  }
  if (ENTITY_DECLARATION_PATTERN.test(decoded)) {
    reasons.push("déclaration d'entité externe")
  }

  return { active: reasons.length > 0, reasons }
}

export function containsActiveContent(svg: string): boolean {
  return inspectSvgForActiveContent(svg).active
}
