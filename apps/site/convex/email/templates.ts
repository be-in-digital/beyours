/**
 * Transactional + notification email templates — pure builders.
 *
 * Each returns { subject, html, text }. HTML is composed from the branded
 * blocks in ./layout; the text version is always provided (deliverability +
 * clients that strip HTML). No Convex/runtime import: unit-testable.
 */

import {
  BRAND,
  button,
  dateFr,
  detailRows,
  emailShell,
  escapeHtml,
  euros,
  heading,
  infoBox,
  muted,
  paragraph,
  totalLine,
} from "./layout"

export interface BuiltEmail {
  subject: string
  html: string
  text: string
}

type Plan = "essentielle" | "premium"

const PLAN_LABEL: Record<Plan, string> = {
  essentielle: "Essentielle",
  premium: "Premium",
}

const PAYMENT_LABEL: Record<string, string> = {
  card: "Carte bancaire",
  alma: "Alma (paiement en plusieurs fois)",
  klarna: "Klarna",
}

function textDoc(lines: string[]): string {
  return [...lines, "", `${BRAND.name} — Restauration`].join("\n")
}

// ── 1. Order confirmation (after payment) ────────────────────────────────────

export interface OrderConfirmationData {
  firstName: string
  restaurantName: string
  plan: Plan
  orderType: "creation" | "maintenance"
  amountCents: number
  paymentMethod?: string
  isFounders?: boolean
  logoUrl: string
  bookingUrl?: string
  /**
   * Back to `/checkout/success?orderId=…` (#528).
   *
   * Optional, because the id is not always to hand at send time and a missing
   * link must degrade to no line rather than to a broken one.
   */
  orderUrl?: string
}

export function orderConfirmationEmail(data: OrderConfirmationData): BuiltEmail {
  const planLabel = PLAN_LABEL[data.plan]
  const isCreation = data.orderType === "creation"
  const rows: Array<[string, string]> = [
    ["Formule", `${planLabel}${data.isFounders ? " (offre fondateurs)" : ""}`],
    ["Prestation", isCreation ? "Création du site + 1ʳᵉ année de maintenance" : "Maintenance"],
    ["Établissement", escapeHtml(data.restaurantName)],
  ]
  if (data.paymentMethod) {
    rows.push(["Paiement", PAYMENT_LABEL[data.paymentMethod] ?? "Carte bancaire"])
  }

  const nextSteps = infoBox(
    `<strong style="color:${BRAND.ink};">La suite :</strong> notre équipe vous contacte sous 24h ouvrées pour lancer votre projet. Préparez le contenu de votre restaurant (menu, photos, horaires, logo), on s'occupe du reste.`,
  )

  const cta = data.bookingUrl
    ? button("Réserver mon rendez-vous de lancement", data.bookingUrl)
    : ""

  /*
   * The link back to the order (#528).
   *
   * `components/checkout/kickoff-gate.tsx` tells a buyer who reaches
   * `/checkout/success` without a valid `orderId`: « Si vous venez de payer,
   * ouvrez le lien reçu par email. » This mail carried no such link. Its only
   * CTA is the booking URL, which goes straight to the booking tool and past
   * the gate — so the page's one instruction pointed at something that did not
   * exist, and a buyer who closed the tab had no way back.
   *
   * Muted rather than a second button: the booking CTA is what we want pressed.
   * This is the one that has to EXIST.
   */
  const backToOrder = data.orderUrl
    ? muted(
        `Besoin de revenir à votre commande ? <a href="${data.orderUrl}" style="color:${BRAND.ink};">Ouvrir ma commande</a>`,
      )
    : ""

  const contentHtml = [
    heading(`Merci ${escapeHtml(data.firstName)}, c'est confirmé.`),
    paragraph(
      `Votre paiement a bien été reçu. Bienvenue chez ${BRAND.name}, on est ravis de digitaliser <strong>${escapeHtml(data.restaurantName)}</strong>.`,
    ),
    detailRows(rows),
    totalLine("Payé", data.amountCents),
    nextSteps,
    cta,
    backToOrder,
    muted("Une question ? Répondez simplement à cet email, on vous lit."),
  ].join("")

  return {
    subject: `Commande confirmée — ${planLabel} pour ${data.restaurantName}`,
    html: emailShell({
      preheader: "Votre paiement est confirmé, voici la suite.",
      logoUrl: data.logoUrl,
      contentHtml,
    }),
    text: textDoc([
      `Merci ${data.firstName}, c'est confirmé.`,
      "",
      "Votre paiement a bien été reçu.",
      `Formule : ${planLabel}${data.isFounders ? " (offre fondateurs)" : ""}`,
      `Prestation : ${isCreation ? "Création + 1ère année de maintenance" : "Maintenance"}`,
      `Établissement : ${data.restaurantName}`,
      `Payé : ${euros(data.amountCents)}`,
      "",
      "La suite : notre équipe vous contacte sous 24h ouvrées pour lancer votre projet.",
      data.bookingUrl ? `Réserver votre rendez-vous : ${data.bookingUrl}` : "",
      data.orderUrl ? `Revenir à votre commande : ${data.orderUrl}` : "",
    ].filter(Boolean)),
  }
}

// ── 2. Maintenance renewal receipt ───────────────────────────────────────────

export interface RenewalReceiptData {
  plan: Plan
  amountCents: number
  logoUrl: string
  invoiceUrl?: string
  periodStartMs?: number
  periodEndMs?: number
}

export function renewalReceiptEmail(data: RenewalReceiptData): BuiltEmail {
  const planLabel = PLAN_LABEL[data.plan]
  const period =
    data.periodStartMs && data.periodEndMs
      ? `${dateFr(data.periodStartMs)} au ${dateFr(data.periodEndMs)}`
      : null

  const rows: Array<[string, string]> = [["Formule", `Maintenance ${planLabel}`]]
  if (period) rows.push(["Période couverte", period])

  const contentHtml = [
    heading("Votre maintenance est renouvelée"),
    paragraph(
      "Merci de votre confiance. Votre site reste couvert, à jour et supervisé. Aucune action de votre part n'est nécessaire.",
    ),
    detailRows(rows),
    totalLine("Montant réglé", data.amountCents),
    data.invoiceUrl ? button("Télécharger ma facture", data.invoiceUrl) : "",
    muted("Une question sur votre abonnement ? Répondez à cet email."),
  ].join("")

  return {
    subject: `Maintenance renouvelée — ${planLabel}`,
    html: emailShell({
      preheader: "Votre maintenance a été renouvelée avec succès.",
      logoUrl: data.logoUrl,
      contentHtml,
    }),
    text: textDoc([
      "Votre maintenance est renouvelée.",
      "",
      `Formule : Maintenance ${planLabel}`,
      period ? `Période : ${period}` : "",
      `Montant réglé : ${euros(data.amountCents)}`,
      data.invoiceUrl ? `Facture : ${data.invoiceUrl}` : "",
    ].filter(Boolean)),
  }
}

// ── 3. Failed-payment follow-up (dunning) ────────────────────────────────────

export interface PaymentFailedData {
  amountCents: number
  logoUrl: string
  updateUrl?: string
}

export function paymentFailedEmail(data: PaymentFailedData): BuiltEmail {
  const contentHtml = [
    heading("Votre paiement n'a pas abouti"),
    paragraph(
      `Le prélèvement de <strong>${euros(data.amountCents)}</strong> pour votre maintenance a échoué. C'est souvent une carte expirée ou un plafond atteint, rien de grave.`,
    ),
    infoBox(
      "Mettez à jour votre moyen de paiement pour garder votre site couvert. Une nouvelle tentative sera effectuée automatiquement.",
    ),
    data.updateUrl ? button("Mettre à jour mon paiement", data.updateUrl) : "",
    muted("Si vous avez déjà régularisé, ignorez cet email."),
  ].join("")

  return {
    subject: "Action requise — votre paiement a échoué",
    html: emailShell({
      preheader: "Mettez à jour votre moyen de paiement pour garder votre site couvert.",
      logoUrl: data.logoUrl,
      contentHtml,
    }),
    text: textDoc([
      "Votre paiement n'a pas abouti.",
      "",
      `Le prélèvement de ${euros(data.amountCents)} pour votre maintenance a échoué.`,
      "Mettez à jour votre moyen de paiement pour garder votre site couvert.",
      data.updateUrl ? `Mettre à jour : ${data.updateUrl}` : "",
    ].filter(Boolean)),
  }
}

// ── 4. Contact-request confirmation (to the prospect) ────────────────────────

export interface ContactConfirmationData {
  firstName: string
  logoUrl: string
  discoverUrl?: string
}

export function contactConfirmationEmail(data: ContactConfirmationData): BuiltEmail {
  const contentHtml = [
    heading(`Message bien reçu, ${escapeHtml(data.firstName)}`),
    paragraph(
      "Merci de votre intérêt pour BeYours. Un membre de l'équipe revient vers vous très vite, en général sous 24h ouvrées.",
    ),
    paragraph("En attendant, découvrez ce que vos clients vivraient sur votre futur site :"),
    data.discoverUrl ? button("Voir la démo interactive", data.discoverUrl) : "",
    muted("Vous pouvez répondre directement à cet email pour tout complément."),
  ].join("")

  return {
    subject: "Nous avons bien reçu votre message",
    html: emailShell({
      preheader: "Merci, notre équipe revient vers vous sous 24h.",
      logoUrl: data.logoUrl,
      contentHtml,
    }),
    text: textDoc([
      `Message bien reçu, ${data.firstName}.`,
      "",
      "Un membre de l'équipe revient vers vous sous 24h ouvrées.",
      data.discoverUrl ? `Découvrez la démo : ${data.discoverUrl}` : "",
    ].filter(Boolean)),
  }
}

// ── 5. Team notification: new contact lead ───────────────────────────────────

export interface ContactTeamData {
  name: string
  email: string
  restaurant?: string
  message: string
  submittedAtMs: number
  logoUrl: string
}

export function contactTeamNotificationEmail(data: ContactTeamData): BuiltEmail {
  const rows: Array<[string, string]> = [
    ["Nom", escapeHtml(data.name)],
    ["Email", escapeHtml(data.email)],
  ]
  if (data.restaurant) rows.push(["Restaurant", escapeHtml(data.restaurant)])
  rows.push(["Reçu le", dateFr(data.submittedAtMs)])

  const contentHtml = [
    heading("Nouveau message de contact"),
    detailRows(rows),
    infoBox(escapeHtml(data.message).replace(/\n/g, "<br>")),
    button("Répondre au prospect", `mailto:${encodeURIComponent(data.email)}`),
  ].join("")

  return {
    subject: `[Lead] ${data.name}${data.restaurant ? ` — ${data.restaurant}` : ""}`,
    html: emailShell({
      preheader: `Nouveau lead : ${data.name}`,
      logoUrl: data.logoUrl,
      contentHtml,
      footerLines: ["Notification interne BeYours"],
    }),
    text: textDoc([
      "Nouveau message de contact",
      "",
      `Nom : ${data.name}`,
      `Email : ${data.email}`,
      data.restaurant ? `Restaurant : ${data.restaurant}` : "",
      `Reçu le : ${dateFr(data.submittedAtMs)}`,
      "",
      "Message :",
      data.message,
    ].filter(Boolean)),
  }
}

// ── 5b. Team notification: a sale ────────────────────────────────────────────

/**
 * The sale nobody was told about (#528).
 *
 * `checkout.session.completed` scheduled exactly one send — the buyer's
 * confirmation — and that email promises a call « sous 24h ». Nothing told
 * anybody here that there was a call to make. `BID_NOTIFY_EMAIL` served contact
 * leads and supervision alerts; the one event the business exists for went to
 * nobody, and the 24 hours start when the buyer pays, not when somebody next
 * opens the ops console.
 *
 * Everything needed to make that call is in the mail, because an alert whose
 * only possible response is "go and look it up" has moved the work rather than
 * done it: who bought, for which establishment, which plan, how much, and a
 * `mailto:` and a `tel:` that work from a phone.
 */
export interface OrderTeamData {
  orderId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  restaurantName: string
  city?: string
  plan: string
  orderType: string
  billingPeriod?: string
  amountCents: number
  paymentMethod: string
  isFounders: boolean
  paidAtMs: number
  logoUrl: string
  consoleUrl?: string
}

export function orderTeamNotificationEmail(data: OrderTeamData): BuiltEmail {
  const who = `${data.firstName} ${data.lastName}`.trim()

  const rows: Array<[string, string]> = [
    ["Établissement", escapeHtml(data.restaurantName)],
    ["Client", escapeHtml(who)],
    ["Email", escapeHtml(data.email)],
  ]
  if (data.phone) rows.push(["Téléphone", escapeHtml(data.phone)])
  if (data.city) rows.push(["Ville", escapeHtml(data.city)])
  rows.push(["Offre", escapeHtml(data.plan)])
  rows.push(["Type", escapeHtml(data.orderType)])
  if (data.billingPeriod) rows.push(["Facturation", escapeHtml(data.billingPeriod)])
  rows.push(["Montant", euros(data.amountCents)])
  rows.push(["Paiement", escapeHtml(data.paymentMethod)])
  if (data.isFounders) rows.push(["Fondateurs", "oui"])
  rows.push(["Payé le", dateFr(data.paidAtMs)])
  rows.push(["Commande", escapeHtml(data.orderId)])

  const contentHtml = [
    heading("Nouvelle vente"),
    paragraph(
      // The deadline, on the screen, because it is the only part of this mail
      // that is a decision rather than a fact.
      `L'email de confirmation promet un appel <strong>sous 24h</strong> à ${escapeHtml(who)}.`,
    ),
    detailRows(rows),
    button("Appeler le client", `tel:${encodeURIComponent(data.phone ?? "")}`),
    data.consoleUrl ? button("Ouvrir la commande", data.consoleUrl) : "",
  ]
    .filter(Boolean)
    .join("")

  return {
    subject: `[Vente] ${data.restaurantName} — ${data.plan} — ${euros(data.amountCents)}`,
    html: emailShell({
      preheader: `Nouvelle vente : ${data.restaurantName}`,
      logoUrl: data.logoUrl,
      contentHtml,
      footerLines: ["Notification interne BeYours"],
    }),
    text: textDoc(
      [
        "Nouvelle vente",
        "",
        `L'email de confirmation promet un appel sous 24h à ${who}.`,
        "",
        `Établissement : ${data.restaurantName}`,
        `Client : ${who}`,
        `Email : ${data.email}`,
        data.phone ? `Téléphone : ${data.phone}` : "",
        data.city ? `Ville : ${data.city}` : "",
        `Offre : ${data.plan}`,
        `Type : ${data.orderType}`,
        data.billingPeriod ? `Facturation : ${data.billingPeriod}` : "",
        `Montant : ${euros(data.amountCents)}`,
        `Paiement : ${data.paymentMethod}`,
        data.isFounders ? "Fondateurs : oui" : "",
        `Payé le : ${dateFr(data.paidAtMs)}`,
        `Commande : ${data.orderId}`,
      ].filter(Boolean),
    ),
  }
}

// ── 6. Referral programme: affiliate welcome ─────────────────────────────────

export interface AffiliateWelcomeData {
  firstName: string
  logoUrl: string
  dashboardUrl?: string
}

export function affiliateWelcomeEmail(data: AffiliateWelcomeData): BuiltEmail {
  const contentHtml = [
    heading(`Bienvenue dans le programme, ${escapeHtml(data.firstName)}`),
    paragraph(
      "Votre compte apporteur d'affaires est créé. Recommandez BeYours aux restaurateurs autour de vous et touchez une commission sur chaque client apporté.",
    ),
    infoBox(
      "Prochaine étape : signez votre contrat d'apporteur (vous recevez un email dédié) et configurez vos coordonnées de virement depuis votre tableau de bord.",
    ),
    data.dashboardUrl ? button("Accéder à mon tableau de bord", data.dashboardUrl) : "",
  ].join("")

  return {
    subject: "Bienvenue dans le programme de parrainage BeYours",
    html: emailShell({
      preheader: "Votre compte apporteur d'affaires est créé.",
      logoUrl: data.logoUrl,
      contentHtml,
    }),
    text: textDoc([
      `Bienvenue dans le programme, ${data.firstName}.`,
      "",
      "Votre compte apporteur d'affaires est créé.",
      "Prochaine étape : signez votre contrat et configurez vos coordonnées de virement.",
      data.dashboardUrl ? `Tableau de bord : ${data.dashboardUrl}` : "",
    ].filter(Boolean)),
  }
}

// ── 7. Referral programme: commission validated / paid ───────────────────────

export interface AffiliateCommissionData {
  amountCents: number
  logoUrl: string
  customerLabel?: string
  paid: boolean
  dashboardUrl?: string
}

export function affiliateCommissionEmail(data: AffiliateCommissionData): BuiltEmail {
  const title = data.paid ? "Votre commission a été versée" : "Nouvelle commission validée";
  const lead = data.paid
    ? `Le virement de <strong>${euros(data.amountCents)}</strong> est en route vers votre compte.`
    : `Une commission de <strong>${euros(data.amountCents)}</strong> vient d'être validée${data.customerLabel ? ` pour ${escapeHtml(data.customerLabel)}` : ""}. Elle sera versée à la prochaine échéance.`

  const contentHtml = [
    heading(title),
    paragraph(lead),
    totalLine(data.paid ? "Versé" : "Commission", data.amountCents),
    data.dashboardUrl ? button("Voir mes gains", data.dashboardUrl) : "",
  ].join("")

  return {
    subject: data.paid
      ? `Commission versée — ${euros(data.amountCents)}`
      : `Commission validée — ${euros(data.amountCents)}`,
    html: emailShell({
      preheader: data.paid ? "Votre virement est en route." : "Une nouvelle commission est validée.",
      logoUrl: data.logoUrl,
      contentHtml,
    }),
    text: textDoc([
      title,
      "",
      data.paid
        ? `Le virement de ${euros(data.amountCents)} est en route.`
        : `Commission de ${euros(data.amountCents)} validée${data.customerLabel ? ` pour ${data.customerLabel}` : ""}.`,
      data.dashboardUrl ? `Tableau de bord : ${data.dashboardUrl}` : "",
    ].filter(Boolean)),
  }
}

// ── 8. Monitoring: a client site changed health ──────────────────────────────

/**
 * The e-mail #346's prober never sent.
 *
 * That prober is good work: two targets per deployment, every ten minutes,
 * thirty days of history, and it refuses to invent a `/health` route it cannot
 * rely on. It alerts nobody. On a health transition it wrote one row to an
 * internal activity feed, under the reasoning that *"still down" is not news* —
 * true for a feed, fatal for a guarantee. A restaurant that goes down at 20 h 00
 * on a Saturday paged no one, while « Monitoring 24/7 » was on the pricing page
 * and « la supervision » is in the CGV's definition of Maintenance. Issue #366.
 *
 * Sent on the TRANSITION, in both directions. A recovery is as much news as a
 * failure: without it the only way to know a site came back is to go and look,
 * and an operator who has been paged needs the all-clear more than they need a
 * second alarm.
 */
export interface DeploymentHealthData {
  restaurantName: string
  domain: string
  /** Where it was, and where it is now. */
  previousHealth: string
  health: string
  /** Rolling 30-day availability, when the round produced one. */
  uptime30d?: number
  /** What the failing probe said, truncated by the prober. */
  message?: string
  changedAtMs: number
  consoleUrl: string
  logoUrl: string
}

/** Human wording for the four values `saDeployments.health` can hold. */
const HEALTH_FR: Record<string, string> = {
  healthy: "en ligne",
  degraded: "dégradé",
  down: "hors ligne",
  unknown: "inconnu",
}

const healthLabel = (value: string): string => HEALTH_FR[value] ?? value

export function deploymentHealthEmail(data: DeploymentHealthData): BuiltEmail {
  const recovered = data.health === "healthy"
  const rows: Array<[string, string]> = [
    ["Établissement", escapeHtml(data.restaurantName)],
    ["Domaine", escapeHtml(data.domain)],
    ["État", `${healthLabel(data.previousHealth)} → ${healthLabel(data.health)}`],
    ["Constaté le", dateFr(data.changedAtMs)],
  ]
  if (data.uptime30d !== undefined) {
    rows.push(["Disponibilité 30 j", `${data.uptime30d.toFixed(2)} %`])
  }

  /* Escaped here rather than trusted. The name comes from `saDeployments`,
     which the team types into the console — so it is not attacker-controlled
     today, and every other template in this file escapes anyway. A rule that
     holds only where someone remembered is not a rule. */
  const name = escapeHtml(data.restaurantName)

  const contentHtml = [
    heading(
      recovered
        ? `${name} est de nouveau en ligne`
        : `${name} est ${healthLabel(data.health)}`,
    ),
    detailRows(rows),
    ...(data.message && !recovered ? [infoBox(escapeHtml(data.message))] : []),
    button("Ouvrir la console", data.consoleUrl),
    muted(
      "Cet e-mail est envoyé à chaque changement d'état, dans les deux sens. Une sonde qui reste au rouge ne le renvoie pas.",
    ),
  ].join("")

  return {
    // The prefix is what an inbox rule and a phone notification match on, so
    // it stays first and stays stable.
    subject: `[Monitoring] ${data.restaurantName} — ${healthLabel(data.health)}`,
    html: emailShell({
      preheader: `${name} : ${healthLabel(data.previousHealth)} → ${healthLabel(data.health)}`,
      logoUrl: data.logoUrl,
      contentHtml,
      footerLines: ["Notification interne BeYours — supervision"],
    }),
    text: textDoc(
      [
        recovered
          ? `${data.restaurantName} est de nouveau en ligne`
          : `${data.restaurantName} est ${healthLabel(data.health)}`,
        "",
        `Domaine : ${data.domain}`,
        `État : ${healthLabel(data.previousHealth)} → ${healthLabel(data.health)}`,
        data.uptime30d !== undefined ? `Disponibilité 30 j : ${data.uptime30d.toFixed(2)} %` : "",
        `Constaté le : ${dateFr(data.changedAtMs)}`,
        data.message && !recovered ? `` : "",
        data.message && !recovered ? `Détail : ${data.message}` : "",
        "",
        `Console : ${data.consoleUrl}`,
      ].filter(Boolean),
    ),
  }
}
