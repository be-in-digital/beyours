"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@be-in-digital/ui"
import { Loader2, Copy } from "lucide-react"

interface Store {
  _id: string
  name: string
}

interface DuplicateCatalogModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Full list of stores owned by the restaurant */
  stores: Store[]
  /** ID of the store currently being managed — pre-selected as source */
  currentStoreId: string
  /** Called with source/target IDs; resolves with the duplication result */
  onConfirm: (
    sourceStoreId: string,
    targetStoreId: string
  ) => Promise<{ categoriesCreated: number; productsCreated: number }>
}

export function DuplicateCatalogModal({
  open,
  onOpenChange,
  stores,
  currentStoreId,
  onConfirm,
}: DuplicateCatalogModalProps) {
  const [sourceStoreId, setSourceStoreId] = useState(currentStoreId)
  const [targetStoreId, setTargetStoreId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    categoriesCreated: number
    productsCreated: number
  } | null>(null)

  // Only stores different from the chosen source can be the target
  const otherStores = stores.filter((s) => s._id !== sourceStoreId)

  const handleConfirm = async () => {
    if (!targetStoreId) return
    setIsLoading(true)
    setResult(null)
    try {
      const res = await onConfirm(sourceStoreId, targetStoreId)
      setResult(res)
    } finally {
      setIsLoading(false)
    }
  }

  // Reset local state when the modal is closed
  const handleClose = () => {
    setResult(null)
    setTargetStoreId("")
    onOpenChange(false)
  }

  // When the source changes, clear the target to avoid an invalid selection
  const handleSourceChange = (value: string) => {
    setSourceStoreId(value)
    setTargetStoreId("")
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="!max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Dupliquer le catalogue
          </DialogTitle>
          <DialogDescription>
            Copiez les catégories et produits d&apos;un magasin vers un autre.
            Les produits seront liés pour permettre la propagation future.
          </DialogDescription>
        </DialogHeader>

        {/* Success state — displayed after a successful duplication */}
        {result ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 space-y-2">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Duplication terminée
              </p>
              <ul className="text-sm text-green-600 dark:text-green-400 space-y-1">
                <li>{result.categoriesCreated} catégories créées</li>
                <li>{result.productsCreated} produits dupliqués</li>
              </ul>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          // Form state — store selectors and confirmation controls
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Magasin source</Label>
              <Select value={sourceStoreId} onValueChange={handleSourceChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner le magasin source" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store._id} value={store._id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Magasin cible</Label>
              <Select value={targetStoreId} onValueChange={setTargetStoreId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner le magasin cible" />
                </SelectTrigger>
                <SelectContent>
                  {otherStores.map((store) => (
                    <SelectItem key={store._id} value={store._id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amber warning box — matches the pattern used in settings-page.tsx */}
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Les produits existants dans le magasin cible ne seront pas
                supprimés. Les nouveaux produits seront ajoutés en complément.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isLoading || !targetStoreId}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Duplication...
                  </>
                ) : (
                  "Dupliquer"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
