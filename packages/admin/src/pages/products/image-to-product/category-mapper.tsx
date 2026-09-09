"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  Badge,
} from "@be-in-digital/ui"
import { AiFieldBadge } from "./ai-field-badge"
import { Plus } from "lucide-react"
import type { AiFieldSource } from "@be-in-digital/convex-schema/types"

/** Prefix for "create new" category IDs to distinguish from real Convex IDs */
export const NEW_CATEGORY_PREFIX = "__new__"

interface Category {
  _id: string
  name: string
}

interface CategoryMapperProps {
  categories: Category[]
  value: string | null
  suggestedName: string
  suggestedSource: AiFieldSource
  onChange: (categoryId: string) => void
}

export function CategoryMapper({
  categories,
  value,
  suggestedName,
  suggestedSource,
  onChange,
}: CategoryMapperProps) {
  const isNewCategory = value?.startsWith(NEW_CATEGORY_PREFIX) ?? false
  const newCategoryName = isNewCategory ? value!.slice(NEW_CATEGORY_PREFIX.length) : null

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
        <AiFieldBadge source={suggestedSource} />
        {isNewCategory && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-warning text-warning">
            <Plus className="h-2.5 w-2.5 mr-0.5" />
            Nouvelle
          </Badge>
        )}
      </div>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger className={`h-8 text-xs ${isNewCategory ? "border-amber-500/50" : ""}`}>
          <SelectValue placeholder={suggestedName || "Choisir une catégorie"} />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat._id} value={cat._id} className="text-xs">
              {cat.name}
            </SelectItem>
          ))}
          {suggestedName && (
            <>
              <SelectSeparator />
              <SelectItem
                value={`${NEW_CATEGORY_PREFIX}${suggestedName}`}
                className="text-xs"
              >
                <span className="flex items-center gap-1.5">
                  <Plus className="h-3 w-3 text-warning" />
                  Creer "{suggestedName}"
                </span>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>
      {suggestedName && !value && (
        <p className="text-[10px] text-muted-foreground">
          Suggestion IA : {suggestedName}
        </p>
      )}
      {isNewCategory && (
        <p className="text-[10px] text-warning">
          La categorie "{newCategoryName}" sera creee automatiquement
        </p>
      )}
    </div>
  )
}
