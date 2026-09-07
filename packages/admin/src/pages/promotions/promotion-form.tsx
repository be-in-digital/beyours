"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import {
  Button,
  ButtonGroup,
  Input,
  Textarea,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  DialogFooter,
  SearchInput,
} from "@be-in-digital/ui"
import { RefreshCw, X, Package, FolderOpen } from "lucide-react"
import {
  HONOURABLE_DISCOUNT_TYPES,
  UNHONOURABLE_DISCOUNT_TYPE_MESSAGE,
  isHonourableDiscountType,
} from "@be-in-digital/convex-functions/promotionDiscount"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { convexErrorMessage } from "../../lib/convex-error"
import { eurosToCents, centsToEuros, formatPrice } from "../../lib/formatters"

/**
 * The discount types this form may offer.
 *
 * Exactly the ones `resolvePromotionDiscount` can turn into money, read from
 * the resolver itself so the two cannot drift. « Produit offert » and « Offre
 * BOGO (1+1) » used to sit in this list: they were stored happily and then
 * refused at the first redemption, so an owner built a campaign and printed
 * the flyers for a discount no diner could ever be given (#376). The server
 * now refuses them at creation; this stops the form asking for a refusal.
 */
const DISCOUNT_TYPE_LABELS: Record<
  (typeof HONOURABLE_DISCOUNT_TYPES)[number],
  string
> = {
  percentage: "Pourcentage (%)",
  fixed_amount: "Montant fixe (€)",
  free_delivery: "Livraison offerte",
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
]

const promotionSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
  description: z.string().max(500).optional(),
  triggerMode: z.enum(["coupon", "auto"]),
  couponCode: z.string().max(30).optional(),
  discountType: z.enum(HONOURABLE_DISCOUNT_TYPES),
  discountValue: z.number().min(0).optional(),
  maxDiscountAmount: z.number().min(0).optional(),
  scope: z.enum(["order", "product", "category"]),
  minimumOrderAmount: z.number().min(0).optional(),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  hasScheduling: z.boolean(),
  activeDays: z.array(z.number()).optional(),
  activeTimeFrom: z.string().optional(),
  activeTimeTo: z.string().optional(),
  maxTotalUsage: z.number().min(0).optional(),
  maxUsagePerCustomer: z.number().min(0).optional(),
  isActive: z.boolean(),
  // Target selections
  targetProductIds: z.array(z.string()).optional(),
  targetCategoryIds: z.array(z.string()).optional(),
})

type PromotionFormData = z.infer<typeof promotionSchema>

interface PromotionFormProps {
  promotion?: any
  onSuccess?: () => void
  onCancel?: () => void
}

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function toDateInputValue(timestamp?: number): string {
  if (!timestamp) return ""
  const d = new Date(timestamp)
  return d.toISOString().split("T")[0] ?? ""
}

export function PromotionForm({ promotion, onSuccess, onCancel }: PromotionFormProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const createMutation = useMutation(api?.promotions?.create)
  const updateMutation = useMutation(api?.promotions?.update)

  // Query products and categories for scope pickers
  const products = useQuery(api?.products?.list, storeId ? { storeId } : "skip") as
    | Array<{ _id: string; name: string; price?: number; imageUrl?: string; isAvailable?: boolean }>
    | undefined
  const categories = useQuery(api?.categories?.list, storeId ? { storeId } : "skip") as
    | Array<{ _id: string; name: string; productCount?: number }>
    | undefined

  // Search state for product/category pickers
  const [productSearch, setProductSearch] = useState("")
  const [categorySearch, setCategorySearch] = useState("")

  const isEditMode = !!promotion

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PromotionFormData>({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      name: promotion?.name ?? "",
      description: promotion?.description ?? "",
      triggerMode: promotion?.triggerMode ?? "coupon",
      couponCode: promotion?.couponCode ?? "",
      // A promotion stored before the guard landed carries a type the server
      // now refuses. The form opens on the nearest type that works rather than
      // on a Select with no matching option, and the banner below says why.
      discountType: isHonourableDiscountType(promotion?.discountType)
        ? promotion.discountType
        : "percentage",
      discountValue: promotion?.discountType === "fixed_amount"
        ? centsToEuros(promotion?.discountValue ?? 0)
        : (promotion?.discountValue ?? 0),
      maxDiscountAmount: promotion?.maxDiscountAmount
        ? centsToEuros(promotion.maxDiscountAmount)
        : undefined,
      scope: promotion?.scope ?? "order",
      minimumOrderAmount: promotion?.minimumOrderAmount
        ? centsToEuros(promotion.minimumOrderAmount)
        : undefined,
      startDate: toDateInputValue(promotion?.startDate) || new Date().toISOString().split("T")[0],
      endDate: toDateInputValue(promotion?.endDate) || "",
      hasScheduling: !!promotion?.scheduling,
      activeDays: promotion?.scheduling?.activeDays ?? [1, 2, 3, 4, 5],
      activeTimeFrom: promotion?.scheduling?.activeTimeFrom ?? "17:00",
      activeTimeTo: promotion?.scheduling?.activeTimeTo ?? "19:00",
      maxTotalUsage: promotion?.maxTotalUsage ?? undefined,
      maxUsagePerCustomer: promotion?.maxUsagePerCustomer ?? undefined,
      isActive: promotion?.isActive ?? true,
      targetProductIds: promotion?.targetProductIds ?? [],
      targetCategoryIds: promotion?.targetCategoryIds ?? [],
    },
  })

  const triggerMode = watch("triggerMode")
  const discountType = watch("discountType")
  const discountValue = watch("discountValue")
  const maxDiscountAmountForm = watch("maxDiscountAmount")
  const scope = watch("scope")
  const hasScheduling = watch("hasScheduling")
  const activeDays = watch("activeDays") ?? []
  const selectedProductIds = watch("targetProductIds") ?? []
  const selectedCategoryIds = watch("targetCategoryIds") ?? []

  /**
   * Compute discounted price in cents for a product.
   * Returns undefined if discount cannot be applied.
   */
  const getDiscountedPrice = (priceInCents: number): number | undefined => {
    if (!discountValue || discountValue <= 0) return undefined
    if (discountType === "percentage") {
      const raw = priceInCents * (discountValue / 100)
      const cappedDiscount =
        maxDiscountAmountForm && maxDiscountAmountForm > 0
          ? Math.min(raw, eurosToCents(maxDiscountAmountForm))
          : raw
      return Math.max(0, Math.round(priceInCents - cappedDiscount))
    }
    if (discountType === "fixed_amount") {
      return Math.max(0, priceInCents - eurosToCents(discountValue))
    }
    return undefined
  }

  // Filtered lists based on search
  const filteredProducts = useMemo(() => {
    if (!products) return []
    if (!productSearch.trim()) return products
    const q = productSearch.toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, productSearch])

  const filteredCategories = useMemo(() => {
    if (!categories) return []
    if (!categorySearch.trim()) return categories
    const q = categorySearch.toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, categorySearch])

  // Toggle handlers for product/category multi-select
  const handleProductToggle = (productId: string) => {
    const current = selectedProductIds
    if (current.includes(productId)) {
      setValue("targetProductIds", current.filter((id) => id !== productId))
    } else {
      setValue("targetProductIds", [...current, productId])
    }
  }

  const handleCategoryToggle = (categoryId: string) => {
    const current = selectedCategoryIds
    if (current.includes(categoryId)) {
      setValue("targetCategoryIds", current.filter((id) => id !== categoryId))
    } else {
      setValue("targetCategoryIds", [...current, categoryId])
    }
  }

  const handleDayToggle = (day: number) => {
    const current = activeDays
    if (current.includes(day)) {
      setValue("activeDays", current.filter((d) => d !== day))
    } else {
      setValue("activeDays", [...current, day])
    }
  }

  const onSubmit = async (data: PromotionFormData) => {
    if (!storeId) return

    try {
      // Convert euros to cents for monetary fields
      const discountValue =
        data.discountType === "fixed_amount"
          ? eurosToCents(data.discountValue ?? 0)
          : (data.discountValue ?? 0)

      const maxDiscountAmount = data.maxDiscountAmount
        ? eurosToCents(data.maxDiscountAmount)
        : undefined

      const minimumOrderAmount = data.minimumOrderAmount
        ? eurosToCents(data.minimumOrderAmount)
        : undefined

      const scheduling = data.hasScheduling
        ? {
            activeDays: data.activeDays ?? [],
            activeTimeFrom: data.activeTimeFrom ?? "00:00",
            activeTimeTo: data.activeTimeTo ?? "23:59",
          }
        : undefined

      // Build target IDs based on scope
      const targetProductIds =
        data.scope === "product" && data.targetProductIds && data.targetProductIds.length > 0
          ? data.targetProductIds
          : undefined
      const targetCategoryIds =
        data.scope === "category" && data.targetCategoryIds && data.targetCategoryIds.length > 0
          ? data.targetCategoryIds
          : undefined

      const payload = {
        name: data.name,
        description: data.description || undefined,
        triggerMode: data.triggerMode,
        couponCode: data.triggerMode === "coupon" ? data.couponCode || undefined : undefined,
        discountType: data.discountType,
        discountValue: discountValue || undefined,
        maxDiscountAmount,
        scope: data.scope,
        targetProductIds,
        targetCategoryIds,
        minimumOrderAmount,
        startDate: new Date(data.startDate).getTime(),
        endDate: new Date(data.endDate).getTime(),
        scheduling,
        maxTotalUsage: data.maxTotalUsage || undefined,
        maxUsagePerCustomer: data.maxUsagePerCustomer || undefined,
        isActive: data.isActive,
      }

      if (isEditMode) {
        await updateMutation({ id: promotion._id, ...payload })
        toast.success("Promotion mise à jour avec succès")
      } else {
        await createMutation({ storeId, ...payload })
        toast.success("Promotion créée avec succès")
      }

      onSuccess?.()
    } catch (error: unknown) {
      // `error.message` alone reads "Server Error" in production: Convex
      // redacts a thrown `Error` and only a `ConvexError` keeps its payload.
      // Every refusal this mutation can give — a duplicate coupon code, a
      // discount type no order can honour — is a French sentence the owner is
      // meant to act on, so it is read out of `data`.
      const message = convexErrorMessage(
        error,
        error instanceof Error ? error.message : "Erreur inconnue"
      )
      toast.error(isEditMode ? `Échec de la mise à jour : ${message}` : `Échec de la création : ${message}`)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-h-[60vh] overflow-y-auto pr-2">
      <div className="space-y-8 pb-6">

        {/* === Section: General Info === */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground mb-1">Informations générales</legend>

          <div className="space-y-2">
            <Label htmlFor="name">Nom de la promotion *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="ex : Happy Hour -20%"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Description optionnelle"
              rows={2}
            />
          </div>
        </fieldset>

        <hr className="border-border" />

        {/* === Section: Trigger Mode === */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground mb-1">Déclenchement</legend>

          <div className="space-y-2">
            <Label>Mode *</Label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="coupon"
                  {...register("triggerMode")}
                  className="accent-primary"
                />
                <span className="text-sm">Code promo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="auto"
                  {...register("triggerMode")}
                  className="accent-primary"
                />
                <span className="text-sm">Offre automatique</span>
              </label>
            </div>
          </div>

          {triggerMode === "coupon" && (
            <div className="space-y-2">
              <Label htmlFor="couponCode">Code promo</Label>
              <div className="flex gap-2">
                <Input
                  id="couponCode"
                  {...register("couponCode")}
                  placeholder="SUMMER2026"
                  className="uppercase"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValue("couponCode", generateCouponCode())}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Sera normalisé en majuscules</p>
            </div>
          )}
        </fieldset>

        <hr className="border-border" />

        {/* === Section: Discount === */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground mb-1">Réduction</legend>

          {/*
            A promotion created before « Produit offert » and « Offre BOGO »
            were withdrawn. It has never granted a discount — the order path
            refuses both types — and saving it requires choosing one that
            works. Said here, on the field concerned, rather than as a refusal
            the owner meets only after filling the form in.
          */}
          {isEditMode && !isHonourableDiscountType(promotion?.discountType) && (
            <p
              role="alert"
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              {UNHONOURABLE_DISCOUNT_TYPE_MESSAGE}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="discountType">Type de réduction *</Label>
            <Select
              value={discountType}
              onValueChange={(v) => setValue("discountType", v as PromotionFormData["discountType"])}
            >
              <SelectTrigger id="discountType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HONOURABLE_DISCOUNT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {DISCOUNT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(discountType === "percentage" || discountType === "fixed_amount") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountValue">
                  Valeur {discountType === "percentage" ? "(%)" : "(€)"} *
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  step={discountType === "percentage" ? "1" : "0.01"}
                  min="0"
                  max={discountType === "percentage" ? "100" : undefined}
                  {...register("discountValue", { valueAsNumber: true })}
                  placeholder={discountType === "percentage" ? "20" : "5.00"}
                />
                {errors.discountValue && (
                  <p className="text-xs text-destructive">{errors.discountValue.message}</p>
                )}
              </div>
              {discountType === "percentage" && (
                <div className="space-y-2">
                  <Label htmlFor="maxDiscountAmount">Plafond (€)</Label>
                  <Input
                    id="maxDiscountAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("maxDiscountAmount", { valueAsNumber: true })}
                    placeholder="10.00"
                  />
                  <p className="text-xs text-muted-foreground">Montant max de réduction</p>
                </div>
              )}
            </div>
          )}


          <div className="space-y-2">
            <Label>Portée *</Label>
            <div className="flex gap-6">
              {(["order", "product", "category"] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={s}
                    {...register("scope")}
                    className="accent-primary"
                  />
                  <span className="text-sm">
                    {s === "order" ? "Commande" : s === "product" ? "Produit" : "Catégorie"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* === Product Picker (scope = product) === */}
          {scope === "product" && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label>Produits ciblés</Label>
                </div>
                {selectedProductIds.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedProductIds.length} sélectionné{selectedProductIds.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <SearchInput
                placeholder="Rechercher un produit..."
                value={productSearch}
                onValueChange={setProductSearch}
                size="sm"
              />

              <div className="max-h-[180px] overflow-y-auto space-y-1 rounded-md border border-border bg-background p-1">
                {!products ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Chargement…</p>
                ) : filteredProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {productSearch ? "Aucun produit trouvé" : "Aucun produit dans ce store"}
                  </p>
                ) : (
                  filteredProducts.map((product) => (
                    <label
                      key={product._id}
                      className={`flex items-center gap-3 px-2.5 py-2 rounded-md cursor-pointer transition-colors text-sm ${
                        selectedProductIds.includes(product._id)
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted border border-transparent"
                      }`}
                    >
                      <Checkbox
                        checked={selectedProductIds.includes(product._id)}
                        onCheckedChange={() => handleProductToggle(product._id)}
                      />
                      <span className="flex-1 truncate">{product.name}</span>
                      {product.price != null && (() => {
                        const discounted = getDiscountedPrice(product.price)
                        return discounted != null && discounted !== product.price ? (
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-muted-foreground line-through">
                              {formatPrice(product.price)}
                            </span>
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">
                              {formatPrice(discounted)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatPrice(product.price)}
                          </span>
                        )
                      })()}
                    </label>
                  ))
                )}
              </div>

              {selectedProductIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedProductIds.map((id) => {
                    const p = products?.find((prod) => prod._id === id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                      >
                        {p?.name ?? "…"}
                        <button
                          type="button"
                          onClick={() => handleProductToggle(id)}
                          className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Sélectionnez les produits sur lesquels appliquer la promotion
              </p>
            </div>
          )}

          {/* === Category Picker (scope = category) === */}
          {scope === "category" && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <Label>Catégories ciblées</Label>
                </div>
                {selectedCategoryIds.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedCategoryIds.length} sélectionnée{selectedCategoryIds.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <SearchInput
                placeholder="Rechercher une catégorie..."
                value={categorySearch}
                onValueChange={setCategorySearch}
                size="sm"
              />

              <div className="max-h-[180px] overflow-y-auto space-y-1 rounded-md border border-border bg-background p-1">
                {!categories ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Chargement…</p>
                ) : filteredCategories.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {categorySearch ? "Aucune catégorie trouvée" : "Aucune catégorie dans ce store"}
                  </p>
                ) : (
                  filteredCategories.map((category) => (
                    <label
                      key={category._id}
                      className={`flex items-center gap-3 px-2.5 py-2 rounded-md cursor-pointer transition-colors text-sm ${
                        selectedCategoryIds.includes(category._id)
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted border border-transparent"
                      }`}
                    >
                      <Checkbox
                        checked={selectedCategoryIds.includes(category._id)}
                        onCheckedChange={() => handleCategoryToggle(category._id)}
                      />
                      <span className="flex-1 truncate">{category.name}</span>
                    </label>
                  ))
                )}
              </div>

              {selectedCategoryIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCategoryIds.map((id) => {
                    const c = categories?.find((cat) => cat._id === id)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                      >
                        {c?.name ?? "…"}
                        <button
                          type="button"
                          onClick={() => handleCategoryToggle(id)}
                          className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Sélectionnez les catégories sur lesquelles appliquer la promotion
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="minimumOrderAmount">Commande minimum (€)</Label>
            <Input
              id="minimumOrderAmount"
              type="number"
              step="0.01"
              min="0"
              {...register("minimumOrderAmount", { valueAsNumber: true })}
              placeholder="15.00"
            />
          </div>
        </fieldset>

        <hr className="border-border" />

        {/* === Section: Schedule === */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground mb-1">Période & horaires</legend>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Date de début *</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
              {errors.startDate && (
                <p className="text-xs text-destructive">{errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Date de fin *</Label>
              <Input id="endDate" type="date" {...register("endDate")} />
              {errors.endDate && (
                <p className="text-xs text-destructive">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="hasScheduling">Planification horaire</Label>
                <p className="text-xs text-muted-foreground">
                  Restreindre à certains jours et heures
                </p>
              </div>
              <Switch
                id="hasScheduling"
                checked={hasScheduling}
                onCheckedChange={(checked) => setValue("hasScheduling", checked)}
              />
            </div>

            {hasScheduling && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Jours actifs</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <label
                        key={day.value}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                          activeDays.includes(day.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={activeDays.includes(day.value)}
                          onChange={() => handleDayToggle(day.value)}
                          className="sr-only"
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="activeTimeFrom">Heure début</Label>
                    <Input id="activeTimeFrom" type="time" {...register("activeTimeFrom")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="activeTimeTo">Heure fin</Label>
                    <Input id="activeTimeTo" type="time" {...register("activeTimeTo")} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </fieldset>

        <hr className="border-border" />

        {/* === Section: Limits & Status === */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground mb-1">Limites & statut</legend>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxTotalUsage">Utilisations max</Label>
              <Input
                id="maxTotalUsage"
                type="number"
                min="0"
                {...register("maxTotalUsage", { valueAsNumber: true })}
                placeholder="Illimité"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxUsagePerCustomer">Max par client</Label>
              <Input
                id="maxUsagePerCustomer"
                type="number"
                min="0"
                {...register("maxUsagePerCustomer", { valueAsNumber: true })}
                placeholder="Illimité"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Active</Label>
              <p className="text-xs text-muted-foreground">
                La promotion est visible et utilisable
              </p>
            </div>
            <Switch
              id="isActive"
              checked={watch("isActive")}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
          </div>
        </fieldset>
      </div>

      <DialogFooter className="sticky bottom-0 bg-background pt-4 pb-2 px-2 mt-6 border-t border-border">
        <ButtonGroup>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Enregistrement..."
              : isEditMode
              ? "Mettre à jour"
              : "Créer la promotion"}
          </Button>
        </ButtonGroup>
      </DialogFooter>
    </form>
  )
}
