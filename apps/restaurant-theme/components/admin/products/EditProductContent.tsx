"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { eurosToCents, centsToEuros } from "@/lib/admin/formatters"
import { ProductForm } from "./ProductForm"
import { Button } from "@/components/ui/button"

interface EditProductContentProps {
  params: Promise<{ productId: string }>
}

export function EditProductContent({ params }: EditProductContentProps) {
  const { productId } = use(params)
  const router = useRouter()
  const storeId = useAdminStoreId()
  const [isLoading, setIsLoading] = useState(false)

  const updateProduct = useMutation(api.products.update)

  // Fetch the product
  const product = useQuery(
    api.products.getById,
    productId ? { id: productId as Id<"products"> } : "skip"
  )

  // Fetch categories for the form
  const categories = useQuery(
    api.categories.list,
    storeId ? { storeId } : "skip"
  )

  const handleSubmit = async (data: any) => {
    if (!storeId) {
      toast.error("Please select a store")
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
        id: productId as Id<"products">,
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

      toast.success("Product updated successfully")
      router.push("/products")
    } catch (error) {
      toast.error("Failed to update product")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">
          Please select a store to edit a product
        </p>
      </div>
    )
  }

  if (!product || !categories) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Product</h1>
          <p className="text-muted-foreground mt-2">{product.name}</p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <ProductForm
          categories={categories}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          submitLabel="Update Product"
        />
      </div>
    </div>
  )
}
