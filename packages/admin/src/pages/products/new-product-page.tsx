"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useAdminStoreId, useAdminApi } from "../../hooks/admin-hooks"
import { eurosToCents } from "../../lib/formatters"
import { ProductForm } from "./product-form"
import { Button } from "@beindigital-engine/ui"

export function NewProductPage() {
  const router = useRouter()
  const storeId = useAdminStoreId()
  const api = useAdminApi() as any
  const [isLoading, setIsLoading] = useState(false)

  const createProduct = useMutation(api?.products?.create)

  // Fetch categories for the form
  const categories = useQuery(
    api?.categories?.list,
    storeId ? { storeId } : "skip"
  )

  const handleSubmit = async (data: any) => {
    if (!storeId) {
      toast.error("Veuillez sélectionner un établissement")
      return
    }

    setIsLoading(true)

    try {
      // Convert euro prices to cents
      const priceInCents = eurosToCents(data.priceEuros)
      const compareAtPriceInCents = data.compareAtPriceEuros
        ? eurosToCents(data.compareAtPriceEuros)
        : undefined

      // Convert option choice price modifiers to cents
      const optionsWithCents = data.options?.map((option: any) => ({
        ...option,
        choices: option.choices.map((choice: any) => ({
          ...choice,
          priceModifier: eurosToCents(choice.priceModifier || 0),
        })),
      }))

      await createProduct({
        storeId,
        categoryId: data.categoryId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        price: priceInCents,
        compareAtPrice: compareAtPriceInCents,
        taxRate: data.taxRate,
        preparationTime: data.preparationTime,
        sku: data.sku,
        images: data.images || [],
        options: optionsWithCents || [],
        allergens: data.allergens || [],
        tags: data.tags || [],
        stock: data.stock,
        scheduling: data.scheduling,
        spiceLevel: data.spiceLevel,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        sortOrder: data.sortOrder,
        source: "manual",
      })

      toast.success("Produit créé avec succès")
      router.push("/dashboard/products")
    } catch (error) {
      toast.error("Échec de la création du produit")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-sm text-muted-foreground">
          Veuillez sélectionner un établissement pour créer un produit
        </p>
      </div>
    )
  }

  if (!categories) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Créer un produit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ajoutez un nouveau produit à votre menu
          </p>
        </div>

        <div className="text-center py-12 border border-border/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Vous devez créer au moins une catégorie avant d'ajouter des produits
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/categories/new">Créer une catégorie</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/dashboard/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Créer un produit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ajoutez un nouveau produit à votre menu
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <ProductForm
          categories={categories}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          submitLabel="Créer un produit"
        />
      </div>
    </div>
  )
}
