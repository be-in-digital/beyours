/**
 * Media in a campaign, once the S3 bucket went private (P0-34).
 *
 * With no CDN in front of the bucket — the default — uploaded media is stored
 * as `/api/files/…`, a path on the storefront. A mail client has no origin to
 * resolve that against, and `sanitizeUrl` drops anything not absolute, so the
 * image would not render broken: it would vanish silently.
 */
import { describe, it, expect } from "vitest"
import {
  absolutiseUrls,
  renderTemplateToEmailHtml,
  type EmailBlock,
  type EmailBranding,
} from "../email-html-renderer"

const SITE = "https://resto.fr"

const branding: EmailBranding = {
  logoUrl: "/api/files/branding/logo.webp",
  primaryColor: "#FF5722",
  secondaryColor: "#FFC107",
  senderName: "Chez Luigi",
  unsubscribeUrl: "https://convex.site/email/unsubscribe?id=1",
  unsubscribeText: "Se désabonner",
}

describe("absolutiseUrls", () => {
  it("resolves a stored media path against the site origin", () => {
    expect(
      absolutiseUrls({ url: "/api/files/cms/a.webp" }, SITE)
    ).toEqual({ url: "https://resto.fr/api/files/cms/a.webp" })
  })

  it("leaves absolute URLs alone", () => {
    const cdn = { url: "https://cdn.example.com/cms/a.webp" }

    expect(absolutiseUrls(cdn, SITE)).toEqual(cdn)
  })

  it("does not touch body copy that happens to start with a slash", () => {
    // The reason this walks named URL fields rather than every string.
    expect(
      absolutiseUrls({ content: "/menu du jour : 12 €" }, SITE)
    ).toEqual({ content: "/menu du jour : 12 €" })
  })

  it("reaches into arrays and nested column blocks", () => {
    const input = {
      columns: [
        { blocks: [{ type: "image", url: "/api/files/cms/a.webp" }] },
      ],
      images: [{ url: "/api/files/cms/b.webp" }],
    }

    expect(absolutiseUrls(input, SITE)).toEqual({
      columns: [
        {
          blocks: [
            { type: "image", url: "https://resto.fr/api/files/cms/a.webp" },
          ],
        },
      ],
      images: [{ url: "https://resto.fr/api/files/cms/b.webp" }],
    })
  })

  it("tolerates a trailing slash on the origin", () => {
    expect(absolutiseUrls({ url: "/api/files/a.webp" }, `${SITE}/`)).toEqual({
      url: "https://resto.fr/api/files/a.webp",
    })
  })

  it("is a no-op without an origin", () => {
    const input = { url: "/api/files/cms/a.webp" }

    expect(absolutiseUrls(input, undefined)).toEqual(input)
    expect(absolutiseUrls(input, "")).toEqual(input)
  })

  it("passes undefined through", () => {
    expect(absolutiseUrls(undefined, SITE)).toBeUndefined()
  })
})

describe("renderTemplateToEmailHtml with private-bucket media", () => {
  const blocks: EmailBlock[] = [
    {
      type: "image",
      id: "hero",
      url: "/api/files/cms/plat.webp",
      alt: "Plat du jour",
    },
  ]

  it("renders stored media as an absolute URL", () => {
    const html = renderTemplateToEmailHtml(blocks, branding, undefined, {
      siteUrl: SITE,
    })

    expect(html).toContain("https://resto.fr/api/files/cms/plat.webp")
    expect(html).toContain("https://resto.fr/api/files/branding/logo.webp")
  })

  it("would otherwise drop the image entirely", () => {
    // Guards the regression this test exists for: no siteUrl, no src.
    const html = renderTemplateToEmailHtml(blocks, branding)

    expect(html).not.toContain("/api/files/cms/plat.webp")
  })

  it("does not rewrite the unsubscribe link, which is already absolute", () => {
    const html = renderTemplateToEmailHtml(blocks, branding, undefined, {
      siteUrl: SITE,
    })

    expect(html).toContain("https://convex.site/email/unsubscribe?id=1")
  })

  it("leaves CDN-hosted media untouched", () => {
    const html = renderTemplateToEmailHtml(
      [{ ...blocks[0], url: "https://cdn.example.com/cms/plat.webp" }],
      branding,
      undefined,
      { siteUrl: SITE }
    )

    expect(html).toContain("https://cdn.example.com/cms/plat.webp")
  })
})
