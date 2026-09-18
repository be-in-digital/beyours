"use client"

import { useQuery } from "convex/react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@be-yours/ui"
import { hasPermission, type Role } from "@be-yours/core"
import { sellerIsComplete } from "@be-yours/convex-functions/invoices"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { adminRoutes } from "../../config/admin-routes"

/**
 * Warns, on the screen the owner opens every day, that the deployment cannot
 * issue invoices.
 *
 * `issueInvoiceForOrder` deliberately answers `{ issued: false }` instead of
 * failing a payment while `globalSettings.seller` is incomplete — and until
 * #375 nothing surfaced that answer, so a fresh deployment took money for
 * weeks with no legal invoice and no warning anywhere. The banner stays until
 * the identity is complete; `sellerIsComplete` is the engine's own rule, so
 * the banner and the refusal cannot disagree.
 *
 * Shown only to holders of `settings:write` — the people who can actually fix
 * it (exactly SUPER_ADMIN and CLIENT_ADMIN). Whether go-live should hard-
 * require the identity is the owner's call, recorded elsewhere; this banner
 * is the honest middle.
 */
export function SellerIncompleteBanner() {
  const api = useAdminApiStore((s) => s.api)
  const role = useAdminAuthStore((s) => s.role)
  const settings = useQuery(
    api?.globalSettings?.get ?? ("skip" as never),
    api ? {} : "skip"
  )

  if (!hasPermission(role as Role, "settings:write")) return null
  // Still loading: say nothing rather than flash a warning at every open.
  if (settings === undefined) return null
  if (sellerIsComplete((settings as { seller?: unknown } | null)?.seller)) return null

  return (
    <Alert variant="warning" data-testid="seller-incomplete-banner">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Identité de l&apos;établissement incomplète</AlertTitle>
      <AlertDescription>
        Les commandes encaissées ne génèrent aucune facture tant que la raison
        sociale n&apos;est pas renseignée.{" "}
        <Link
          href={`${adminRoutes.settings}?tab=billing`}
          className="font-medium underline underline-offset-2"
        >
          Compléter dans les paramètres
        </Link>
      </AlertDescription>
    </Alert>
  )
}
