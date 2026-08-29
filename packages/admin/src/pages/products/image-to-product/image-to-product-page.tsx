"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAction, useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type {
  ImageToProductMode,
  ProductSuggestion,
  AnalyzeImageResult,
} from "@be-in-digital/convex-schema/types"
import { Button } from "@be-in-digital/ui"
import { adminRoutes } from "../../../config/admin-routes"
import { useAdminStoreId, useAdminApi } from "../../../hooks/admin-hooks"
import { slugify } from "../../../lib/formatters"
import { ImageUploadStep } from "./image-upload-step"
import { AnalysisLoading } from "./analysis-loading"
import { SuggestionsReview } from "./suggestions-review"
import { NEW_CATEGORY_PREFIX } from "./category-mapper"
import { ResolvingStore } from "../../../components/resolving-store"

type Step = "upload" | "analyzing" | "review"

export function ImageToProductPage() {
  const router = useRouter()
  const storeId = useAdminStoreId()
  const api = useAdminApi() as any

  const [step, setStep] = useState<Step>("upload")
  const [result, setResult] = useState<AnalyzeImageResult | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const cancelledRef = useRef(false)

  const analyzeImage = useAction(api?.imageToProduct?.analyze)
  const createProduct = useMutation(api?.products?.create)
  const createCategory = useMutation(api?.categories?.create)
  const getUploadUrl = useAction(api?.storageUpload?.getPresignedUploadUrl)

  const categories = useQuery(
    api?.categories?.list,
    storeId ? { storeId } : "skip"
  )

  const handleRequestUploadUrl = async (args: {
    folder: string
    contentType: string
  }) => {
    return getUploadUrl({
      folder: args.folder,
      contentType: args.contentType,
    })
  }

  const handleAnalyze = async (imageUrl: string, mode: ImageToProductMode) => {
    if (!storeId) {
      toast.error("Veuillez sélectionner un établissement")
      return
    }

    cancelledRef.current = false
    setStep("analyzing")

    try {
      const analyzeResult = await analyzeImage({
        imageUrl,
        mode,
        storeId,
      })

      // If the user cancelled while the action was running, discard results
      if (cancelledRef.current) return

      setResult(analyzeResult)
      setStep("review")

      const count = analyzeResult.suggestions.length
      const imgCount = analyzeResult.processingCost.imagesGenerated ?? 0
      toast.success(
        `${count} produit(s) detecte(s)` +
          (imgCount > 0 ? ` — ${imgCount} image(s) générée(s)` : "") +
          (analyzeResult.processingCost.imageUpscaled && imgCount === 0
            ? " — image amelioree"
            : "")
      )
    } catch (error) {
      if (cancelledRef.current) return
      const message =
        error instanceof Error ? error.message : "Erreur lors de l'analyse"
      toast.error(message)
      setStep("upload")
    }
  }

  const handleCancel = () => {
    cancelledRef.current = true
    setStep("upload")
    setResult(null)
    toast.info("Analyse annulée")
  }

  const handleConfirm = async (selected: ProductSuggestion[]) => {
    if (!storeId || selected.length === 0) return

    setIsCreating(true)
    let created = 0

    try {
      // 1. Collect unique new category names from selected products
      const newCategoryNames = new Set<string>()
      for (const s of selected) {
        if (s.matchedCategoryId?.startsWith(NEW_CATEGORY_PREFIX)) {
          newCategoryNames.add(s.matchedCategoryId.slice(NEW_CATEGORY_PREFIX.length))
        }
      }

      // 2. Create new categories and build a mapping: name → real ID
      const categoryMap = new Map<string, string>()
      for (const name of newCategoryNames) {
        const newId = await createCategory({
          storeId,
          name,
          slug: slugify(name),
          sortOrder: 0,
          isActive: true,
        })
        categoryMap.set(name, newId)
      }

      if (newCategoryNames.size > 0) {
        toast.info(`${newCategoryNames.size} catégorie(s) créée(s)`)
      }

      // 3. Create products, resolving new category IDs
      for (const suggestion of selected) {
        let categoryId = suggestion.matchedCategoryId
        if (!categoryId) {
          toast.error(
            `"${suggestion.name.value}" : veuillez choisir une catégorie`
          )
          continue
        }

        // Resolve __new__Name → real Convex ID
        if (categoryId.startsWith(NEW_CATEGORY_PREFIX)) {
          const catName = categoryId.slice(NEW_CATEGORY_PREFIX.length)
          const realId = categoryMap.get(catName)
          if (!realId) {
            toast.error(`Échec de création de la catégorie "${catName}"`)
            continue
          }
          categoryId = realId
        }

        await createProduct({
          storeId,
          categoryId,
          name: suggestion.name.value,
          slug: slugify(suggestion.name.value),
          description: suggestion.description.value || undefined,
          price: suggestion.price.value ?? 0,
          taxRate: 0,
          images: suggestion.imageUrl ? [suggestion.imageUrl] : [],
          allergens: suggestion.allergens.value,
          isActive: true,
          isFeatured: false,
          sortOrder: 0,
          source: "ai-image",
        })
        created++
      }

      if (created > 0) {
        toast.success(`${created} produit(s) créé(s) avec succès`)
        router.push(adminRoutes.products)
      }
    } catch (error) {
      toast.error("Erreur lors de la création des produits")
      console.error(error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleReset = () => {
    setStep("upload")
    setResult(null)
  }

  if (!storeId) return <ResolvingStore />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={adminRoutes.products}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Créer depuis une image
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            L'IA analyse votre image pour pre-remplir les informations produit
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-3xl">
        {step === "upload" && (
          <ImageUploadStep
            onAnalyze={handleAnalyze}
            onRequestUploadUrl={handleRequestUploadUrl}
            isLoading={false}
          />
        )}

        {step === "analyzing" && <AnalysisLoading onCancel={handleCancel} />}

        {step === "review" && result && (
          <SuggestionsReview
            suggestions={result.suggestions}
            categories={categories ?? []}
            onConfirm={handleConfirm}
            onReset={handleReset}
            isCreating={isCreating}
          />
        )}
      </div>
    </div>
  )
}
