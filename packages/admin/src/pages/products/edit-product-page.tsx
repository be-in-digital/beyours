"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useAdminStoreId, useAdminApi } from "../../hooks/admin-hooks"
import { eurosToCents, centsToEuros } from "../../lib/formatters"
import { ProductForm } from "./product-form"
import { Button } from "@beindigital-engine/ui"

interface EditProductPageProps {
  params: Promise<{ productId: string }>
}

export function EditProductPage({ params }: EditProductPageProps) {
  const { productId } = use(params)
  const router = useRouter()
  const storeId = useAdminStoreId()
  const api = useAdminApi() as any
  const [isLoading, setIsLoading] = useState(false)

  const updateProduct = useMutation(api?.products?.update)

  // Fetch the product
  const product = useQuery(
    api?.products?.getById,
    productId ? { id: productId } : "skip"
  )

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

      await updateProduct({
        id: productId,
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
      })

      toast.success("Produit mis à jour avec succès")
      router.push("/products")
    } catch (error) {
      toast.error("Échec de la mise à jour du produit")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-sm text-muted-foreground">
          Please select a store to edit a product
        </p>
      </div>
    )
  }

  if (!product || !categories) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  // Prepare default values with euro conversion
  const defaultValues = {
    ...product,
    priceEuros: centsToEuros(product.price),
    compareAtPriceEuros: product.compareAtPrice
      ? centsToEuros(product.compareAtPrice)
      : undefined,
    // Convert option choice price modifiers from cents to euros
    options: product.options?.map((option: any) => ({
      ...option,
      choices: option.choices.map((choice: any) => ({
        ...choice,
        priceModifier: centsToEuros(choice.priceModifier),
      })),
    })),
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modifier le produit</h1>
          <p className="text-sm text-muted-foreground mt-1">{product.name}</p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <ProductForm
          categories={categories}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          submitLabel="Mettre à jour le produit"
        />
      </div>
    </div>
  )
}
