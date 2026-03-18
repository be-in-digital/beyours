"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { toast } from "sonner"
import {
  ArrowLeft,
  Globe,
  Eye,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { Button, Badge } from "@beindigital-engine/ui"
import { LoadingState } from "@/components/admin/LoadingState"
import { CmsBlockAccordion } from "./CmsBlockAccordion"
import { CmsTranslationDrawer } from "./CmsTranslationDrawer"
import { TrendingProductsPicker } from "./TrendingProductsPicker"
import {
  getPageDefinition,
  getBlockDefinition,
  getFieldDefinition,
} from "@beindigital-engine/cms"
import type { CmsFieldValue, CmsBlockValues } from "@beindigital-engine/cms"
import type { Id } from "@/convex/_generated/dataModel"
import Link from "next/link"

interface CmsPageEditorProps {
  pageSlug: string
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

const DEBOUNCE_MS = 1500

export function CmsPageEditor({ pageSlug }: CmsPageEditorProps) {
  const storeId = useAdminStoreId()
  const pageDef = getPageDefinition(pageSlug)

  // Convex queries/mutations
  const adminBlocks = useQuery(
    api.cms.getAdminPageBlocks,
    storeId ? { storeId, pageSlug } : "skip",
  )
  const saveDraft = useMutation(api.cms.saveDraftBlock)
  const resetField = useMutation(api.cms.resetField)
  const resetBlock = useMutation(api.cms.resetBlock)
  const resetPage = useMutation(api.cms.resetPage)
  const publishPage = useMutation(api.cms.publishPage)

  // Local state for autosave
  const [localValues, setLocalValues] = useState<
    Record<string, CmsBlockValues>
  >({})
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [publishing, setPublishing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Translation drawer state
  const [translationDrawer, setTranslationDrawer] = useState<{
    open: boolean
    blockKey: string
    fieldKey: string
  }>({ open: false, blockKey: "", fieldKey: "" })

  // Initialize local values from server data (draft > published fallback)
  useEffect(() => {
    if (!adminBlocks) return
    setLocalValues((prev) => {
      if (Object.keys(prev).length > 0) return prev
      const initial: Record<string, CmsBlockValues> = {}
      for (const block of adminBlocks.blocks) {
        const values =
          block.draftBlock?.values ?? block.publishedBlock?.values
        if (values) {
          initial[block.blockKey] = values
        }
      }
      return initial
    })
  }, [adminBlocks])

  // Autosave handler
  const scheduleAutosave = useCallback(
    (blockKey: string, values: CmsBlockValues) => {
      if (!storeId) return

      if (debounceRef.current) clearTimeout(debounceRef.current)

      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving")
        try {
          await saveDraft({
            storeId,
            pageSlug,
            blockKey,
            values,
            updatedBy: "admin",
          })
          setSaveStatus("saved")
          setTimeout(() => setSaveStatus("idle"), 2000)
        } catch (err) {
          setSaveStatus("error")
          toast.error(
            err instanceof Error ? err.message : "Erreur de sauvegarde",
          )
        }
      }, DEBOUNCE_MS)
    },
    [storeId, pageSlug, saveDraft],
  )

  const handleFieldChange = useCallback(
    (blockKey: string, fieldKey: string, value: CmsFieldValue) => {
      setLocalValues((prev) => {
        const blockValues = { ...prev[blockKey], [fieldKey]: value }
        scheduleAutosave(blockKey, blockValues)
        return { ...prev, [blockKey]: blockValues }
      })
    },
    [scheduleAutosave],
  )

  const handleFieldReset = useCallback(
    async (blockKey: string, fieldKey: string) => {
      if (!storeId) return
      try {
        await resetField({
          storeId,
          pageSlug,
          blockKey,
          fieldKey,
          updatedBy: "admin",
        })
        // Update local state
        setLocalValues((prev) => {
          const blockValues = { ...prev[blockKey] }
          const fieldDef = getFieldDefinition(pageSlug, blockKey, fieldKey)
          blockValues[fieldKey] = {
            type: (fieldDef?.type ?? "text") as CmsFieldValue["type"],
            isCleared: true,
          }
          return { ...prev, [blockKey]: blockValues }
        })
        toast.success("Champ réinitialisé")
      } catch (err) {
        toast.error("Erreur lors de la réinitialisation")
      }
    },
    [storeId, pageSlug, resetField],
  )

  const handleBlockReset = useCallback(
    async (blockKey: string) => {
      if (!storeId) return
      try {
        await resetBlock({ storeId, pageSlug, blockKey, updatedBy: "admin" })
        setLocalValues((prev) => {
          const next = { ...prev }
          delete next[blockKey]
          return next
        })
        toast.success("Bloc réinitialisé")
      } catch (err) {
        toast.error("Erreur lors de la réinitialisation du bloc")
      }
    },
    [storeId, pageSlug, resetBlock],
  )

  const handlePublish = useCallback(async () => {
    if (!storeId) return

    // Flush pending autosave
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    setPublishing(true)
    try {
      await publishPage({ storeId, pageSlug, updatedBy: "admin" })
      toast.success("Page publiée avec succès")
      // Clear local state to reload from server
      setLocalValues({})
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la publication",
      )
    } finally {
      setPublishing(false)
    }
  }, [storeId, pageSlug, publishPage])

  const handleOpenTranslations = useCallback(
    (blockKey: string, fieldKey: string) => {
      setTranslationDrawer({ open: true, blockKey, fieldKey })
    },
    [],
  )

  if (!pageDef) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Page &quot;{pageSlug}&quot; non trouvée dans le registre CMS.
      </div>
    )
  }

  if (!storeId) return null

  if (adminBlocks === undefined) {
    return <LoadingState variant="form" />
  }

  const pageMeta = adminBlocks.pageMeta

  // Check if any block has a pending auto-translation
  const isTranslating = adminBlocks.blocks.some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b: any) => b.draftBlock?.isTranslating,
  )

  // Translation drawer data
  const drawerBlockData = adminBlocks.blocks.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b: any) => b.blockKey === translationDrawer.blockKey,
  )
  const drawerFieldDef = translationDrawer.blockKey
    ? getFieldDefinition(
        pageSlug,
        translationDrawer.blockKey,
        translationDrawer.fieldKey,
      )
    : null
  const drawerSourceValue =
    drawerBlockData?.draftBlock?.values[translationDrawer.fieldKey]
      ?.textValue ??
    drawerBlockData?.publishedBlock?.values[translationDrawer.fieldKey]
      ?.textValue ??
    ""
  const drawerTranslations =
    drawerBlockData?.draftBlock?.translationsByField[
      translationDrawer.fieldKey
    ] ??
    drawerBlockData?.publishedBlock?.translationsByField[
      translationDrawer.fieldKey
    ] ??
    {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/content/pages">
            <Button variant="ghost" size="sm" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold truncate">{pageDef.label}</h1>
            {pageDef.description && (
              <p className="text-sm text-muted-foreground truncate">
                {pageDef.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Save status */}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Sauvegarde...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Sauvegardé
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              Erreur
            </span>
          )}

          {/* Status badges */}
          {pageMeta?.hasPublished && (
            <Badge variant="default" className="text-xs">
              <Globe className="mr-1 h-3 w-3" />
              Publié
            </Badge>
          )}
          {pageMeta?.hasUnpublishedChanges && (
            <Badge variant="secondary" className="text-xs">
              Brouillon
            </Badge>
          )}

          {/* Preview */}
          <a
            href={`/preview/${pageSlug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-3.5 w-3.5" />
              Aperçu
            </Button>
          </a>

          {/* Publish */}
          <Button
            onClick={handlePublish}
            disabled={publishing || saveStatus === "saving" || isTranslating}
            title={isTranslating ? "Traduction en cours..." : undefined}
          >
            {publishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isTranslating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isTranslating ? "Traduction..." : "Publier"}
          </Button>
        </div>
      </div>

      {/* Block Accordions */}
      <div className="space-y-4">
        {pageDef.blocks.map((blockDef) => {
          const serverBlock = adminBlocks.blocks.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (b: any) => b.blockKey === blockDef.key,
          )
          const draftValues =
            localValues[blockDef.key] ??
            serverBlock?.draftBlock?.values ??
            serverBlock?.publishedBlock?.values ??
            {}
          const publishedValues =
            serverBlock?.publishedBlock?.values ?? undefined
          const resolvedMedia =
            serverBlock?.draftBlock?.resolvedMedia ??
            serverBlock?.publishedBlock?.resolvedMedia ??
            {}
          const translationsByField =
            serverBlock?.draftBlock?.translationsByField ??
            serverBlock?.publishedBlock?.translationsByField ??
            {}

          return (
            <div key={blockDef.key} className="space-y-4">
              <CmsBlockAccordion
                blockDef={blockDef}
                draftValues={draftValues}
                publishedValues={publishedValues}
                resolvedMedia={resolvedMedia}
                translationsByField={translationsByField}
                onFieldChange={handleFieldChange}
                onFieldReset={handleFieldReset}
                onBlockReset={handleBlockReset}
                onOpenTranslations={handleOpenTranslations}
              />
              {/* Trending products picker — injected for homepage trendingMeals block */}
              {pageSlug === "homepage" && blockDef.key === "trendingMeals" && (
                <TrendingProductsPicker />
              )}
            </div>
          )
        })}
      </div>

      {/* Translation Drawer */}
      {drawerFieldDef && (
        <CmsTranslationDrawer
          open={translationDrawer.open}
          onOpenChange={(open) =>
            setTranslationDrawer((prev) => ({ ...prev, open }))
          }
          fieldKey={translationDrawer.fieldKey}
          fieldDef={drawerFieldDef}
          sourceValue={drawerSourceValue}
          translations={drawerTranslations}
        />
      )}
    </div>
  )
}
