"use client"

import { RotateCcw, ChevronDown } from "lucide-react"
import { Button } from "@beindigital-engine/ui"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { CmsFieldRenderer } from "./CmsFieldRenderer"
import type {
  BlockDefinition,
  CmsFieldValue,
  CmsBlockValues,
} from "@beindigital-engine/cms"

interface CmsBlockAccordionProps {
  blockDef: BlockDefinition
  draftValues: CmsBlockValues
  publishedValues?: CmsBlockValues
  resolvedMedia: Record<string, any>
  translationsByField: Record<string, Record<string, any>>
  onFieldChange: (blockKey: string, fieldKey: string, value: CmsFieldValue) => void
  onFieldReset: (blockKey: string, fieldKey: string) => void
  onBlockReset: (blockKey: string) => void
  onOpenTranslations: (blockKey: string, fieldKey: string) => void
  defaultOpen?: boolean
  disabled?: boolean
}

export function CmsBlockAccordion({
  blockDef,
  draftValues,
  publishedValues,
  resolvedMedia,
  translationsByField,
  onFieldChange,
  onFieldReset,
  onBlockReset,
  onOpenTranslations,
  defaultOpen = true,
  disabled,
}: CmsBlockAccordionProps) {
  const fieldEntries = Object.entries(blockDef.fields)

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className="rounded-lg border">
        {/* Header */}
        <CollapsibleTrigger asChild>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform [[data-state=closed]_&]:-rotate-90" />
              <h3 className="text-sm font-semibold truncate">{blockDef.label}</h3>
              <span className="text-xs text-muted-foreground shrink-0">
                {fieldEntries.length} champ{fieldEntries.length > 1 ? "s" : ""}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs shrink-0 self-end sm:self-auto"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onBlockReset(blockDef.key)
              }}
              disabled={disabled}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Réinitialiser le bloc
            </Button>
          </div>
        </CollapsibleTrigger>

        {/* Body */}
        <CollapsibleContent>
          <div className="px-3 sm:px-4 pb-4 space-y-5 border-t pt-4">
            {fieldEntries.map(([fieldKey, fieldDef]) => {
              const translationsForField = translationsByField[fieldKey]
              const translationCount = translationsForField
                ? Object.keys(translationsForField).length
                : 0

              return (
                <CmsFieldRenderer
                  key={fieldKey}
                  fieldKey={fieldKey}
                  fieldDef={fieldDef}
                  value={draftValues[fieldKey]}
                  publishedValue={publishedValues?.[fieldKey]}
                  resolvedMedia={resolvedMedia[fieldKey]}
                  onChange={(fk, val) => onFieldChange(blockDef.key, fk, val)}
                  onReset={(fk) => onFieldReset(blockDef.key, fk)}
                  onOpenTranslations={(fk) =>
                    onOpenTranslations(blockDef.key, fk)
                  }
                  translationCount={translationCount}
                  disabled={disabled}
                />
              )
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
