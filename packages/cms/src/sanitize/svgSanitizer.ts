/**
 * SVG Sanitizer
 *
 * An uploaded SVG is not an image, it is a document. It can carry `<script>`,
 * event-handler attributes and `javascript:` URIs, and they run on whatever
 * origin serves the file. This strips everything that can execute and returns
 * markup that only draws.
 *
 * The work is delegated to DOMPurify, which parses the markup and walks the
 * resulting tree. The previous implementation matched patterns against the raw
 * string, and a string cannot be asked what a parser would see:
 *
 *  - `<svg/onload="…">` has no whitespace before the handler, so the
 *    `/\s+on\w+/` pattern never matched it;
 *  - `&#106;avascript:` only spells `javascript:` after entity decoding, which
 *    happens in the parser, not in the regex;
 *  - `<set attributeName="href" to="javascript:…">` never writes the URI into
 *    an attribute the pattern looked at — it assigns `href` at animation time.
 *
 * All three were returned unchanged, and all three are covered by tests now.
 *
 * Pure function, max 1MB input.
 */

import DOMPurify from "isomorphic-dompurify"

const MAX_SVG_SIZE = 1 * 1024 * 1024 // 1MB

/**
 * DOMPurify's SVG profiles: drawing elements, plus the filter primitives a real
 * logo uses (`<feGaussianBlur>` and friends). Everything outside them — `<script>`,
 * `<foreignObject>`, `<iframe>`, every `on*` handler, every scripting URI — is
 * dropped by the library rather than by a pattern maintained here.
 */
const SANITIZE_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
} as const

/** Wrapper nodes the parser creates and DOMPurify then discards. Not findings. */
const PARSER_WRAPPER_NODES = new Set(["HTML", "HEAD", "BODY"])

export interface SanitizeResult {
  sanitized: string
  removedElements: string[]
}

/**
 * Names of what DOMPurify dropped, in the shape this module has always
 * reported: `<tag>` for an element, the bare name for an attribute.
 */
function describeRemovals(): string[] {
  return DOMPurify.removed.flatMap((entry) => {
    const removed = entry as { element?: Node; attribute?: Attr | null }

    if (removed.attribute) {
      return [removed.attribute.name]
    }

    const nodeName = removed.element?.nodeName
    if (!nodeName || PARSER_WRAPPER_NODES.has(nodeName.toUpperCase())) {
      return []
    }

    return [`<${nodeName.toLowerCase()}>`]
  })
}

/**
 * Drop anything the parser left before the root `<svg>`.
 *
 * A hostile `<!DOCTYPE svg [ … ]>` internal subset survives as an inert text
 * node ahead of the root. It cannot execute, but it does make the stored file
 * malformed XML, and a browser then refuses to draw it — so a sanitized logo
 * would silently stop rendering. Exporter DOCTYPEs (Illustrator's, for one) are
 * already consumed by the parser and never reach this.
 */
function stripPreamble(markup: string): string {
  const rootStart = markup.indexOf("<svg")
  return rootStart > 0 ? markup.slice(rootStart) : markup
}

export function sanitizeSvg(svg: string): SanitizeResult {
  if (svg.length > MAX_SVG_SIZE) {
    throw new Error(
      `SVG exceeds maximum size of ${MAX_SVG_SIZE / (1024 * 1024)}MB`,
    )
  }

  const sanitized = DOMPurify.sanitize(svg, SANITIZE_CONFIG)

  // Read straight after the call: `DOMPurify.removed` is reset by the next one.
  return {
    sanitized: stripPreamble(sanitized),
    removedElements: describeRemovals(),
  }
}
