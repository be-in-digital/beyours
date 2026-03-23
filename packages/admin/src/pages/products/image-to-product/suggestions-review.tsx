"use client"

import { useState, useMemo } from "react"
import type { ProductSuggestion } from "@beindigital-engine/convex-schema/types"
import {
  Button,
  Checkbox,
} from "@beindigital-engine/ui"
import { Check, Info, RotateCcw } from "lucide-react"
import { SuggestionCard } from "./suggestion-card"
import { NEW_CATEGORY_PREFIX } from "./category-mapper"

interface Category {
  _id: string
  name: string
}

interface SuggestionsReviewProps {
  suggestions: ProductSuggestion[]
  categories: Category[]
  onConfirm: (selected: ProductSuggestion[]) => void
  onReset: () => void
  isCreating: boolean
}

export function SuggestionsReview({
  suggestions,
  categories,
  onConfirm,
  onReset,
  isCreating,
}: SuggestionsReviewProps) {
  const [items, setItems] = useState<ProductSuggestion[]>(suggestions)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(suggestions.map((s) => s.tempId))
  )

  const allSelected = selectedIds.size === items.length
  const noneSelected = selectedIds.size === 0

  // Collect new categories that will be created from selected products
  const newCategories = useMemo(() => {
    const names = new Set<string>()
    for (const item of items) {
      if (!selectedIds.has(item.tempId)) continue
      const catId = item.matchedCategoryId
      if (catId && catId.startsWith(NEW_CATEGORY_PREFIX)) {
        names.add(catId.slice(NEW_CATEGORY_PREFIX.length))
      }
    }
    return [...names]
  }, [items, selectedIds])

  const toggleSelect = (tempId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(tempId)) {
        next.delete(tempId)
      } else {
        next.add(tempId)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((s) => s.tempId)))
    }
  }

  const updateSuggestion = (updated: ProductSuggestion) => {
    setItems((prev) =>
      prev.map((s) => (s.tempId === updated.tempId ? updated : s))
    )
  }

  const handleConfirm = () => {
    const selected = items.filter((s) => selectedIds.has(s.tempId))
    onConfirm(selected)
  }

  // Count products without any category (neither existing nor new)
  const missingCategoryCount = items.filter(
    (s) => selectedIds.has(s.tempId) && !s.matchedCategoryId
  ).length

  return (
    <div className="space-y-4">
      {/* New categories notification */}
      {newCategories.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-500">
              {newCategories.length} categorie(s) sera/seront creee(s) :
            </p>
            <ul className="mt-1 space-y-0.5 text-amber-600 dark:text-amber-400">
              {newCategories.map((name) => (
                <li key={name}>• {name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size}/{items.length} selectionne(s)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={isCreating}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Nouvelle image
          </Button>

          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={noneSelected || isCreating || missingCategoryCount > 0}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            {isCreating
              ? "Creation..."
              : `Creer ${selectedIds.size} produit(s)`}
          </Button>
        </div>
      </div>

      {/* Warning: products without category */}
      {missingCategoryCount > 0 && (
        <p className="text-xs text-destructive">
          {missingCategoryCount} produit(s) sans categorie — choisissez une categorie existante ou creez-en une nouvelle.
        </p>
      )}

      {/* Suggestion cards */}
      <div className="space-y-3">
        {items.map((suggestion) => (
          <SuggestionCard
            key={suggestion.tempId}
            suggestion={suggestion}
            categories={categories}
            selected={selectedIds.has(suggestion.tempId)}
            onToggleSelect={() => toggleSelect(suggestion.tempId)}
            onUpdate={updateSuggestion}
          />
        ))}
      </div>

      {/* Bottom action */}
      {items.length > 2 && (
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={noneSelected || isCreating || missingCategoryCount > 0}
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            {isCreating
              ? "Creation..."
              : `Creer ${selectedIds.size} produit(s)`}
          </Button>
        </div>
      )}
    </div>
  )
}
