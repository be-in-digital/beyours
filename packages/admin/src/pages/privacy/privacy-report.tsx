"use client"

import { Badge } from "@be-yours/ui"

/**
 * What a request did, and — line by line — everything it did not.
 *
 * The second half is the reason this component exists. A report that lists
 * only what was deleted tells the operator the request was honoured in full
 * when it was not, and they then tell the customer the same thing. Every row
 * left standing is shown, with its reason, in the words the operator can quote
 * back in their reply.
 */

export interface PrivacyTally {
  table: string
  deleted: number
  anonymised: number
}

export interface PrivacyRetained {
  table: string
  count: number
  reason: string
}

export interface PrivacyReportShape {
  storeIds: string[]
  everyStore: boolean
  tallies: PrivacyTally[]
  retained: PrivacyRetained[]
  complete: boolean
}

/** What the owner calls each table. `orders` means nothing to a restaurateur. */
const TABLE_LABELS: Record<string, string> = {
  orders: "Commandes",
  kitchenTickets: "Tickets de cuisine",
  payments: "Paiements",
  deliveryQuotes: "Devis de livraison",
  promotionUsages: "Utilisations de promotions",
  contactMessages: "Messages du formulaire de contact",
  emailSubscribers: "Inscriptions à la newsletter",
  emailEvents: "Statistiques d'e-mails",
  emailAutomationRuns: "Scénarios d'e-mails déclenchés",
  gamePlays: "Parties de jeu",
  prizeRedemptions: "Lots gagnés",
  gameReferrals: "Parrainages",
  favorites: "Favoris",
  customerAddresses: "Adresses enregistrées",
  rateLimits: "Compteurs anti-abus",
  userProfiles: "Profil client",
  platformWebhookFailures: "File d'attente Uber Eats / Deliveroo",
  emailSegments: "Segments d'emailing",
  betterAuth: "Compte client (connexion)",
}

export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table
}

export function PrivacyReport({
  report,
  verb,
}: {
  report: PrivacyReportShape
  /** "seraient" for a preview, "ont été" once it has happened. */
  verb: "seraient" | "ont été"
}) {
  const touched = report.tallies.filter((t) => t.deleted + t.anonymised > 0)

  return (
    <div className="space-y-6">
      {!report.complete && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">Résultat partiel</p>
          <p className="mt-1">
            L&apos;analyse s&apos;est arrêtée avant la fin : les chiffres ci-dessous sont un
            minimum, pas un total. L&apos;effacement, lui, se poursuit tout seul jusqu&apos;au
            bout — revenez sur cette page dans quelques instants pour le vérifier.
          </p>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Données qui {verb} traitées
        </h3>
        {touched.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune donnée trouvée pour cette personne dans{" "}
            {report.everyStore
              ? "l'ensemble des établissements"
              : `${report.storeIds.length} établissement(s)`}
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {touched.map((tally) => (
              <li
                key={tally.table}
                className="flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm"
              >
                <span>{tableLabel(tally.table)}</span>
                <span className="flex shrink-0 gap-2">
                  {tally.deleted > 0 && (
                    <Badge variant="destructive">{tally.deleted} supprimée(s)</Badge>
                  )}
                  {tally.anonymised > 0 && (
                    <Badge variant="secondary">{tally.anonymised} anonymisée(s)</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {report.retained.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Ce qui est conservé, et pourquoi
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            À lire avant de répondre au client : une réponse qui annonce un effacement
            complet alors que ces lignes subsistent est une réponse fausse.
          </p>
          <ul className="space-y-2">
            {report.retained.map((note) => (
              <li key={note.table} className="rounded-md border px-3 py-2 text-sm">
                <p className="font-medium">
                  {tableLabel(note.table)}
                  {note.count > 0 ? ` — ${note.count} ligne(s)` : ""}
                </p>
                <p className="mt-1 text-muted-foreground">{note.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
