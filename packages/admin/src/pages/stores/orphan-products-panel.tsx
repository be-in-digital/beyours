"use client"

/**
 * The imported items that matched nothing in the catalogue (#274).
 *
 * WHY THIS SCREEN DID NOT EXIST. `orphanProducts` exists precisely because an
 * import from Uber Eats or Deliveroo leaves items with no counterpart here — a
 * dish renamed on the platform, a new one added there, a modifier the catalogue
 * has no product for. `listPending`, `match` and `ignore` are what resolves them,
 * and of the five functions in that module only `match` was ever exposed, with no
 * screen calling it.
 *
 * So the rows accumulated on every import: no way to see them, no way to clear
 * them, and no way for an owner to learn why their platform menu and their
 * catalogue had drifted apart.
 *
 * THREE OUTCOMES, NOT TWO. Match it to a product, or set it aside. A platform
 * carries items an establishment does not sell here — a combo assembled on Uber
 * Eats, a discontinued dish the platform still lists — so forcing every row to be
 * matched would put a wrong product in the catalogue, and leaving it pending for
 * ever makes the screen unusable after the first import. `ignored` records that a
 * human looked and decided, so the next import does not present it as new again.
 */

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { Link2, PackageSearch } from "lucide-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@be-yours/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { convexErrorMessage } from "../../lib/convex-error"
import { formatPrice } from "../../lib/formatters"

/** One unmatched item, as `orphanProducts.listPending` returns it. */
interface OrphanProduct {
  _id: string
  platform: "uberEats" | "deliveroo"
  externalId: string
  name: string
  description?: string
  price: number
  imageUrl?: string
}

/** A catalogue product it could be matched to. */
interface CatalogueProduct {
  _id: string
  name: string
}

const PLATFORM_LABELS: Record<string, string> = {
  uberEats: "Uber Eats",
  deliveroo: "Deliveroo",
}

export function OrphanProductsPanel({ storeId }: { storeId: string | undefined }) {
  const { api } = useAdminApiStore()
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const orphans = useQuery(
    api?.orphanProducts?.listPending,
    storeId ? { storeId } : "skip"
  ) as OrphanProduct[] | undefined

  const products = useQuery(
    api?.products?.list,
    storeId ? { storeId } : "skip"
  ) as CatalogueProduct[] | undefined

  const match = useMutation(api?.orphanProducts?.match)
  const ignore = useMutation(api?.orphanProducts?.ignore)

  const handleMatch = async (orphan: OrphanProduct) => {
    const productId = choices[orphan._id]
    if (!productId) return
    setBusyId(orphan._id)
    try {
      await match({ id: orphan._id, matchedProductId: productId })
      toast.success(`« ${orphan.name} » rattaché`)
    } catch (error: unknown) {
      toast.error(convexErrorMessage(error, "Le rattachement a échoué"))
      console.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const handleIgnore = async (orphan: OrphanProduct) => {
    setBusyId(orphan._id)
    try {
      await ignore({ id: orphan._id })
      toast.success(`« ${orphan.name} » mis de côté`)
    } catch (error: unknown) {
      toast.error(convexErrorMessage(error, "La mise de côté a échoué"))
      console.error(error)
    } finally {
      setBusyId(null)
    }
  }

  if (!storeId) return null

  /*
   * THREE STATES, NOT TWO (#531). `undefined` and `[]` used to render the same
   * nothing, and on this screen they mean opposite things. An owner comes here
   * straight after an import to see what did not match; an empty tab while the
   * query is in flight reads as "everything matched", and the conclusion is
   * drawn before the panel arrives.
   *
   * So the unresolved state speaks and the clean one does not. Nothing to
   * resolve IS the ordinary state — a permanent empty card on every store's
   * integrations tab would be noise on every visit — while a row that says it
   * is still counting is on screen for as long as the query takes and no
   * longer.
   */
  if (orphans === undefined) {
    return (
      <Card data-testid="orphan-products-loading">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            <PackageSearch
              className="mr-2 inline h-4 w-4 align-[-3px] text-muted-foreground"
              aria-hidden="true"
            />
            Plats importés sans correspondance
          </CardTitle>
          <CardDescription className="mt-1">
            Recherche des plats importés qui n&apos;ont pas encore de
            correspondance dans votre carte…
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (orphans.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">
          <PackageSearch
            className="mr-2 inline h-4 w-4 align-[-3px] text-muted-foreground"
            aria-hidden="true"
          />
          Plats importés sans correspondance
          <Badge variant="secondary" className="ml-2">
            {orphans.length}
          </Badge>
        </CardTitle>
        <CardDescription className="mt-1">
          Ces plats existent sur la plateforme et pas dans votre carte. Rattachez
          chacun au plat correspondant, ou mettez-le de côté s&apos;il ne doit pas
          apparaître ici.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {orphans.map((orphan) => (
          <div
            key={orphan._id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{orphan.name}</p>
              <p className="text-xs text-muted-foreground">
                {PLATFORM_LABELS[orphan.platform] ?? orphan.platform} ·{" "}
                {formatPrice(orphan.price)}
              </p>
            </div>

            <Select
              value={choices[orphan._id] ?? ""}
              onValueChange={(value) =>
                setChoices((current) => ({ ...current, [orphan._id]: value }))
              }
            >
              <SelectTrigger
                className="w-56"
                aria-label={`Plat de la carte à rattacher à ${orphan.name}`}
              >
                <SelectValue placeholder="Choisir un plat…" />
              </SelectTrigger>
              <SelectContent>
                {(products ?? []).map((product) => (
                  <SelectItem key={product._id} value={product._id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              // Disabled until a dish is picked: matching to nothing is the one
              // outcome this screen must not produce.
              disabled={!choices[orphan._id] || busyId === orphan._id}
              onClick={() => void handleMatch(orphan)}
            >
              <Link2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Rattacher
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={busyId === orphan._id}
              onClick={() => void handleIgnore(orphan)}
            >
              Mettre de côté
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
