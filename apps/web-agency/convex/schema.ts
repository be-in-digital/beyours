import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Schema Convex AGENCE — back-office beindigital.fr
 *
 * Historique :
 * - Decision Log #21 + #27 : Convex agence SÉPARÉ du Convex resto (deployment
 *   distinct). Le contenu marketing (case studies, pages) reste en Sanity /
 *   MDX build-time — JAMAIS en Convex.
 * - Extension back-office : CRM + facturier + appels d'offres + copilote IA.
 *   Scope strict `apps/web-agency`. Aucune réutilisation du Convex resto.
 * - Auth : Convex Auth (`@convex-dev/auth`), provider Password. Les tables
 *   d'auth (`...authTables`) sont gérées par la lib ; on étend `users` avec
 *   le rôle métier (RBAC back-office).
 *
 * Conventions (cf. guidelines.md) :
 * - Montants stockés en CENTIMES entiers (`*Cents`) — jamais de flottant € brut.
 * - Listes potentiellement non bornées => table dédiée + clé étrangère
 *   (`activities`, `tenderDocuments`). Les lignes de devis/facture restent en
 *   tableau imbriqué : bornées, réécrites atomiquement à chaque édition.
 * - Numérotation légale continue => compteur dénormalisé transactionnel
 *   (`counters`), incrémenté dans la mutation d'émission. JAMAIS un LLM.
 * - Ownership : on référence l'utilisateur par `v.id("users")` (idiome Convex
 *   Auth `getAuthUserId`), jamais un identifiant passé en argument client.
 */

// ── Validateurs réutilisables ────────────────────────────────────────────────

const addressValidator = v.object({
  line1: v.string(),
  line2: v.optional(v.string()),
  postalCode: v.string(),
  city: v.string(),
  country: v.string(),
});

/** Coordonnées de facturation figées (snapshot) sur un devis/une facture. */
const billToValidator = v.object({
  name: v.string(),
  legalName: v.optional(v.string()),
  siret: v.optional(v.string()),
  /** TVA intracommunautaire du client. */
  vatNumber: v.optional(v.string()),
  email: v.optional(v.string()),
  address: v.optional(addressValidator),
});

/** Ligne de devis/facture. `vatRate` en % (0, 5.5, 10, 20…). */
const lineValidator = v.object({
  label: v.string(),
  description: v.optional(v.string()),
  quantity: v.number(),
  unitPriceCents: v.number(),
  vatRate: v.number(),
});

/** Ventilation TVA par taux — mention légale obligatoire sur la facture. */
const vatBucketValidator = v.object({
  rate: v.number(),
  baseCents: v.number(),
  vatCents: v.number(),
});

const roleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
);

// ── Schéma ───────────────────────────────────────────────────────────────────

export default defineSchema({
  // ══ Auth (Convex Auth) ═══════════════════════════════════════════════════════
  ...authTables,
  /**
   * `users` surchargé : on garde les champs standard écrits par les providers
   * (email pour Password) et on ajoute le RBAC métier. Nouvel inscrit => aucun
   * `role` => aucun accès back-office tant qu'un owner ne l'a pas activé
   * (cf. `users.grantAccess`).
   */
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(roleValidator),
    active: v.optional(v.boolean()),
  }).index("email", ["email"]),

  // ══ Inbox leads entrants (form contact, cf. contactForms.ts) ═════════════════
  contactSubmissions: defineTable({
    name: v.string(),
    email: v.string(),
    message: v.string(),
    createdAt: v.number(),
    /** Hash SHA-256 de l'IP — anonymisation anti-spam sans PII. */
    ipHashed: v.string(),
    /** Honeypot field : si rempli → spam confirmé. */
    honeypotTriggered: v.boolean(),
    /** Statut de traitement : new → read → replied → archived. */
    status: v.union(
      v.literal("new"),
      v.literal("read"),
      v.literal("replied"),
      v.literal("archived"),
    ),
    /** Renseigné une fois converti en contact CRM (dédup / traçabilité). */
    convertedContactId: v.optional(v.id("contacts")),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // ══ CRM ══════════════════════════════════════════════════════════════════════
  companies: defineTable({
    name: v.string(),
    siret: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    website: v.optional(v.string()),
    sector: v.optional(v.string()),
    address: v.optional(addressValidator),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    /** Responsable du compte. */
    ownerId: v.optional(v.id("users")),
    createdById: v.id("users"),
  })
    .index("by_owner", ["ownerId"])
    .searchIndex("search_name", { searchField: "name" }),

  contacts: defineTable({
    firstName: v.string(),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    /** Origine : entrant (form) ou sortant (prospection de qualité). */
    source: v.union(
      v.literal("contact_form"),
      v.literal("manual"),
      v.literal("import"),
      v.literal("referral"),
      v.literal("outbound"),
      v.literal("other"),
    ),
    /** Qualification prospect. */
    stage: v.union(
      v.literal("lead"),
      v.literal("qualified"),
      v.literal("customer"),
      v.literal("disqualified"),
    ),
    ownerId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    createdById: v.id("users"),
  })
    .index("by_company", ["companyId"])
    .index("by_owner", ["ownerId"])
    .index("by_email", ["email"])
    .index("by_stage", ["stage"])
    .searchIndex("search_name", { searchField: "lastName" }),

  deals: defineTable({
    title: v.string(),
    contactId: v.optional(v.id("contacts")),
    companyId: v.optional(v.id("companies")),
    stage: v.union(
      v.literal("new"),
      v.literal("qualified"),
      v.literal("proposal"),
      v.literal("negotiation"),
      v.literal("won"),
      v.literal("lost"),
    ),
    /** Montant estimé HT en centimes. */
    valueCents: v.optional(v.number()),
    currency: v.string(),
    source: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    expectedCloseDate: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    lostReason: v.optional(v.string()),
    createdById: v.id("users"),
  })
    .index("by_stage", ["stage"])
    .index("by_owner", ["ownerId"])
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"]),

  /** Timeline (notes, appels, emails, tâches) — non bornée => table dédiée. */
  activities: defineTable({
    dealId: v.optional(v.id("deals")),
    contactId: v.optional(v.id("contacts")),
    companyId: v.optional(v.id("companies")),
    type: v.union(
      v.literal("note"),
      v.literal("call"),
      v.literal("email"),
      v.literal("meeting"),
      v.literal("task"),
      v.literal("system"),
    ),
    content: v.string(),
    /** Pour les tâches. */
    dueAt: v.optional(v.number()),
    doneAt: v.optional(v.number()),
    authorId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_deal", ["dealId"])
    .index("by_contact", ["contactId"])
    .index("by_company", ["companyId"]),

  // ══ Facturier ════════════════════════════════════════════════════════════════
  /**
   * Compteurs séquentiels légaux (une clé par type/année, ex "invoice:2026").
   * Incrément transactionnel dans la mutation d'émission => numérotation
   * continue et inaltérable, garantie serveur.
   */
  counters: defineTable({
    key: v.string(),
    value: v.number(),
  }).index("by_key", ["key"]),

  /** Devis — objet commercial, éditable tant que non accepté. */
  quotes: defineTable({
    number: v.string(),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    billTo: billToValidator,
    lines: v.array(lineValidator),
    currency: v.string(),
    totalHTCents: v.number(),
    totalVatCents: v.number(),
    totalTTCCents: v.number(),
    /** Ex : "TVA non applicable, art. 293 B du CGI" (franchise en base). */
    vatExemptionMention: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("refused"),
      v.literal("expired"),
      v.literal("cancelled"),
    ),
    validUntil: v.optional(v.number()),
    notes: v.optional(v.string()),
    terms: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    refusedAt: v.optional(v.number()),
    /** Facture générée à l'acceptation. */
    convertedInvoiceId: v.optional(v.id("invoices")),
    pdfStorageId: v.optional(v.id("_storage")),
    createdById: v.id("users"),
  })
    .index("by_number", ["number"])
    .index("by_status", ["status"])
    .index("by_company", ["companyId"])
    .index("by_deal", ["dealId"]),

  /** Facture — objet légal, immuable après émission (corrections = avoir). */
  invoices: defineTable({
    number: v.string(),
    quoteId: v.optional(v.id("quotes")),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    billTo: billToValidator,
    lines: v.array(lineValidator),
    currency: v.string(),
    totalHTCents: v.number(),
    totalVatCents: v.number(),
    totalTTCCents: v.number(),
    /** Ventilation par taux — mention légale. */
    vatBreakdown: v.optional(v.array(vatBucketValidator)),
    vatExemptionMention: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("issued"),
      v.literal("paid"),
      v.literal("partially_paid"),
      v.literal("overdue"),
      v.literal("cancelled"),
    ),
    /** Fixé à l'émission (draft => pas encore de valeur légale). */
    issuedAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    paymentTerms: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    paidAmountCents: v.optional(v.number()),
    // ── Adaptateur d'émission (enfichable — finalisé au jalon facturier) ───────
    /** `pdf` = PDF conforme (légal jusqu'à 09/2027) ; `facturx_pa` = via PA. */
    emissionMode: v.union(v.literal("pdf"), v.literal("facturx_pa")),
    format: v.optional(
      v.union(
        v.literal("pdf"),
        v.literal("facturx"),
        v.literal("ubl"),
        v.literal("cii"),
      ),
    ),
    /** Statut de transmission via Plateforme Agréée (mode facturx_pa). */
    transmissionStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("rejected"),
      ),
    ),
    /** Référence externe (PA / facturier tiers) si applicable. */
    externalId: v.optional(v.string()),
    pdfStorageId: v.optional(v.id("_storage")),
    createdById: v.id("users"),
  })
    .index("by_number", ["number"])
    .index("by_status", ["status"])
    .index("by_company", ["companyId"])
    .index("by_issuedAt", ["issuedAt"]),

  /** Avoir — seule voie de correction d'une facture émise. */
  creditNotes: defineTable({
    number: v.string(),
    invoiceId: v.id("invoices"),
    reason: v.string(),
    billTo: billToValidator,
    lines: v.array(lineValidator),
    currency: v.string(),
    totalHTCents: v.number(),
    totalVatCents: v.number(),
    totalTTCCents: v.number(),
    issuedAt: v.number(),
    pdfStorageId: v.optional(v.id("_storage")),
    createdById: v.id("users"),
  })
    .index("by_invoice", ["invoiceId"])
    .index("by_number", ["number"]),

  // ══ Appels d'offres ══════════════════════════════════════════════════════════
  tenders: defineTable({
    title: v.string(),
    buyer: v.optional(v.string()),
    reference: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    deadline: v.optional(v.number()),
    status: v.union(
      v.literal("identified"),
      v.literal("analyzing"),
      v.literal("go"),
      v.literal("no_go"),
      v.literal("submitted"),
      v.literal("won"),
      v.literal("lost"),
    ),
    estimatedValueCents: v.optional(v.number()),
    dealId: v.optional(v.id("deals")),
    ownerId: v.optional(v.id("users")),
    /** Synthèse du cahier des charges (extrait IA, validé humain). */
    requirements: v.optional(v.string()),
    goNoGoNotes: v.optional(v.string()),
    createdById: v.id("users"),
  })
    .index("by_status", ["status"])
    .index("by_owner", ["ownerId"])
    .index("by_deadline", ["deadline"]),

  /** Documents de réponse (générés par l'IA, validés humain) — table dédiée. */
  tenderDocuments: defineTable({
    tenderId: v.id("tenders"),
    kind: v.union(
      v.literal("memoire_technique"),
      v.literal("candidature"),
      v.literal("methodologie"),
      v.literal("planning"),
      v.literal("cover_letter"),
      v.literal("other"),
    ),
    title: v.string(),
    contentMarkdown: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("draft"),
      v.literal("generated"),
      v.literal("reviewed"),
      v.literal("final"),
    ),
    generatedByAI: v.boolean(),
    createdById: v.id("users"),
  }).index("by_tender", ["tenderId"]),
});
