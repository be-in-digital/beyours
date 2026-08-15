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

// ── 1. Confirmation de commande (après paiement) ─────────────────────────────

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

  const contentHtml = [
    heading(`Merci ${escapeHtml(data.firstName)}, c'est confirmé.`),
    paragraph(
      `Votre paiement a bien été reçu. Bienvenue chez ${BRAND.name}, on est ravis de digitaliser <strong>${escapeHtml(data.restaurantName)}</strong>.`,
    ),
    detailRows(rows),
    totalLine("Payé", data.amountCents),
    nextSteps,
    cta,
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
    ].filter(Boolean)),
  }
}

// ── 2. Reçu de renouvellement maintenance ────────────────────────────────────

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

// ── 3. Relance paiement échoué (dunning) ─────────────────────────────────────

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

// ── 4. Confirmation de prise de contact (au prospect) ────────────────────────

export interface ContactConfirmationData {
  firstName: string
  logoUrl: string
  discoverUrl?: string
}

export function contactConfirmationEmail(data: ContactConfirmationData): BuiltEmail {
  const contentHtml = [
    heading(`Message bien reçu, ${escapeHtml(data.firstName)}`),
    paragraph(
      "Merci de votre intérêt pour Be in Digital. Un membre de l'équipe revient vers vous très vite, en général sous 24h ouvrées.",
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

// ── 5. Notification équipe : nouveau lead de contact ─────────────────────────

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
      footerLines: ["Notification interne Be in Digital"],
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

// ── 6. Parrainage : bienvenue affilié ────────────────────────────────────────

export interface AffiliateWelcomeData {
  firstName: string
  logoUrl: string
  dashboardUrl?: string
}

export function affiliateWelcomeEmail(data: AffiliateWelcomeData): BuiltEmail {
  const contentHtml = [
    heading(`Bienvenue dans le programme, ${escapeHtml(data.firstName)}`),
    paragraph(
      "Votre compte apporteur d'affaires est créé. Recommandez Be in Digital aux restaurateurs autour de vous et touchez une commission sur chaque client apporté.",
    ),
    infoBox(
      "Prochaine étape : signez votre contrat d'apporteur (vous recevez un email dédié) et configurez vos coordonnées de virement depuis votre tableau de bord.",
    ),
    data.dashboardUrl ? button("Accéder à mon tableau de bord", data.dashboardUrl) : "",
  ].join("")

  return {
    subject: "Bienvenue dans le programme de parrainage Be in Digital",
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

// ── 7. Parrainage : commission validée / versée ──────────────────────────────

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
