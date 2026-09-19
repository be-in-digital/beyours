"use client"

/**
 * The platform events that never became orders (#525).
 *
 * WHY THIS SCREEN DID NOT EXIST. `platformWebhookFailures` is the dead-letter
 * queue for Uber Eats and Deliveroo: an event whose store could not be
 * identified, an order the platform would not hand over, an accept it refused.
 * `listUnresolved` and `markResolved` are wrapped and guarded on `orders:read`
 * in both apps — and rendered by nothing. So a dropped order was written down,
 * kept, and visible to nobody.
 *
 * It is the failure mode with the worst shape in the product: the diner has
 * ordered and paid on the platform, the kitchen never hears about it, and every
 * screen an owner can open looks entirely normal.
 *
 * NOT SCOPED TO AN ESTABLISHMENT, on purpose. An entry whose reason is
 * `unidentified_store` has, by definition, no establishment — which is why the
 * server checks the permission directly instead of going through `storeQuery`,
 * and why this panel sits above the per-store cards.
 *
 * RESOLVING IS A NOTE, NOT A RETRY. There is no re-delivery: the platforms
 * stopped retrying long before a human read this. « Traité » records that
 * somebody looked and dealt with it — by telephone, usually — so the queue
 * shows what is still outstanding rather than everything that ever failed.
 */

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { AlertTriangle, Check } from "lucide-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@be-yours/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { convexErrorMessage } from "../../lib/convex-error"
import { formatDate } from "../../lib/formatters"

/** One unresolved event, as `platformWebhookFailures.listUnresolved` returns it. */
interface WebhookFailure {
  _id: string
  platform: "uberEats" | "deliveroo"
  eventType?: string
  externalOrderId?: string
  platformStoreId?: string
  reason: string
  detail?: string
  receivedAt: number
}

const PLATFORM_LABELS: Record<string, string> = {
  uberEats: "Uber Eats",
  deliveroo: "Deliveroo",
}

/**
 * What each reason means for the person reading it.
 *
 * Written as what to DO, not as what the code called it: « no_integrations » on
 * a screen is a log line, and an operator has to translate it before they can
 * act. The keys are the schema's own literals.
 */
const REASON_LABELS: Record<string, string> = {
  no_integrations: "Aucune intégration active pour cette plateforme",
  unidentified_store: "L'événement ne nommait aucun établissement",
  unknown_store: "Établissement inconnu ou intégration désactivée",
  ambiguous_store: "Plusieurs établissements correspondent",
  fetch_failed: "La commande n'a pas pu être récupérée chez la plateforme",
  accept_failed: "La plateforme a refusé notre acceptation",
  processing_failed: "L'événement n'a pas pu être appliqué",
}

export function WebhookFailuresPanel() {
  const { api } = useAdminApiStore()
  const [busyId, setBusyId] = useState<string | null>(null)

  const failures = useQuery(
    api?.platformWebhookFailures?.listUnresolved,
    api?.platformWebhookFailures?.listUnresolved ? {} : "skip"
  ) as WebhookFailure[] | undefined

  const markResolved = useMutation(api?.platformWebhookFailures?.markResolved)

  const handleResolve = async (failure: WebhookFailure) => {
    setBusyId(failure._id)
    try {
      await markResolved({ id: failure._id })
      toast.success("Événement marqué comme traité")
    } catch (error: unknown) {
      toast.error(convexErrorMessage(error, "L'enregistrement a échoué"))
      console.error(error)
    } finally {
      setBusyId(null)
    }
  }

  /*
   * Three states, and the loading one speaks. This is a queue somebody opens the
   * integrations tab specifically to check after a platform incident: an empty
   * tab while the query is in flight reads as "nothing was dropped", and that is
   * the conclusion this panel exists to stop somebody drawing. Same reasoning as
   * the unmatched-import panel above it (#531).
   */
  if (failures === undefined) {
    return (
      <Card data-testid="webhook-failures-loading">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            <AlertTriangle
              className="mr-2 inline h-4 w-4 align-[-3px] text-muted-foreground"
              aria-hidden="true"
            />
            Commandes de plateforme non traitées
          </CardTitle>
          <CardDescription className="mt-1">
            Recherche des événements Uber Eats et Deliveroo qui n&apos;ont pas pu
            devenir des commandes…
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  // Nothing outstanding is the ordinary state, and a permanent empty card on
  // every integrations tab is noise.
  if (failures.length === 0) return null

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">
          <AlertTriangle
            className="mr-2 inline h-4 w-4 align-[-3px] text-destructive"
            aria-hidden="true"
          />
          Commandes de plateforme non traitées
          <Badge variant="destructive" className="ml-2">
            {failures.length}
          </Badge>
        </CardTitle>
        <CardDescription className="mt-1">
          Ces commandes ont été passées et payées sur la plateforme, et la cuisine
          ne les a jamais reçues. Traitez-les par téléphone avec la plateforme,
          puis marquez-les comme traitées.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {failures.map((failure) => (
          <div
            key={failure._id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {PLATFORM_LABELS[failure.platform] ?? failure.platform}
                {failure.externalOrderId ? ` · ${failure.externalOrderId}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {REASON_LABELS[failure.reason] ?? failure.reason}
                {failure.detail ? ` — ${failure.detail}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(failure.receivedAt)}
                {failure.eventType ? ` · ${failure.eventType}` : ""}
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              disabled={busyId === failure._id}
              onClick={() => void handleResolve(failure)}
            >
              <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Marquer traité
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
