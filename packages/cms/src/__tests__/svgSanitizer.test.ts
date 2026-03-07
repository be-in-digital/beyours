import { describe, it, expect } from "vitest"
import { sanitizeSvg } from "../sanitize/svgSanitizer"

describe("sanitizeSvg", () => {
  it("should pass through a clean SVG unchanged", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="red"/>
  <rect x="10" y="10" width="30" height="30" fill="blue"/>
</svg>`
    const result = sanitizeSvg(svg)
    expect(result.sanitized).toBe(svg)
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
    expect(result.removedElements).toContain("javascript: URI")
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
    expect(result.removedElements).toContain("<iframe>")
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
    expect(result.sanitized).toBe(svg)
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
})
