/**
 * « Votre commande est prête » (#96).
 *
 * WHAT WAS MISSING. The product told a diner their order was confirmed and then
 * said nothing else, ever. A click-and-collect customer had no way to know when
 * to walk over except by watching the tracking page, and a dining room's wall
 * screen only helps somebody already in the room. The audit's first finding under
 * Suivi de commande was "missing status notifications and ETAs".
 *
 * ONE TRANSITION, NOT ALL OF THEM. This fires on `ready` and on nothing else.
 * `preparing` tells a diner nothing they cannot infer, `out_for_delivery` is the
 * courier's own tracking, and `completed` arrives after they have the food — an
 * email per status change is four emails per order and a spam complaint waiting
 * to happen. `ready` is the one moment the diner has to act on.
 *
 * DELIVERY ORDERS GET NOTHING. « Prête » on a delivery means it has left the
 * kitchen, not that anything is expected of the diner, and telling them to come
 * and collect it would be wrong. `orderReadyRefusal` in
 * `convex-functions/orderReady.ts` makes that decision; this file only renders.
 *
 * Deliberately short. The confirmation carries the lines, the totals and the
 * VAT; this carries a number, a place and a time, because that is what somebody
 * reading it on a telephone in the street needs.
 */

import {
  clamp,
  escapeHtml,
  formatAddress,
  formatDateTime,
  type ConfirmationAddress,
  type OrderFulfilment,
} from "./order-confirmation"

export interface OrderReadyInput {
  orderNumber: string
  customerName: string
  fulfilment: OrderFulfilment
  store: {
    name: string
    address?: ConfirmationAddress
    phone?: string
  }
  /** When the kitchen announced it, for the line that says how fresh it is. */
  readyAt: number
  /** The table, for a dine-in order. */
  tableNumber?: string
  /** The live order page, when the deployment has a URL and the order a token. */
  trackingUrl?: string
}

export interface RenderedReadyEmail {
  subject: string
  html: string
  text: string
}

export function orderReadySubject(input: OrderReadyInput): string {
  return `Votre commande ${clamp(input.orderNumber, 40)} est prête`
}

/**
 * What the diner is being asked to do.
 *
 * `dine_in` is the case that reads oddly if it is not written for: the diner is
 * already sitting down, so nothing is asked of them and the sentence says the
 * food is on its way to the table rather than telling them to fetch it.
 */
export function readyHeadline(input: OrderReadyInput): string {
  if (input.fulfilment === "dine_in") {
    return input.tableNumber
      ? `Votre commande arrive à la table ${clamp(input.tableNumber, 40)}.`
      : "Votre commande arrive à votre table."
  }
  return `Votre commande vous attend chez ${clamp(input.store.name, 120)}.`
}

export function renderOrderReadyText(
  input: OrderReadyInput,
  options: { timeZone?: string } = {}
): string {
  const lines: string[] = [
    `Bonjour ${clamp(input.customerName, 120)},`,
    "",
    readyHeadline(input),
    "",
    `Commande : ${clamp(input.orderNumber, 40)}`,
    `Prête à : ${formatDateTime(input.readyAt, options.timeZone)}`,
  ]

  if (input.fulfilment === "pickup" && input.store.address) {
    lines.push("", "OÙ LA RÉCUPÉRER", formatAddress(input.store.address))
  }
  if (input.store.phone) lines.push(`Téléphone : ${input.store.phone}`)
  if (input.trackingUrl) lines.push("", `Suivi : ${input.trackingUrl}`)

  lines.push("", clamp(input.store.name, 120))
  return lines.join("\n")
}

export function renderOrderReadyHtml(
  input: OrderReadyInput,
  options: { timeZone?: string } = {}
): string {
  const e = escapeHtml
  const footerParts = [input.store.name]
  if (input.store.address) footerParts.push(formatAddress(input.store.address))
  if (input.store.phone) footerParts.push(input.store.phone)

  const pickupHtml =
    input.fulfilment === "pickup" && input.store.address
      ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:14px;color:#111827;">
            <strong style="display:block;margin-bottom:4px;">Où la récupérer</strong>
            ${e(formatAddress(input.store.address))}
          </div>`
      : ""

  const trackingHtml = input.trackingUrl
    ? `<div style="margin-top:24px;">
            <a href="${e(input.trackingUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;">Voir ma commande</a>
          </div>`
    : ""

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${e(orderReadySubject(input))}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border-radius:12px;padding:28px 24px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#111827;">C'est prêt.</h1>
        <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">${e(readyHeadline(input))}</p>

        <p style="margin:0 0 16px;color:#111827;">Bonjour ${e(clamp(input.customerName, 120))},</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;">Commande</td>
            <td style="padding:6px 0;text-align:right;color:#111827;font-weight:600;">${e(clamp(input.orderNumber, 40))}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;">Prête à</td>
            <td style="padding:6px 0;text-align:right;color:#111827;">${e(formatDateTime(input.readyAt, options.timeZone))}</td>
          </tr>
        </table>

        ${pickupHtml}
        ${trackingHtml}
      </div>

      <p style="text-align:center;margin:20px 0 0;color:#6b7280;font-size:12px;">
        ${e(footerParts.join(" · "))}
      </p>
    </div>
  </body>
</html>`
}

/** Subject, HTML and text in one call — what a sender actually needs. */
export function renderOrderReady(
  input: OrderReadyInput,
  options: { timeZone?: string } = {}
): RenderedReadyEmail {
  return {
    subject: orderReadySubject(input),
    html: renderOrderReadyHtml(input, options),
    text: renderOrderReadyText(input, options),
  }
}
