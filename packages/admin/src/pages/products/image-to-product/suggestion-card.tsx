"use client"

import { useState } from "react"
import type { ProductSuggestion } from "@beindigital-engine/convex-schema/types"
import {
  Card,
  CardContent,
  CardHeader,
  Input,
  Textarea,
  Checkbox,
  Badge,
} from "@beindigital-engine/ui"
import { ImageIcon } from "lucide-react"
import { AiFieldBadge } from "./ai-field-badge"
import { ConfidenceIndicator } from "./confidence-indicator"
import { WarningBanner } from "./warning-banner"
import { CategoryMapper } from "./category-mapper"

interface Category {
  _id: string
  name: string
}

interface SuggestionCardProps {
  suggestion: ProductSuggestion
  categories: Category[]
  selected: boolean
  onToggleSelect: () => void
  onUpdate: (updated: ProductSuggestion) => void
}

export function SuggestionCard({
  suggestion,
  categories,
  selected,
  onToggleSelect,
  onUpdate,
}: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false)

  const updateField = <K extends keyof ProductSuggestion>(
    key: K,
    value: ProductSuggestion[K]
  ) => {
    onUpdate({ ...suggestion, [key]: value })
  }

  const priceDisplay = suggestion.price.value !== null
    ? `${(suggestion.price.value / 100).toFixed(2)} EUR`
    : "Non detecte"

  return (
    <Card className={`transition-colors ${selected ? "border-primary/50" : "border-border/50 opacity-75"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Selection checkbox */}
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="mt-1"
          />

          {/* Image thumbnail */}
          <div className="relative h-16 w-16 shrink-0 rounded-md overflow-hidden bg-muted">
            {suggestion.imageUrl ? (
              <img
                src={suggestion.imageUrl}
                alt={suggestion.name.value}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            {suggestion.imageSource === "generated" && (
              <Badge variant="secondary" className="absolute bottom-0.5 right-0.5 text-[8px] px-1 py-0">
                IA
              </Badge>
            )}
            {suggestion.imageEnhanced && suggestion.imageSource !== "generated" && (
              <Badge variant="secondary" className="absolute bottom-0.5 right-0.5 text-[8px] px-1 py-0">
                HD
              </Badge>
            )}
          </div>

          {/* Name + price header */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Input
                value={suggestion.name.value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField("name", { ...suggestion.name, value: e.target.value })
                }
                className="h-7 text-sm font-medium"
                disabled={!selected}
              />
              <AiFieldBadge source={suggestion.name.source} />
              <ConfidenceIndicator value={suggestion.name.confidence} />
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">Prix:</span>
              <Input
                type="number"
                step="0.01"
                value={suggestion.price.value !== null ? suggestion.price.value / 100 : ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const euros = parseFloat(e.target.value)
                  updateField("price", {
                    ...suggestion.price,
                    value: isNaN(euros) ? null : Math.round(euros * 100),
                  })
                }}
                placeholder="Prix en EUR"
                className="h-7 w-24 text-xs"
                disabled={!selected}
              />
              {suggestion.price.value !== null && (
                <>
                  <AiFieldBadge source={suggestion.price.source} />
                  <ConfidenceIndicator value={suggestion.price.confidence} />
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Warnings */}
        <WarningBanner warnings={suggestion.warnings} />

        {/* Description */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <AiFieldBadge source={suggestion.description.source} />
            <ConfidenceIndicator value={suggestion.description.confidence} />
          </div>
          <Textarea
            value={suggestion.description.value}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              updateField("description", { ...suggestion.description, value: e.target.value })
            }
            className="text-xs min-h-[60px]"
            disabled={!selected}
          />
        </div>

        {/* Category */}
        <CategoryMapper
          categories={categories}
          value={suggestion.matchedCategoryId}
          suggestedName={suggestion.suggestedCategoryName.value}
          suggestedSource={suggestion.suggestedCategoryName.source}
          onChange={(id) => updateField("matchedCategoryId", id)}
        />

        {/* Expandable: ingredients + allergens */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline"
        >
          {expanded ? "Masquer les details" : "Afficher ingredients & allergenes"}
        </button>

        {expanded && (
          <div className="space-y-3 pt-1">
            {/* Ingredients */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Ingredients</label>
                <AiFieldBadge source={suggestion.ingredients.source} />
                <ConfidenceIndicator value={suggestion.ingredients.confidence} />
              </div>
              <Input
                value={suggestion.ingredients.value.join(", ")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField("ingredients", {
                    ...suggestion.ingredients,
                    value: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="Separes par des virgules"
                className="h-7 text-xs"
                disabled={!selected}
              />
            </div>

            {/* Allergens */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Allergenes (suggestion IA)</label>
                <AiFieldBadge source="inferred" />
                <ConfidenceIndicator value={suggestion.allergens.confidence} />
              </div>
              <Input
                value={suggestion.allergens.value.join(", ")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateField("allergens", {
                    ...suggestion.allergens,
                    value: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="Separes par des virgules"
                className="h-7 text-xs"
                disabled={!selected}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
