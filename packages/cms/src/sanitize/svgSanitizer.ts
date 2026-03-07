/**
 * SVG Sanitizer
 *
 * Removes potentially dangerous elements from SVG content:
 * - <script> elements
 * - Event handler attributes (onclick, onload, etc.)
 * - javascript: URIs in href/xlink:href
 *
 * Pure function, max 1MB input.
 */

const MAX_SVG_SIZE = 1 * 1024 * 1024 // 1MB

const DANGEROUS_ELEMENTS = [
  "script",
  "iframe",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "textarea",
  "button",
  "select",
  "foreignObject",
  "math",
  "annotation-xml",
  "base",
]

const EVENT_HANDLER_PATTERN = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi

const JAVASCRIPT_URI_PATTERN =
  /(href|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi

export interface SanitizeResult {
  sanitized: string
  removedElements: string[]
}

export function sanitizeSvg(svg: string): SanitizeResult {
  if (svg.length > MAX_SVG_SIZE) {
    throw new Error(
      `SVG exceeds maximum size of ${MAX_SVG_SIZE / (1024 * 1024)}MB`,
    )
  }

  const removedElements: string[] = []
  let result = svg

  // Remove dangerous elements and their content
  for (const tag of DANGEROUS_ELEMENTS) {
    const regex = new RegExp(
      `<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>|<${tag}[^>]*\\/?>`,
      "gi",
    )
    const matches = result.match(regex)
    if (matches) {
      for (const match of matches) {
        removedElements.push(`<${tag}>`)
      }
      result = result.replace(regex, "")
    }
  }

  // Remove event handler attributes
  const eventMatches = result.match(EVENT_HANDLER_PATTERN)
  if (eventMatches) {
    for (const match of eventMatches) {
      const attrName = match.trim().split("=")[0]?.trim() ?? match.trim()
      removedElements.push(attrName)
    }
    result = result.replace(EVENT_HANDLER_PATTERN, "")
  }

  // Remove javascript: URIs
  const jsUriMatches = result.match(JAVASCRIPT_URI_PATTERN)
  if (jsUriMatches) {
    removedElements.push("javascript: URI")
    result = result.replace(JAVASCRIPT_URI_PATTERN, 'href=""')
  }

  return { sanitized: result, removedElements }
}
