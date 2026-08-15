/**
 * Branded email layout — BeYours Restauration.
 *
 * Pure string builders, zero Convex/runtime dependency (importable from the
 * "use node" sending action and from tests). Everything is table-based with
 * inline styles because email clients (Outlook, Gmail) don't support flexbox,
 * grid, or <style> reliably.
 *
 * Direction artistique (DESIGN.md, refonte 2026-07 warm food-editorial) :
 * papier #faf5ee, encre #221c15, accent terracotta #c5542c, ancrage olive
 * #23271c. Un seul accent. Pas de glow, pas de mint.
 */

export const BRAND = {
  name: "BeYours",
  tagline: "Restauration",
  paper: "#faf5ee",
  surface: "#fffdf9",
  surface3: "#ece0cf",
  ink: "#221c15",
  inkSoft: "#6b5d4a",
  primary: "#c5542c",
  primaryInk: "#fdf7ef",
  olive: "#23271c",
  border: "#e6d8c4",
} as const

// ── Primitives ──────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Cents → "1 234,00 €" (French formatting, non-breaking spaces). */
export function euros(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(Math.round(cents))
  const whole = Math.floor(abs / 100).toString()
  const decimals = (abs % 100).toString().padStart(2, "0")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${negative ? "-" : ""}${grouped},${decimals} €`
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

/** Timestamp (ms) -> "1 janvier 2026" (UTC, deterministic, no ICU). */
export function dateFr(timestampMs: number): string {
  const d = new Date(timestampMs)
  return `${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// ── Content blocks ──────────────────────────────────────────────────────────

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:'Bricolage Grotesque',Georgia,serif;font-size:24px;line-height:1.25;font-weight:700;color:${BRAND.ink};">${text}</h1>`
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${BRAND.ink};">${html}</p>`
}

export function muted(html: string): string {
  return `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${BRAND.inkSoft};">${html}</p>`
}

/** Solid terracotta call-to-action button (bulletproof VML for Outlook). */
export function button(label: string, url: string): string {
  const safeUrl = escapeHtml(url)
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
    <tr><td align="center" bgcolor="${BRAND.primary}" style="border-radius:10px;">
      <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:13px 30px;font-family:'Bricolage Grotesque',Arial,sans-serif;font-size:15px;font-weight:700;color:${BRAND.primaryInk};text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`
}

/** Warm callout box (info / next steps). */
export function infoBox(innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:${BRAND.paper};border:1px solid ${BRAND.border};border-radius:12px;">
    <tr><td style="padding:16px 18px;font-size:14px;line-height:1.6;color:${BRAND.ink};">${innerHtml}</td></tr>
  </table>`
}

/** Key/value rows, e.g. an order recap. */
export function detailRows(rows: Array<[label: string, value: string]>): string {
  const body = rows
    .map(
      ([label, value], i) =>
        `<tr>
           <td style="padding:9px 0;font-size:13px;color:${BRAND.inkSoft};${i > 0 ? `border-top:1px solid ${BRAND.border};` : ""}">${escapeHtml(label)}</td>
           <td align="right" style="padding:9px 0;font-size:14px;font-weight:600;color:${BRAND.ink};${i > 0 ? `border-top:1px solid ${BRAND.border};` : ""}">${value}</td>
         </tr>`,
    )
    .join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${body}</table>`
}

/** Emphasised total line (terracotta). */
export function totalLine(label: string, cents: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:2px solid ${BRAND.ink};">
    <tr>
      <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:${BRAND.ink};">${escapeHtml(label)}</td>
      <td align="right" style="padding:12px 0 0;font-size:20px;font-weight:700;color:${BRAND.primary};">${euros(cents)}</td>
    </tr>
  </table>`
}

// ── Shell ───────────────────────────────────────────────────────────────────

interface ShellOptions {
  /** Hidden inbox-preview line. */
  preheader: string
  /** Absolute logo URL (PNG, hosted on the site). */
  logoUrl: string
  /** Main content (built from the blocks above). */
  contentHtml: string
  /** Optional footer legal / signature lines. */
  footerLines?: string[]
}

/**
 * Wrap content in the full branded email document.
 * The logo has a text fallback (many clients block images by default).
 */
export function emailShell(options: ShellOptions): string {
  const footer = (
    options.footerLines ?? [
      `${BRAND.name} — Restauration`,
      "Vous recevez cet email suite à un échange ou un achat sur notre plateforme.",
    ]
  )
    .map(
      (line) =>
        `<p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:${BRAND.inkSoft};">${line}</p>`,
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${BRAND.name}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface3};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface3};">
  <tr><td align="center" style="padding:28px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

      <!-- Header -->
      <tr><td style="padding:0 4px 18px;">
        <img src="${escapeHtml(options.logoUrl)}" alt="${BRAND.name}" height="30" style="height:30px;width:auto;border:0;display:block;">
      </td></tr>

      <!-- Card -->
      <tr><td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:16px;padding:34px 32px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
        ${options.contentHtml}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:22px 8px 4px;font-family:Arial,sans-serif;">
        ${footer}
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}
