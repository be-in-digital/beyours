"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { eurosToCents } from "@/lib/admin/formatters"
import { ProductForm } from "./ProductForm"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export function NewProductContent() {
  const router = useRouter()
  const storeId = useAdminStoreId()
  const [isLoading, setIsLoading] = useState(false)

  const createProduct = useMutation(api.products.create)

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

      toast.success("Product created successfully")
      router.push("/products")
    } catch (error) {
      toast.error("Failed to create product")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">
          Please select a store to create a product
        </p>
      </div>
    )
  }

  if (!categories) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create Product</h1>
          <p className="text-muted-foreground mt-2">
            Add a new product to your menu
          </p>
        </div>

        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">
            You need to create at least one category before adding products
          </p>
          <Button asChild className="mt-4">
            <Link href="/categories/new">Create Category</Link>
          </Button>
        </div>
      </div>
    )
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
          <h1 className="text-3xl font-bold">Create Product</h1>
          <p className="text-muted-foreground mt-2">
            Add a new product to your menu
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <ProductForm
          categories={categories}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          submitLabel="Create Product"
        />
      </div>
    </div>
  )
}
