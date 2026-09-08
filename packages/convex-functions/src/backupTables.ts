/**
 * What a backup carries, what a restore puts back, and what neither touches.
 *
 * WHY THIS EXISTS. The list used to be written out twice — once in
 * `system.exportBackup` as the export order, once in `systemInternal.ts` as an
 * import allow-list — and the two had to agree by hand. They named 22 of this
 * schema's 77 tables. Omitted, among others: `orders`, `payments`,
 * `kitchenTickets`, `translations`, and **all sixteen `cms*` singletons** — so a
 * "backup" of a restaurant's website did not contain that website's pages, and
 * a restore reached zero orders. The maintenance fee was sold on « Sauvegardes
 * automatiques quotidiennes de vos données et contenus ». Issues #169, #366.
 *
 * One list, imported by both, and a test that checks it against the schema
 * itself rather than against a reader's memory.
 *
 * ## The three groups, and why a table is in one rather than another
 *
 * `BACKUP_TABLES` — exported and restored. The establishment's own data.
 *
 * `EXPORT_ONLY_TABLES` — written into the file, never re-inserted by a restore.
 * A fiscal series and its counter belong here and nowhere else: `invoices.ts`
 * states the rule in the schema itself — *"It is never edited and never
 * deleted… `system.importBackup` must not restore them: a fiscal series that a
 * restore can rewrite is not a series"* (art. 242 nonies A CGI). Leaving them
 * out of the import is also what keeps `orders.invoiceId` correct across a
 * restore: the invoice rows are never re-inserted, so their ids never change,
 * so the reference still resolves. On a REBUILT deployment they do not exist at
 * all, and the restore says so instead of pretending.
 *
 * `EXCLUDED_TABLES` — absent from the file, each with the reason in this file
 * rather than in someone's head. Credentials, identities, and rows that are a
 * cache or a window rather than a record.
 *
 * ## Diner data, and the retention window
 *
 * `orders`, `payments`, `kitchenTickets` and `emailSubscribers` are personal
 * data (`DINER_TABLES` in `privacy.ts` is the authority). A backup that outlives
 * the retention purge would resurrect what the establishment was obliged to
 * remove, so `importBackup` schedules `privacy.sweepExpiredCustomerData` after a
 * restore: anything past its window is carried away again immediately rather
 * than quietly coming back. The backup file's OWN retention is the S3 lifecycle
 * rule that `setup-aws.sh` installs over `backups/`.
 *
 * @module backupTables
 */

/**
 * Exported and restored, in dependency order.
 *
 * The order is a topological sort of the foreign-key graph, and it has to stay
 * one: `importTable` rewrites a row's ids through the map of everything already
 * inserted, so a reference can only be fixed once its target is in. The graph is
 * not written out here — `backup-tables.test.ts` derives it from the schema's
 * own validators and fails when this order stops being a valid sort, which is
 * the only version of this check that cannot go stale.
 *
 * Two edges the order deliberately breaks are declared in
 * `DEFERRED_REMAP_TABLES` below.
 */
export const BACKUP_TABLES = [
  // ── Configuration ──
  "globalSettings",
  "stores",
  "storeIntegrations",
  "teamMembers",
  "languages",

  // ── Catalogue ──
  "categories",
  "products",
  "menus",
  "promotions",

  // ── Gamification ──
  "prizes",
  "games",
  "gameQRCodes",
  "requiredActions",
  "gamePlays",
  "prizeRedemptions",
  "gameReferrals",

  // ── Translations ──
  "translations",

  // ── CMS: block-based pages, and the media they point at ──
  "cmsMedia",
  "cmsPages",
  "cmsBlocks",

  // ── Blog ──
  "blogCategories",
  "blogTags",
  "blogArticles",
  "blogArticleTags",
  "blogAutoConfig",
  "ownerEntitlements",

  // ── Email marketing ──
  "emailConfig",
  "emailTemplates",
  "emailSegments",
  "emailSubscribers",
  "emailCampaigns",
  "emailAutomations",

  /* ── The sixteen CMS singletons ──
     Every page of the storefront a client edits: the home page, the menu, the
     cart, the checkout, the legal pages. None of them was in a backup, which
     is what made "a backup of a restaurant's website" untrue in the plainest
     possible sense. `cms` first: the other fifteen reference it. */
  "cms",
  "cmsHome",
  "cmsMenu",
  "cmsAbout",
  "cmsContact",
  "cmsBlogPosts",
  "cmsCart",
  "cmsCheckout",
  "cmsTracking",
  "cmsSignin",
  "cmsSignup",
  "cmsPrivacy",
  "cmsTerms",
  "cms404",
  "cmsMaintenance",
  "cmsAccount",

  /* ── Trade ──
     Last, because everything they reference comes before them. `orders` also
     references `invoices`, which is export-only — see this module's header for
     why that reference survives a restore anyway. */
  "orders",
  "payments",
  "kitchenTickets",
  "promotionUsages",
  "contactMessages",
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]

/**
 * In the file, never re-inserted by a restore.
 *
 * A backup that omitted these would lose an establishment's fiscal archive,
 * which is the opposite of what a backup is for. A restore that re-inserted
 * them would rewrite a numbered series that the law requires to be unbroken and
 * un-edited. Both are answered by carrying them and refusing to import them.
 */
export const EXPORT_ONLY_TABLES = [
  /* art. 242 nonies A CGI. The rule is stated in the schema itself; see the
     header of `tables/invoices.ts`. */
  "invoices",
  /* The counter behind the series. Restoring it would hand out numbers that
     have already been issued — the same defect as restoring the invoices, one
     level down. */
  "numberSequences",
  /* An audit log's value is that nothing rewrites it. A restore that replaced
     it would erase the record of the restore's own predecessors. */
  "systemAuditLog",
] as const

export type ExportOnlyTable = (typeof EXPORT_ONLY_TABLES)[number]

/** Everything the export walks: restorable first, then the archive. */
export const EXPORTED_TABLES = [...BACKUP_TABLES, ...EXPORT_ONLY_TABLES] as const

/**
 * Tables re-walked with the FULL id map after the last insert.
 *
 * The foreign-key graph has cycles, so no order can satisfy every edge. Each
 * one here is an edge the order breaks on purpose:
 *
 * - `stores` → `categories`, through `stores.stationMapping[].categoryId`.
 *   `categories` cannot come first (it references `stores`), so the mapping was
 *   restored pointing at categories that no longer existed. Silently: every
 *   ticket fell back to the single-station behaviour and nobody was told the
 *   kitchen routing had been lost.
 *
 * `remapIds` rewrites any string the map knows, anywhere in a row, so a second
 * pass costs one patch per row and needs no per-field knowledge.
 */
export const DEFERRED_REMAP_TABLES = ["stores"] as const

/**
 * Fields stripped on the way out.
 *
 * A backup is a JSON file an administrator downloads to whatever laptop they
 * were sitting at. A live single-use credential must not be in it — and two
 * were: an unexpired team invitation grants a role to whoever opens the link,
 * and a double-opt-in token confirms a subscription on someone else's behalf.
 * Both fields are optional in the schema, so a restore simply comes back
 * without them and the invitation is re-sent.
 */
export const REDACTED_BACKUP_FIELDS: Readonly<Record<string, readonly string[]>> = {
  teamMembers: ["invitationToken"],
  emailSubscribers: ["doubleOptInToken"],
}

/** Why a table is absent, in the words the manifest shows the operator. */
export interface ExcludedTable {
  table: string
  /** French: this reaches a client through the backup manifest. */
  reason: string
}

/**
 * Absent from the file, deliberately, each with its reason.
 *
 * The manifest carries this list verbatim, so an operator reading a backup can
 * see what it does not contain without reading this file. "Not in the export"
 * and "we forgot" used to look identical from the outside; that is the whole
 * defect #169 names.
 */
export const EXCLUDED_TABLES: readonly ExcludedTable[] = [
  // ── Credentials ──
  {
    table: "paymentConnections",
    reason:
      "Identifiants de paiement chiffrés. Un fichier de sauvegarde n'est pas un coffre : reconnectez Stripe, SumUp ou PayPal après une restauration.",
  },
  {
    table: "uberEatsConnections",
    reason:
      "Jeton Uber Eats chiffré. Se reconstitue en réautorisant l'application côté Uber.",
  },

  // ── Identities ──
  {
    table: "userProfiles",
    reason:
      "Comptes et rôles, rattachés à une identité d'authentification externe qu'une sauvegarde ne peut pas transporter. La restauration met à jour les établissements auxquels chaque profil a accès plutôt que de remplacer les profils.",
  },
  {
    table: "favorites",
    reason: "Favoris d'un client, rattachés à son compte — voir userProfiles.",
  },
  {
    table: "customerAddresses",
    reason: "Adresses enregistrées d'un client, rattachées à son compte — voir userProfiles.",
  },

  // ── Caches, windows and counters ──
  {
    table: "paymentEvents",
    reason: "Fenêtre anti-doublon des webhooks, 30 jours. Se reconstitue seule.",
  },
  {
    table: "cardProviderHealth",
    reason:
      "Verdict du fournisseur sur la clé de CE déploiement. Se reconstitue à la " +
      "prochaine vérification horaire, et n'aurait aucun sens restauré ailleurs.",
  },
  { table: "oauthStates", reason: "États OAuth éphémères, valables quelques minutes." },
  { table: "rateLimits", reason: "Compteurs de limitation de débit, éphémères." },
  { table: "deliveryQuotes", reason: "Devis de livraison expirés côté transporteur." },
  {
    table: "translationJobs",
    reason: "Journal des lots de traduction. Les traductions elles-mêmes sont sauvegardées.",
  },
  { table: "emailAutomationRuns", reason: "Journal d'exécution des scénarios." },
  { table: "emailEvents", reason: "Statistiques d'ouverture et de clic, dérivées des envois." },
  { table: "blogAutoQueue", reason: "File d'attente de génération, replanifiée automatiquement." },
  { table: "blogAutoUsage", reason: "Compteurs de quota mensuel." },
  { table: "prizeIssuance", reason: "Compteurs de lots distribués, recalculés." },
  {
    table: "platformWebhookFailures",
    reason: "Journal technique des livraisons de webhooks en échec.",
  },

  // ── Rebuilt by a resynchronisation ──
  {
    table: "externalProductMappings",
    reason:
      "Correspondances de produits Uber Eats / Deliveroo, reconstruites par une resynchronisation du menu.",
  },
  {
    table: "orphanProducts",
    reason: "Produits vus sur une plateforme et non appariés, reconstruits par la même synchronisation.",
  },

  // ── Ours, not the establishment's ──
  {
    table: "maintenanceContracts",
    reason: "Contrat de maintenance, écrit par BeInDigital et non par l'établissement.",
  },
  { table: "platformReleases", reason: "Catalogue des versions du moteur, écrit par BeInDigital." },
  { table: "migrationRequests", reason: "Demandes de migration adressées à BeInDigital." },
]

/** Membership test used by both the export and the import allow-list. */
export function isBackupTable(name: string): name is BackupTable {
  return (BACKUP_TABLES as readonly string[]).includes(name)
}

/** Membership test for the export, which is wider than the import. */
export function isExportedTable(name: string): boolean {
  return (EXPORTED_TABLES as readonly string[]).includes(name)
}

/** Removes the single-use credentials named in `REDACTED_BACKUP_FIELDS`. */
export function redactExportedRow<T extends Record<string, unknown>>(
  tableName: string,
  row: T,
): T {
  const fields = REDACTED_BACKUP_FIELDS[tableName]
  if (!fields) return row

  const out = { ...row }
  for (const field of fields) delete out[field]
  return out
}
