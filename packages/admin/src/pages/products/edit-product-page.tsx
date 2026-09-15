"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useAdminStoreId, useAdminApi } from "../../hooks/admin-hooks"
import { eurosToCents, centsToEuros } from "../../lib/formatters"
import { adminRoutes } from "../../config/admin-routes"
import { ProductForm } from "./product-form"
import { PropagationModal } from "./propagation-modal"
import { Button } from "@be-in-digital/ui"
import { ResolvingStore } from "../../components/resolving-store"

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

  /*
   * MULTI-STORE PROPAGATION, WHICH HAD NO DOOR (#525).
   *
   * `products.updateWithPropagation` is registered as a `storeMutation` in both
   * apps and covered by `catalogue-scope.test.ts`; `PropagationModal` is
   * exported from this package's barrel and was rendered by nothing. A chain
   * could not push one dish's new price to its other establishments from any
   * screen.
   *
   * TWO CALLS, NOT ONE, and the reason is the validator.
   * `updateWithPropagation.updates` carries only what means the same thing in
   * another establishment — name, description, price, images, allergens, tags,
   * the two flags, preparation time. It has no `slug`, `sku`, `options`,
   * `stock`, `scheduling` or `categoryId`, and it must not: a slug is unique per
   * establishment and a stock count is one kitchen's. So the save is always the
   * full `products.update` on THIS establishment, and propagation is a second,
   * explicit step over the shared attributes.
   *
   * The modal is offered only to an owner with another establishment. `self` is
   * its default and costs nothing — the save has already happened.
   */
  const stores = useQuery(api?.stores?.listAll ?? ("skip" as any)) as
    | Array<{ _id: string; name: string }>
    | undefined
  const updateWithPropagation = useMutation(api?.products?.updateWithPropagation)
  const [propagateOpen, setPropagateOpen] = useState(false)
  /** What the last successful save wrote, narrowed to what may travel. */
  const [propagatable, setPropagatable] = useState<Record<string, unknown> | null>(null)

  // Fetch the product
  const product = useQuery(
    // The edit screen has to open a draft; `getById` is the storefront's
    // read and answers `null` for anything not on sale.
    api?.products?.getAnyById,
    productId ? { id: productId } : "skip"
  )

  // Fetch categories for the form
  const categories = useQuery(
    api?.categories?.listAll,
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

      // More than one establishment: ask whether this should travel, rather
      // than leaving the answer on a screen nobody could open.
      if ((stores?.length ?? 0) > 1) {
        setPropagatable({
          name: data.name,
          description: data.description,
          price: priceInCents,
          compareAtPrice: compareAtPriceInCents,
          taxRate: data.taxRate,
          preparationTime: data.preparationTime,
          images: data.images || [],
          allergens: data.allergens || [],
          tags: data.tags || [],
          isActive: data.isActive,
          isFeatured: data.isFeatured,
        })
        setPropagateOpen(true)
        return
      }

      router.push(adminRoutes.products)
    } catch (error) {
      toast.error("Échec de la mise à jour du produit")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!storeId) return <ResolvingStore />

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
          <Link href={adminRoutes.products}>
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

      {storeId && propagatable && (
        <PropagationModal
          open={propagateOpen}
          onOpenChange={(open) => {
            setPropagateOpen(open)
            // Dismissing is « self »: the save has already happened, so closing
            // the dialog must not look like losing the edit.
            if (!open) router.push(adminRoutes.products)
          }}
          stores={stores ?? []}
          currentStoreId={storeId}
          isLoading={isLoading}
          onConfirm={async (scope, targetStoreIds) => {
            if (scope === "self") {
              router.push(adminRoutes.products)
              return
            }
            setIsLoading(true)
            try {
              const result = await updateWithPropagation({
                productId,
                updates: propagatable,
                scope,
                ...(targetStoreIds ? { targetStoreIds } : {}),
              })
              const count = (result?.storeIds?.length ?? 1) - 1
              toast.success(
                count > 0
                  ? `Appliqué à ${count} autre${count > 1 ? "s" : ""} établissement${count > 1 ? "s" : ""}`
                  : "Aucun autre établissement n'avait ce produit"
              )
              router.push(adminRoutes.products)
            } catch (error) {
              toast.error("Échec de la propagation — la modification locale est enregistrée")
              console.error(error)
            } finally {
              setIsLoading(false)
            }
          }}
        />
      )}
    </div>
  )
}
