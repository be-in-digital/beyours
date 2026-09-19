"use client"

/**
 * The credential the dining-room screen reads with (#96).
 *
 * WHAT THIS FIXES. `/display/[storeId]` is a tablet bolted to a wall where
 * customers can see it, and its only query was wrapped with `kitchen:read` — so
 * the screen a customer is meant to read could only be opened by somebody logged
 * in as staff. The audit called it "the unusable unauthenticated display screen"
 * and asked for a safe access mechanism, not an open endpoint.
 *
 * WHY THE VALUE IS SHOWN ONCE. `displayTokenState` answers only whether one
 * exists. A token returned by `stores.get` would sit in the browser memory of
 * every admin page every member of staff opens, for a credential whose whole job
 * is to be pasted into one tablet once. So the full URL appears at the moment it
 * is rotated, and afterwards the screen says only that a token is set.
 */

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { Copy, MonitorPlay, RefreshCw } from "lucide-react"
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@be-yours/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { convexErrorMessage } from "../../lib/convex-error"

/** The wall tablet's address, assembled from a token the owner just received. */
export function displayScreenUrl(
  origin: string,
  storeId: string,
  token: string
): string {
  // `encodeURIComponent` on the token: it is a UUID today and the assembly must
  // not depend on that staying true.
  return `${origin}/display/${storeId}?token=${encodeURIComponent(token)}`
}

export function StoreDisplayToken({ storeId }: { storeId: string | undefined }) {
  const { api } = useAdminApiStore()
  const [issued, setIssued] = useState<string | null>(null)
  const [isRotating, setIsRotating] = useState(false)

  const state = useQuery(
    api?.kitchenTickets?.displayTokenState,
    storeId ? { storeId } : "skip"
  ) as { configured: boolean } | undefined

  const rotate = useMutation(api?.kitchenTickets?.rotateDisplayToken)

  const handleRotate = async () => {
    if (!storeId) return
    setIsRotating(true)
    try {
      const result = (await rotate({ storeId })) as { token: string }
      setIssued(result.token)
      toast.success("Nouveau jeton d'affichage généré")
    } catch (error: unknown) {
      toast.error(convexErrorMessage(error, "Échec de la génération"))
      console.error(error)
    } finally {
      setIsRotating(false)
    }
  }

  const url =
    issued && storeId
      ? displayScreenUrl(
          // `window` is read at click time, inside the browser, so the URL is
          // the one this admin is actually served from — a hard-coded origin
          // would be wrong on every deployment but one.
          typeof window === "undefined" ? "" : window.location.origin,
          storeId,
          issued
        )
      : null

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">
          <MonitorPlay className="mr-2 inline h-4 w-4 align-[-3px] text-muted-foreground" />
          Adresse de l&apos;écran de salle
        </CardTitle>
        <CardDescription className="mt-1">
          L&apos;écran s&apos;ouvre avec un jeton propre à l&apos;établissement, sans
          compte ni connexion. Renouvelez-le si une tablette quitte les lieux.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {url ? (
          <div className="space-y-2">
            <Label htmlFor="display-screen-url" className="text-sm font-medium">
              À ouvrir sur la tablette
            </Label>
            <div className="flex gap-2">
              <Input
                id="display-screen-url"
                readOnly
                value={url}
                // Selected on focus: the value is long and the point of this
                // field is to be copied whole.
                onFocus={(event) => event.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copier l'adresse"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(url)
                    .then(() => toast.success("Adresse copiée"))
                    .catch(() => toast.error("Copie refusée par le navigateur"))
                }}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <Alert title="Notez-la maintenant">
              <p>
                Cette adresse n&apos;est affichée qu&apos;une fois. Elle reste
                valable jusqu&apos;au prochain renouvellement ; pour la retrouver
                il faudra en générer une nouvelle, ce qui coupe l&apos;écran déjà
                en place.
              </p>
            </Alert>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {state?.configured
              ? "Un jeton est en place. L'adresse complète n'est pas conservée ici — générez-en une nouvelle si vous l'avez perdue."
              : "Aucun jeton pour le moment : l'écran de salle affiche « Écran non configuré »."}
          </p>
        )}

        <Button
          type="button"
          variant={state?.configured ? "outline" : "default"}
          size="sm"
          onClick={handleRotate}
          disabled={!storeId || isRotating}
          data-testid="display-token-rotate"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {isRotating
            ? "Génération…"
            : state?.configured
              ? "Renouveler le jeton"
              : "Générer le jeton"}
        </Button>
      </CardContent>
    </Card>
  )
}
