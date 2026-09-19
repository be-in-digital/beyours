"use client"

/**
 * Whether the Uber Eats merchant account is actually connected (#274).
 *
 * WHAT WAS MISSING. `uberEatsConnections.getStatus` was written to be this
 * screen — its docblock says "safe metadata for the admin UI" — and it had no
 * Convex wrapper and no caller, and neither did `disconnect`. So an owner who
 * completed the OAuth consent had no way to tell whether it had taken, and no
 * way to end it. The only evidence a connection existed was a menu sync
 * succeeding or failing, after the fact.
 *
 * ONE CONNECTION FOR THE WHOLE ACCOUNT. The row is a deployment-wide singleton,
 * not a per-store credential: the per-store half is the store id and the sync
 * settings on the card below. The heading says so, because a card repeated on
 * every store's tab otherwise reads as something to configure per store.
 *
 * AN EXPIRED TOKEN IS NOT A CONNECTION. `status` is written at the moment of the
 * exchange and never revised, so a row can say `connected` long after its access
 * token died. With a refresh token the next sync renews it silently; without
 * one, nothing will, and the owner has to consent again. That distinction is the
 * only thing on this card they cannot work out for themselves.
 */

import { useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { Loader2, Plug, Unplug } from "lucide-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@be-yours/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { convexErrorMessage } from "../../lib/convex-error"
import { formatDate } from "../../lib/formatters"

/** What `uberEatsConnections.getStatus` answers. `null` means never connected. */
interface UberEatsConnectionStatus {
  status: "connected" | "disconnected" | "error"
  merchantUserId?: string
  scope?: string
  connectedAt?: number
  tokenExpiresAt?: number
  hasRefreshToken: boolean
}

/**
 * What the owner is told, and whether the connection can still be used.
 *
 * Exported so the rule is testable without a DOM: the interesting case is a row
 * that still says `connected` over a token that expired with nothing to renew it.
 */
export function describeConnection(
  connection: UberEatsConnectionStatus | null | undefined,
  now: number
): { label: string; tone: "live" | "attention" | "off"; detail: string | null } {
  if (!connection) {
    return {
      label: "Non connecté",
      tone: "off",
      detail: "Connectez le compte marchand pour synchroniser la carte et recevoir les commandes.",
    }
  }

  if (connection.status === "error") {
    return {
      label: "En erreur",
      tone: "attention",
      detail: "Uber Eats a refusé la dernière opération. Reconnectez le compte.",
    }
  }

  if (connection.status === "disconnected") {
    return {
      label: "Déconnecté",
      tone: "off",
      detail: "Le compte a été déconnecté. Reconnectez-le pour reprendre la synchronisation.",
    }
  }

  const expired =
    connection.tokenExpiresAt !== undefined && connection.tokenExpiresAt <= now

  if (expired && !connection.hasRefreshToken) {
    return {
      label: "À reconnecter",
      tone: "attention",
      detail:
        "L'autorisation a expiré et rien ne peut la renouveler automatiquement. Reconnectez le compte marchand.",
    }
  }

  if (expired) {
    return {
      label: "Connecté",
      tone: "live",
      detail: "L'autorisation sera renouvelée automatiquement à la prochaine synchronisation.",
    }
  }

  return { label: "Connecté", tone: "live", detail: null }
}

const TONE_VARIANTS = {
  live: "default",
  attention: "destructive",
  off: "secondary",
} as const

export function UberEatsConnectionCard({
  hasUberEatsGlobal,
}: {
  hasUberEatsGlobal: boolean | undefined
}) {
  const { api } = useAdminApiStore()
  const [isWorking, setIsWorking] = useState(false)

  const connection = useQuery(api?.uberEatsConnections?.getStatus, {}) as
    | UberEatsConnectionStatus
    | null
    | undefined

  const authorizeUrl = useAction(api?.uberEatsOAuth?.generateAuthorizeUrl)
  const disconnect = useMutation(api?.uberEatsConnections?.disconnect)

  const described = describeConnection(connection, Date.now())
  const isConnected = connection?.status === "connected"

  const handleConnect = async () => {
    setIsWorking(true)
    try {
      const { url } = await authorizeUrl({})
      window.location.href = url
    } catch (error: unknown) {
      // The action throws when the deployment carries no Uber Eats client
      // credentials, which is a different problem from a refused consent — so
      // the message it raises is shown rather than replaced.
      toast.error(convexErrorMessage(error, "La connexion à Uber Eats a échoué"))
      console.error(error)
      setIsWorking(false)
    }
  }

  const handleDisconnect = async () => {
    setIsWorking(true)
    try {
      await disconnect({})
      toast.success("Compte Uber Eats déconnecté")
    } catch (error: unknown) {
      toast.error(convexErrorMessage(error, "La déconnexion a échoué"))
      console.error(error)
    } finally {
      setIsWorking(false)
    }
  }

  // Still loading, or the deployment has no Uber Eats credentials at all — in
  // which case the card below already says so and this one would only repeat it.
  if (connection === undefined || !hasUberEatsGlobal) return null

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Connexion Uber Eats
          <Badge variant={TONE_VARIANTS[described.tone]}>{described.label}</Badge>
        </CardTitle>
        <CardDescription className="mt-1">
          Le compte marchand vaut pour l&apos;ensemble de vos établissements. Les
          identifiants de boutique se règlent plus bas, établissement par
          établissement.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {described.detail && (
          <p className="text-sm text-muted-foreground">{described.detail}</p>
        )}

        {connection?.connectedAt !== undefined && (
          <p className="text-xs text-muted-foreground">
            Connecté le {formatDate(connection.connectedAt)}
            {connection.merchantUserId ? ` · compte ${connection.merchantUserId}` : ""}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={isWorking} onClick={() => void handleConnect()}>
            {isWorking ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plug className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isConnected ? "Reconnecter" : "Connecter le compte"}
          </Button>

          {connection && (
            <Button
              size="sm"
              variant="outline"
              disabled={isWorking}
              onClick={() => void handleDisconnect()}
            >
              <Unplug className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Déconnecter
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
