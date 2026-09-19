/**
 * The email a diner gets when their order is paid for.
 *
 * WHY THIS FILE EXISTS: `orderConfirmationTemplate` in `./templates` was
 * written, registered, unit-tested and exported, and never called by anything.
 * A guest paid and received nothing — no confirmation, no receipt, no record of
 * what they had ordered or where to collect it. The only order-triggered mail
 * in the product was the *marketing* `post_order` automation, which
 * `orders.syncSubscriberOrderMetadata` correctly refuses to enrol a diner into,
 * because an order is a purchase and not consent. So the transactional path was
 * never built at all.
 *
 * It could not simply be wired up as it stood, either:
 *  - it took amounts in EUROS (`total.toFixed(2)`) while every amount in the
 *    schema is in CENTS, so wiring it verbatim would have billed the diner
 *    3 400,00 € for a 34 € dinner in their own confirmation email;
 *  - it printed "Adresse de livraison" unconditionally, on a click-and-collect
 *    order that has no address and on a dine-in order eaten at a table;
 *  - it never named the restaurant, so the email arrived from nobody;
 *  - it interpolated the customer's own free-text note straight into HTML.
 *
 * This module is that email, done properly, and `./templates` now renders
 * through it so there is one implementation rather than two that drift.
 *
 * NO IMPORTS ON PURPOSE. It is published as a source subpath
 * (`@be-yours/core/aws/ses/order-confirmation`) exactly as
 * `./auth/rbac` is, so the Convex runtime can bundle it without dragging in
 * `@aws-sdk/client-sesv2` through the package barrel — the constraint
 * `convex-functions/src/autoTranslate.ts` documents.
 *
 * @module aws/ses/order-confirmation
 */

/** How the diner gets their food. Mirrors `orders.type`. */
export type OrderFulfilment = "delivery" | "pickup" | "dine_in"

/** A postal address, as the schema stores one. */
export interface ConfirmationAddress {
  street: string
  city: string
  postalCode: string
  country?: string
  instructions?: string
}

/** One line of the order, priced in CENTS like everything else in the schema. */
export interface ConfirmationLine {
  name: string
  quantity: number
  /** Line total in cents, options included — `orders.items[].subtotal`. */
  subtotal: number
  /** Chosen options, already rendered as labels ("Base crème", "Sans oignon"). */
  options?: string[]
  /** The diner's own note on this line. */
  notes?: string
}

/** One rate's contribution, straight from `computeOrderTotals().taxBreakdown`. */
export interface ConfirmationTaxLine {
  ratePercent: number
  /** Tax contained in the amount taxed at this rate, in cents. */
  taxAmount: number
}

export interface OrderConfirmationInput {
  orderNumber: string
  customerName: string
  type: OrderFulfilment
  /** The restaurant. A confirmation that does not say who it is from is spam. */
  store: {
    name: string
    address?: ConfirmationAddress
    phone?: string
  }
  items: ConfirmationLine[]
  /** Goods total in cents, tax included. */
  subtotal: number
  /** Tax contained in the total — never added to it. See `orderTotals.ts`. */
  taxAmount: number
  /** One entry per rate, so a 10 % / 20 % basket declares both. */
  taxBreakdown?: ConfirmationTaxLine[]
  deliveryFee?: number
  discount?: number
  /** What the diner actually paid, in cents. */
  total: number
  /** Only for a delivery order. */
  deliveryAddress?: ConfirmationAddress
  /** "card", "cash", "paypal"… — `orders.paymentMethod`. */
  paymentMethod?: string
  /**
   * The money has not changed hands yet — a cash order-ahead, collected for at
   * handover. The email confirms the order and must not thank the diner for a
   * payment they have not made.
   */
  paymentPending?: boolean
  /** Minutes, when the kitchen has an estimate instead. */
  estimatedPrepTime?: number
  /** The live order page, `/order/{id}?token={viewToken}`. */
  trackingUrl?: string
  /** The diner's note on the order as a whole. */
  notes?: string
}

/** A rendered email, ready for SES. */
export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

// ── Formatting ──────────────────────────────────────────────────────────────

/**
 * Cents to French money: `1200` becomes `12,00 €`.
 *
 * Hand-rolled rather than `Intl.NumberFormat`, so the output is identical in
 * the Convex runtime, in Node and in the tests. A confirmation email is the
 * document the diner keeps; the figures on it must not depend on which ICU data
 * happened to be compiled into the host.
 *
 * The space before the € is a non-breaking one, as French typography requires —
 * it is what stops "12,00" and "€" landing on separate lines in a narrow
 * mail client.
 */
export function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0
  const sign = safe < 0 ? "-" : ""
  const absolute = Math.abs(safe)
  const units = Math.floor(absolute / 100)
  const decimals = String(absolute % 100).padStart(2, "0")

  // Thousands separated by a non-breaking space: "1 234,50 €".
  const groupedUnits = String(units).replace(/\B(?=(\d{3})+(?!\d))/g, " ")

  return `${sign}${groupedUnits},${decimals} €`
}

/** `10` becomes `10 %`; `5.5` becomes `5,5 %`. */
export function formatRate(ratePercent: number): string {
  const rounded = Math.round(ratePercent * 100) / 100
  return `${String(rounded).replace(".", ",")} %`
}

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
]

/**
 * A timestamp as a French date and time: `12 mars 2026 à 19:30`.
 *
 * Rendered in the establishment's own wall-clock time when a `timeZone` is
 * given. A diner told "à 19:30" who arrives at 20:30 because the server
 * answered in UTC is a complaint, not a rounding error.
 */
// No caller in this file any more: its one use was the `scheduledFor` branch of
// `timingLine`, removed with the field (#413). Kept because this module is
// published as `@be-yours/core/aws/ses/order-confirmation`, so the name is
// on a client's API — the same reasoning `tasks/reference-themes-divergence.md`
// applies to the twenty consumer-free components in `packages/ui`.
export function formatDateTime(timestamp: number, timeZone?: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ""

  let day = date.getUTCDate()
  let month = date.getUTCMonth()
  let year = date.getUTCFullYear()
  let hours = date.getUTCHours()
  let minutes = date.getUTCMinutes()

  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(date)
      const read = (type: string) =>
        Number(parts.find((part) => part.type === type)?.value ?? NaN)
      const zoned = {
        day: read("day"),
        month: read("month"),
        year: read("year"),
        hour: read("hour"),
        minute: read("minute"),
      }
      if (Object.values(zoned).every((value) => Number.isFinite(value))) {
        day = zoned.day
        month = zoned.month - 1
        year = zoned.year
        hours = zoned.hour
        minutes = zoned.minute
      }
    } catch {
      // An unknown zone falls back to UTC rather than throwing: a confirmation
      // email is not worth losing over a mistyped timezone setting.
    }
  }

  const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  return `${day} ${MONTHS_FR[month]} ${year} à ${time}`
}

/** A postal address on one line. */
export function formatAddress(address: ConfirmationAddress): string {
  return [address.street, `${address.postalCode} ${address.city}`.trim()]
    .filter((part) => part && part.trim().length > 0)
    .join(", ")
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "Carte bancaire",
  stripe: "Carte bancaire",
  sumup: "Carte bancaire",
  paypal: "PayPal",
  cash: "Espèces",
  platform: "Réglée sur la plateforme",
}

/** "card" becomes "Carte bancaire"; anything unknown is left out entirely. */
export function paymentMethodLabel(method?: string): string | undefined {
  if (!method) return undefined
  return PAYMENT_METHOD_LABELS[method.toLowerCase()]
}

/**
 * The longest a free-text field may be on this email.
 *
 * The diner types their own name and their note, the restaurateur types product
 * names, and none of them is capped anywhere on the way in. An uncapped note is
 * an email that grows past what SES will accept — and a refused send is a diner
 * who hears nothing, which is the failure this whole email exists to close.
 */
const MAX_FREE_TEXT = 500

/** Free text, cut to a length an email can carry. */
export function clamp(value: string, limit: number = MAX_FREE_TEXT): string {
  const trimmed = value.trim()
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, limit - 1)}…`
}

/**
 * Escape text before it reaches HTML.
 *
 * Every string on this email comes from somewhere a stranger can write: the
 * diner types their own name and their note ("sans oignons"), the restaurateur
 * types product names. The original template interpolated all of them raw.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ── The copy ────────────────────────────────────────────────────────────────

/**
 * What happens next, in the diner's own terms.
 *
 * One sentence per fulfilment type, because "Adresse de livraison" printed over
 * a click-and-collect order is how a diner ends up waiting at home for food
 * sitting on a counter.
 */
export function fulfilmentLines(input: OrderConfirmationInput): {
  heading: string
  detail: string[]
} {
  const detail: string[] = []

  if (input.type === "delivery") {
    if (input.deliveryAddress) {
      detail.push(formatAddress(input.deliveryAddress))
      if (input.deliveryAddress.instructions) {
        detail.push(input.deliveryAddress.instructions)
      }
    }
    return { heading: "Livraison", detail }
  }

  if (input.type === "pickup") {
    if (input.store.address) detail.push(formatAddress(input.store.address))
    if (input.store.phone) detail.push(input.store.phone)
    return { heading: "À récupérer sur place", detail }
  }

  return { heading: "Sur place", detail }
}

/**
 * "Prête dans environ 20 minutes", when anything can say so.
 *
 * This used to open with a branch reading `scheduledFor` — "Prévue pour le 12
 * mars 2026 à 19:30". `orders.scheduledFor` had no writer: its only one was a
 * dead Uber Eats importer deleted with #313, and #363 had already removed the
 * sibling `scheduledAt` on the finding that customer-facing scheduled ordering
 * is a capability this product does not have. `orders.create` takes no time
 * argument at all. The branch was written in #367, after that ruling, against a
 * field that was already unbacked, and could never have run.
 *
 * The branch that remains did not run either, until now. `orderConfirmation.ts`
 * reads `order.estimatedPrepTime`, and `orders.create` wrote the prep time it
 * computes onto the **kitchen ticket** instead (`estimatedPrepTime:
 * summary.estimatedPrepTime`, inside the ticket insert) — a different document.
 * Nothing wrote the field this reads, so for every real order this returned
 * `undefined` and the confirmation email printed no timing row at all, and never
 * had. `orders.create` now stamps the longest line's preparation time onto the
 * order as well, off the products its verification loop already holds.
 *
 * Still `undefined` when no product in the basket declares a preparation time,
 * and that is deliberate: no row is honest, "environ 0 minutes" is not.
 */
export function timingLine(input: OrderConfirmationInput): string | undefined {
  if (input.estimatedPrepTime && input.estimatedPrepTime > 0) {
    return `Prête dans environ ${input.estimatedPrepTime} minutes`
  }
  return undefined
}

/** The subject line, named so the restaurant is recognisable in an inbox. */
export function orderConfirmationSubject(input: OrderConfirmationInput): string {
  return `${clamp(input.store.name, 80)} : votre commande ${input.orderNumber} est confirmée`
}

/** The one-line summary under the heading, in whichever state the order is. */
export function confirmationHeadline(input: OrderConfirmationInput): string {
  const store = clamp(input.store.name, 80)
  if (input.paymentPending) {
    return `${store} a bien reçu votre commande ${input.orderNumber}.`
  }
  return `${store} a bien reçu votre commande ${input.orderNumber} et votre paiement.`
}

/**
 * How the diner settles up, when they have not already.
 *
 * Cash is collected at handover, so the email has to say where and when rather
 * than leave someone turning up with a card.
 */
export function paymentDueLine(
  input: OrderConfirmationInput
): string | undefined {
  if (!input.paymentPending) return undefined
  if (input.type === "delivery") return "À régler à la livraison"
  return "À régler sur place"
}

// ── Rendering ───────────────────────────────────────────────────────────────

/** One line's label: "2 × Margherita". */
function lineLabel(item: ConfirmationLine): string {
  return `${item.quantity} × ${item.name}`
}

/** The money rows, in the order the diner reads them. */
function totalRows(
  input: OrderConfirmationInput
): Array<{ label: string; value: string; strong?: boolean }> {
  const rows: Array<{ label: string; value: string; strong?: boolean }> = [
    { label: "Sous-total", value: formatCents(input.subtotal) },
  ]

  if (input.discount && input.discount > 0) {
    rows.push({ label: "Remise", value: `−${formatCents(input.discount)}` })
  }
  if (input.deliveryFee && input.deliveryFee > 0) {
    rows.push({ label: "Livraison", value: formatCents(input.deliveryFee) })
  }

  rows.push({
    label: input.paymentPending ? "Total à régler" : "Total payé",
    value: formatCents(input.total),
    strong: true,
  })

  // The VAT is *contained* in the total, so it is stated under it rather than
  // added to it. One line per rate: a basket mixing food at 10 % and alcohol at
  // 20 % has to declare both.
  const breakdown = (input.taxBreakdown ?? []).filter((entry) => entry.taxAmount > 0)
  if (breakdown.length > 0) {
    for (const entry of breakdown) {
      rows.push({
        label: `dont TVA ${formatRate(entry.ratePercent)}`,
        value: formatCents(entry.taxAmount),
      })
    }
  } else if (input.taxAmount > 0) {
    rows.push({ label: "dont TVA", value: formatCents(input.taxAmount) })
  }

  return rows
}

/** The plain-text part. Sent alongside the HTML, never instead of it. */
export function renderOrderConfirmationText(
  input: OrderConfirmationInput,
  options: { timeZone?: string } = {}
): string {
  const fulfilment = fulfilmentLines(input)
  const timing = timingLine(input)
  const method = paymentMethodLabel(input.paymentMethod)

  const due = paymentDueLine(input)

  const lines: string[] = [
    `Bonjour ${clamp(input.customerName, 120)},`,
    "",
    confirmationHeadline(input),
    "",
    "VOTRE COMMANDE",
  ]

  for (const item of input.items) {
    lines.push(`- ${lineLabel(item)}  ${formatCents(item.subtotal)}`)
    for (const option of item.options ?? []) lines.push(`    ${clamp(option, 120)}`)
    if (item.notes) lines.push(`    « ${clamp(item.notes)} »`)
  }

  lines.push("")
  for (const row of totalRows(input)) {
    lines.push(`${row.label} : ${row.value}`)
  }
  if (due) lines.push(due)
  else if (method) lines.push(`Réglée par : ${method}`)

  lines.push("", fulfilment.heading.toUpperCase())
  for (const detail of fulfilment.detail) lines.push(detail)
  if (timing) lines.push(timing)

  if (input.notes) {
    lines.push("", "VOTRE MESSAGE", `« ${clamp(input.notes)} »`)
  }

  if (input.trackingUrl) {
    lines.push("", `Suivre votre commande : ${input.trackingUrl}`)
  }

  lines.push("", "Conservez cet email : il récapitule votre commande.")

  const footer = [input.store.name]
  if (input.store.address) footer.push(formatAddress(input.store.address))
  if (input.store.phone) footer.push(input.store.phone)
  lines.push("", footer.join(" · "))

  return lines.join("\n").trim()
}

/** The HTML part. Inline styles and no layout engine, so it survives Outlook. */
export function renderOrderConfirmationHtml(
  input: OrderConfirmationInput,
  options: { timeZone?: string } = {}
): string {
  const e = escapeHtml
  const fulfilment = fulfilmentLines(input)
  const timing = timingLine(input)
  const method = paymentMethodLabel(input.paymentMethod)

  const due = paymentDueLine(input)

  const itemsHtml = input.items
    .map((item) => {
      const extras = [
        ...(item.options ?? []).map(
          (option) =>
            `<div style="color:#6b7280;font-size:13px;">${e(clamp(option, 120))}</div>`
        ),
        item.notes
          ? `<div style="color:#6b7280;font-size:13px;font-style:italic;">« ${e(clamp(item.notes))} »</div>`
          : "",
      ]
        .filter(Boolean)
        .join("")

      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
          <div style="font-weight:600;color:#111827;">${e(lineLabel(item))}</div>
          ${extras}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;color:#111827;">
          ${e(formatCents(item.subtotal))}
        </td>
      </tr>`
    })
    .join("")

  const totalsHtml = totalRows(input)
    .map((row) => {
      const weight = row.strong ? "600" : "400"
      const size = row.strong ? "16px" : "14px"
      const colour = row.strong ? "#111827" : "#6b7280"
      const border = row.strong ? "border-top:1px solid #e5e7eb;" : ""
      return `<tr>
        <td style="padding:6px 0;${border}font-size:${size};font-weight:${weight};color:${colour};">${e(row.label)}</td>
        <td style="padding:6px 0;${border}font-size:${size};font-weight:${weight};color:${colour};text-align:right;white-space:nowrap;">${e(row.value)}</td>
      </tr>`
    })
    .join("")

  const fulfilmentHtml = [
    `<div style="font-weight:600;color:#111827;">${e(fulfilment.heading)}</div>`,
    ...fulfilment.detail.map(
      (detail) => `<div style="color:#374151;">${e(detail)}</div>`
    ),
    timing ? `<div style="color:#374151;">${e(timing)}</div>` : "",
  ]
    .filter(Boolean)
    .join("")

  const trackingHtml = input.trackingUrl
    ? `<p style="text-align:center;margin:28px 0 0;">
         <a href="${e(input.trackingUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Suivre ma commande</a>
       </p>`
    : ""

  const notesHtml = input.notes
    ? `<div style="margin-top:20px;padding:12px 14px;background:#f9fafb;border-radius:8px;">
         <div style="font-weight:600;color:#111827;font-size:13px;">Votre message</div>
         <div style="color:#374151;font-size:14px;">« ${e(clamp(input.notes))} »</div>
       </div>`
    : ""

  const footerParts = [input.store.name]
  if (input.store.address) footerParts.push(formatAddress(input.store.address))
  if (input.store.phone) footerParts.push(input.store.phone)

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${e(orderConfirmationSubject(input))}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border-radius:12px;padding:28px 24px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#111827;">Merci, votre commande est confirmée.</h1>
        <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">
          ${e(confirmationHeadline(input))}
        </p>

        <p style="margin:0 0 16px;color:#111827;">Bonjour ${e(clamp(input.customerName, 120))},</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          ${itemsHtml}
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px;">
          ${totalsHtml}
        </table>

        ${
          due
            ? `<p style="margin:10px 0 0;color:#111827;font-size:13px;font-weight:600;">${e(due)}</p>`
            : method
              ? `<p style="margin:10px 0 0;color:#6b7280;font-size:13px;">Réglée par ${e(method)}</p>`
              : ""
        }

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:14px;">
          ${fulfilmentHtml}
        </div>

        ${notesHtml}
        ${trackingHtml}
      </div>

      <p style="text-align:center;margin:20px 0 0;color:#6b7280;font-size:12px;">
        ${e(footerParts.join(" · "))}
      </p>
      <p style="text-align:center;margin:8px 0 0;color:#9ca3af;font-size:12px;">
        Conservez cet email : il récapitule votre commande.
      </p>
    </div>
  </body>
</html>`
}

/** Subject, HTML and text in one call — what a sender actually needs. */
export function renderOrderConfirmation(
  input: OrderConfirmationInput,
  options: { timeZone?: string } = {}
): RenderedEmail {
  return {
    subject: orderConfirmationSubject(input),
    html: renderOrderConfirmationHtml(input, options),
    text: renderOrderConfirmationText(input, options),
  }
}
