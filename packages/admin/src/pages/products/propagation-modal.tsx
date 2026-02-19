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
  Switch,
} from "@beindigital-engine/ui"
import { Loader2 } from "lucide-react"

// Propagation scope determines which stores will receive the product update
type PropagationScope = "self" | "selected" | "all"

interface Store {
  _id: string
  name: string
}

interface PropagationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Full list of stores for the restaurant owner */
  stores: Store[]
  /** ID of the store currently being edited — excluded from the target list */
  currentStoreId: string
  /** Called with the chosen scope and optional target store IDs when the user confirms */
  onConfirm: (scope: PropagationScope, targetStoreIds?: string[]) => Promise<void>
  isLoading?: boolean
}

export function PropagationModal({
  open,
  onOpenChange,
  stores,
  currentStoreId,
  onConfirm,
  isLoading = false,
}: PropagationModalProps) {
  const [scope, setScope] = useState<PropagationScope>("self")
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(new Set())

  // Exclude the store currently being edited from the propagation target list
  const otherStores = stores.filter((s) => s._id !== currentStoreId)

  // Toggle a store in/out of the selected set
  const toggleStore = (storeId: string) => {
    setSelectedStoreIds((prev) => {
      const next = new Set(prev)
      if (next.has(storeId)) {
        next.delete(storeId)
      } else {
        next.add(storeId)
      }
      return next
    })
  }

  const handleConfirm = async () => {
    await onConfirm(
      scope,
      scope === "selected" ? Array.from(selectedStoreIds) : undefined
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-md">
        <DialogHeader>
          <DialogTitle>Propager les modifications</DialogTitle>
          <DialogDescription>
            Choisissez où appliquer les modifications de ce produit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Option: self — always visible */}
          <button
            type="button"
            onClick={() => setScope("self")}
            className={`w-full flex items-center gap-3 border rounded-lg px-4 py-3 text-left transition-colors ${
              scope === "self"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border/50 hover:border-border"
            }`}
          >
            <div
              className={`h-3 w-3 rounded-full border-2 shrink-0 ${
                scope === "self"
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/40"
              }`}
            />
            <div>
              <div className="text-sm font-medium">Ce magasin uniquement</div>
              <div className="text-xs text-muted-foreground">
                La modification ne s&apos;applique qu&apos;ici
              </div>
            </div>
          </button>

          {/* Option: selected — only visible when there are other stores */}
          {otherStores.length > 0 && (
            <button
              type="button"
              onClick={() => setScope("selected")}
              className={`w-full flex items-center gap-3 border rounded-lg px-4 py-3 text-left transition-colors ${
                scope === "selected"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <div
                className={`h-3 w-3 rounded-full border-2 shrink-0 ${
                  scope === "selected"
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                }`}
              />
              <div>
                <div className="text-sm font-medium">Magasins sélectionnés</div>
                <div className="text-xs text-muted-foreground">
                  Choisir les magasins cibles
                </div>
              </div>
            </button>
          )}

          {/* Store checkboxes — only rendered when "selected" scope is active */}
          {scope === "selected" && otherStores.length > 0 && (
            <div className="ml-6 space-y-2 border-l-2 border-border/50 pl-4">
              {otherStores.map((store) => (
                <div key={store._id} className="flex items-center justify-between">
                  <Label
                    htmlFor={`store-${store._id}`}
                    className="text-sm cursor-pointer"
                  >
                    {store.name}
                  </Label>
                  <Switch
                    id={`store-${store._id}`}
                    checked={selectedStoreIds.has(store._id)}
                    onCheckedChange={() => toggleStore(store._id)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Option: all — only visible when there are other stores */}
          {otherStores.length > 0 && (
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`w-full flex items-center gap-3 border rounded-lg px-4 py-3 text-left transition-colors ${
                scope === "all"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <div
                className={`h-3 w-3 rounded-full border-2 shrink-0 ${
                  scope === "all"
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                }`}
              />
              <div>
                <div className="text-sm font-medium">Tous les magasins</div>
                <div className="text-xs text-muted-foreground">
                  Appliquer à tous les {otherStores.length + 1} magasins
                </div>
              </div>
            </button>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              isLoading ||
              (scope === "selected" && selectedStoreIds.size === 0)
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Propagation...
              </>
            ) : scope === "self" ? (
              "Enregistrer"
            ) : (
              "Enregistrer et propager"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
