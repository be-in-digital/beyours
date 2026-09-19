"use client"

/**
 * Accepting or refusing a Deliveroo order (#103, #104).
 *
 * WHAT WAS MISSING. `storeIntegrations.orderMode` offers three settings —
 * `auto_accept`, `auto_reject` and `manual` — and the webhook honours the first
 * two. Under `manual` it logged the mode and did nothing else, so the order sat
 * in the product with **no control anywhere** that could accept or refuse it. A
 * restaurant that chose manual had no way to run a service: the audit's "missing
 * manual Deliveroo controls" and "trapped failed deliveries".
 *
 * RENDERS ITSELF AWAY unless there is a decision to make — same pattern as
 * `UberDirectPanel` beside it. A Deliveroo order already confirmed, already
 * cancelled, or in the kitchen needs no buttons, and a panel that appeared on
 * every order would teach staff to ignore it.
 *
 * REFUSING NAMES A REASON, because Deliveroo shows it to the diner. « Occupé » and
 * « rupture d'un ingrédient » are different messages to somebody waiting for
 * dinner, and the platform's own vocabulary is what it accepts.
 */

import { useState } from "react"
import { useAction } from "convex/react"
import { toast } from "sonner"
import { Bike, Check, Loader2, X } from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@be-yours/ui"

/** The reasons Deliveroo accepts, in its own vocabulary, as an owner reads them. */
export const DELIVEROO_REJECT_REASONS: Array<{ value: string; label: string }> = [
  { value: "busy", label: "Trop de commandes" },
  { value: "closing_early", label: "Fermeture anticipée" },
  { value: "ingredient_unavailable", label: "Rupture d'un ingrédient" },
  { value: "customer_called_to_cancel", label: "Le client a annulé par téléphone" },
  { value: "other", label: "Autre raison" },
]

/**
 * The statuses at which a decision is still owed.
 *
 * `pending` is an order the webhook recorded and left alone under `manual`.
 * `confirmed` is NOT here: Deliveroo has already been told, and a second accept
 * would be a call the platform refuses.
 */
const AWAITING_DECISION = new Set(["pending"])

export interface DeliverooDecisionPanelProps {
  orderId: string
  /** Where the order came from. Anything but `deliveroo` renders nothing. */
  source?: string
  status?: string
  /** Convex api object, injected by the host app. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api: any
}

export function DeliverooDecisionPanel({
  orderId,
  source,
  status,
  api,
}: DeliverooDecisionPanelProps) {
  const [reason, setReason] = useState("busy")
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null)

  const accept = useAction(api?.deliverooOrderDecision?.accept)
  const reject = useAction(api?.deliverooOrderDecision?.reject)

  // Nothing to decide: not a Deliveroo order, or one that has already moved.
  if (source !== "deliveroo" || !status || !AWAITING_DECISION.has(status)) return null

  /** The refusals the action returns rather than throws, in French. */
  const explain = (code?: string) => {
    switch (code) {
      case "deliveroo_not_configured":
        return "Deliveroo n'est pas configuré sur ce déploiement."
      case "not_a_deliveroo_order":
        return "Cette commande ne vient pas de Deliveroo."
      case "order_not_found":
        return "Cette commande n'existe plus."
      default:
        return "Deliveroo a refusé la demande."
    }
  }

  const run = async (which: "accept" | "reject") => {
    setBusy(which)
    try {
      if (which === "accept") {
        const result = (await accept({ orderId })) as { accepted: boolean; reason?: string }
        if (result.accepted) toast.success("Commande acceptée sur Deliveroo")
        else toast.error(explain(result.reason))
      } else {
        const result = (await reject({ orderId, reason })) as {
          rejected: boolean
          reason?: string
        }
        if (result.rejected) toast.success("Commande refusée sur Deliveroo")
        else toast.error(explain(result.reason))
      }
    } catch (error: unknown) {
      // The platform call threw, which means nothing moved on either side — the
      // action calls Deliveroo before touching the internal status precisely so
      // this case leaves the order still awaiting a decision.
      toast.error("Deliveroo n'a pas répondu. La commande reste en attente.")
      console.error(error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Bike className="h-4 w-4" aria-hidden="true" />
          Commande Deliveroo à traiter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Deliveroo attend votre réponse. Tant qu&apos;elle n&apos;est pas donnée,
          le client ne sait pas si sa commande est prise.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => run("accept")} disabled={busy !== null}>
            {busy === "accept" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Accepter
          </Button>

          <div className="flex items-center gap-2">
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-[220px]" aria-label="Motif du refus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVEROO_REJECT_REASONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => run("reject")}
              disabled={busy !== null}
            >
              {busy === "reject" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <X className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Refuser
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {/* Stated because it changes what the diner is told, and because a
              restaurant refusing an order wants to know the money is handled. */}
          Le motif est transmis à Deliveroo, qui l&apos;affiche au client. Un refus
          annule la commande et libère le stock ; le remboursement est fait par
          Deliveroo, qui a encaissé.
        </p>
      </CardContent>
    </Card>
  )
}
