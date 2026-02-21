"use client"

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
} from "@beindigital-engine/ui"
import { RefreshCw } from "lucide-react"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { eurosToCents, centsToEuros } from "../../lib/formatters"

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
  discountType: z.enum(["percentage", "fixed_amount", "free_product", "free_delivery", "bogo"]),
  discountValue: z.coerce.number().min(0).optional(),
  maxDiscountAmount: z.coerce.number().min(0).optional(),
  scope: z.enum(["order", "product", "category"]),
  minimumOrderAmount: z.coerce.number().min(0).optional(),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  hasScheduling: z.boolean(),
  activeDays: z.array(z.number()).optional(),
  activeTimeFrom: z.string().optional(),
  activeTimeTo: z.string().optional(),
  maxTotalUsage: z.coerce.number().min(0).optional(),
  maxUsagePerCustomer: z.coerce.number().min(0).optional(),
  isActive: z.boolean(),
  // BOGO fields
  bogoTriggerQuantity: z.coerce.number().min(1).optional(),
  bogoRewardQuantity: z.coerce.number().min(1).optional(),
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
      discountType: promotion?.discountType ?? "percentage",
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
      bogoTriggerQuantity: promotion?.bogoTriggerQuantity ?? 2,
      bogoRewardQuantity: promotion?.bogoRewardQuantity ?? 1,
    },
  })

  const triggerMode = watch("triggerMode")
  const discountType = watch("discountType")
  const hasScheduling = watch("hasScheduling")
  const activeDays = watch("activeDays") ?? []

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

      const payload = {
        name: data.name,
        description: data.description || undefined,
        triggerMode: data.triggerMode,
        couponCode: data.triggerMode === "coupon" ? data.couponCode || undefined : undefined,
        discountType: data.discountType,
        discountValue: discountValue || undefined,
        maxDiscountAmount,
        scope: data.scope,
        minimumOrderAmount,
        startDate: new Date(data.startDate).getTime(),
        endDate: new Date(data.endDate).getTime(),
        scheduling,
        maxTotalUsage: data.maxTotalUsage || undefined,
        maxUsagePerCustomer: data.maxUsagePerCustomer || undefined,
        isActive: data.isActive,
        bogoTriggerQuantity: data.discountType === "bogo" ? data.bogoTriggerQuantity : undefined,
        bogoRewardQuantity: data.discountType === "bogo" ? data.bogoRewardQuantity : undefined,
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
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(isEditMode ? `Échec de la mise à jour : ${message}` : `Échec de la création : ${message}`)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Nom de la promotion *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="ex : Happy Hour -20%"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Description optionnelle"
          rows={2}
        />
      </div>

      {/* Trigger Mode */}
      <div className="space-y-2">
        <Label>Mode de déclenchement *</Label>
        <div className="flex gap-4">
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

      {/* Coupon Code (only for coupon mode) */}
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

      {/* Discount Type */}
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
            <SelectItem value="percentage">Pourcentage (%)</SelectItem>
            <SelectItem value="fixed_amount">Montant fixe (€)</SelectItem>
            <SelectItem value="free_product">Produit offert</SelectItem>
            <SelectItem value="free_delivery">Livraison offerte</SelectItem>
            <SelectItem value="bogo">Offre BOGO (1+1)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Discount Value (for percentage and fixed_amount) */}
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
              {...register("discountValue")}
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
                {...register("maxDiscountAmount")}
                placeholder="10.00"
              />
              <p className="text-xs text-muted-foreground">Montant max de réduction</p>
            </div>
          )}
        </div>
      )}

      {/* BOGO fields */}
      {discountType === "bogo" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bogoTriggerQuantity">Quantité achetée</Label>
            <Input
              id="bogoTriggerQuantity"
              type="number"
              min="1"
              {...register("bogoTriggerQuantity")}
              placeholder="2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bogoRewardQuantity">Quantité offerte</Label>
            <Input
              id="bogoRewardQuantity"
              type="number"
              min="1"
              {...register("bogoRewardQuantity")}
              placeholder="1"
            />
          </div>
        </div>
      )}

      {/* Scope */}
      <div className="space-y-2">
        <Label>Portée *</Label>
        <div className="flex gap-4">
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

      {/* Minimum Order Amount */}
      <div className="space-y-2">
        <Label htmlFor="minimumOrderAmount">Commande minimum (€)</Label>
        <Input
          id="minimumOrderAmount"
          type="number"
          step="0.01"
          min="0"
          {...register("minimumOrderAmount")}
          placeholder="15.00"
        />
      </div>

      {/* Dates */}
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

      {/* Scheduling */}
      <div className="space-y-3">
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
          <div className="space-y-3 pl-1">
            <div className="space-y-2">
              <Label>Jours actifs</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <label
                    key={day.value}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs cursor-pointer ${
                      activeDays.includes(day.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border"
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

      {/* Usage Limits */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxTotalUsage">Utilisations max</Label>
          <Input
            id="maxTotalUsage"
            type="number"
            min="0"
            {...register("maxTotalUsage")}
            placeholder="Illimité"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxUsagePerCustomer">Max par client</Label>
          <Input
            id="maxUsagePerCustomer"
            type="number"
            min="0"
            {...register("maxUsagePerCustomer")}
            placeholder="Illimité"
          />
        </div>
      </div>

      {/* Active Switch */}
      <div className="flex items-center justify-between">
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

      <DialogFooter>
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
