"use client"

/**
 * Where the portions went (#99).
 *
 * `products.stock.quantity` was a number with no history: an owner saw "3
 * portions" and had no way to learn whether that was three sold and two
 * cancelled or five sold and four restocked by hand. When the number is wrong —
 * which it is the first time anybody miscounts — there was nothing to reconcile
 * against.
 *
 * Every path that moves stock now writes a row, inside the same transaction as
 * the movement, so a quantity cannot change without the ledger saying why. This
 * reads one dish's rows, newest first.
 */

import { useQuery } from "convex/react"
import { ArrowDown, ArrowUp, History, Minus } from "lucide-react"
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@be-in-digital/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { formatShortDate } from "../../lib/formatters"

/** One row of the ledger, as `stockLedger.list` returns it. */
export interface StockMovement {
  _id: string
  productName: string
  reason: "sale" | "restock" | "adjustment" | "tracking_on" | "tracking_off"
  before: number
  after: number
  delta: number
  orderNumber?: string
  createdAt: number
}

/** What the owner calls each reason. */
export const STOCK_REASON_LABELS: Record<StockMovement["reason"], string> = {
  sale: "Vente",
  restock: "Commande annulée",
  adjustment: "Correction manuelle",
  tracking_on: "Suivi activé",
  tracking_off: "Suivi désactivé",
}

interface StockHistoryDialogProps {
  storeId: string | null
  /** The dish whose history to show, or null to close. */
  product: { _id: string; name: string } | null
  onOpenChange: (open: boolean) => void
}

export function StockHistoryDialog({
  storeId,
  product,
  onOpenChange,
}: StockHistoryDialogProps) {
  const { api } = useAdminApiStore()

  const page = useQuery(
    api?.stockMovements?.list,
    storeId && product ? { storeId, productId: product._id } : "skip"
  ) as { movements: StockMovement[]; isDone: boolean } | undefined

  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" aria-hidden="true" />
            {product?.name}
          </DialogTitle>
          <DialogDescription>
            Chaque mouvement de stock, du plus récent au plus ancien.
          </DialogDescription>
        </DialogHeader>

        {page === undefined ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : page.movements.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {/* Honest about the reason: the ledger starts when it starts, and a
                dish that has not moved since is not the same as a dish with no
                history. */}
            Aucun mouvement enregistré. Les mouvements antérieurs à la mise en
            place de l&apos;historique n&apos;y figurent pas.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quand</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Commande</TableHead>
                <TableHead className="text-right">Mouvement</TableHead>
                <TableHead className="text-right">Reste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.movements.map((movement) => (
                <TableRow key={movement._id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatShortDate(movement.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={movement.delta < 0 ? "secondary" : "outline"}>
                      {STOCK_REASON_LABELS[movement.reason] ?? movement.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {movement.orderNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      {/* The arrow carries the direction as well as the sign: a
                          minus sign alone is easy to miss in a column of
                          numbers, and this is the column the reader is scanning. */}
                      {movement.delta < 0 ? (
                        <ArrowDown className="h-3 w-3" aria-hidden="true" />
                      ) : movement.delta > 0 ? (
                        <ArrowUp className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Minus className="h-3 w-3" aria-hidden="true" />
                      )}
                      {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {movement.after}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {page && !page.isDone && (
          <p className="text-xs text-muted-foreground">
            Seuls les mouvements les plus récents sont affichés.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
