import { z } from "zod"

/**
 * The product form's own validation, kept out of the component.
 *
 * WHY IT IS A MODULE: this schema is what decides whether the Enregistrer
 * button does anything, and one bad field silently blocks the whole save —
 * react-hook-form refuses to submit and renders nothing unless the screen
 * happens to print that field's error. `maxSelections` was exactly that: it
 * was the one numeric field the file did NOT wrap in `optionalNumber`, so an
 * empty input became NaN, zod refused it, and the button went dead with no
 * message under a placeholder reading « Illimité ». Inside the component the
 * rule could only be tested by mounting the whole form; out here it is a pure
 * function, and the guard on every optional number is asserted directly.
 */

/**
 * Form schema for product editing with euro prices for display.
 * Avoids .default() to prevent type mismatch with @hookform/resolvers v5.
 */
/** Optional number that treats NaN (from empty inputs with valueAsNumber) as undefined */
export const optionalNumber = (schema: z.ZodNumber) =>
  schema.optional().or(z.nan().transform(() => undefined))

/**
 * A number the server requires.
 *
 * `valueAsNumber` yields NaN for an empty input, and `optionalNumber` turned
 * that into `undefined` — which the Convex validator refuses, because the
 * column is `v.number()`. Clearing the VAT field therefore failed the whole
 * save under a generic "Échec de la mise à jour du produit" toast, with no
 * indication of which field was at fault. NaN is a missing value, and it is
 * reported here, on the field.
 */
export const requiredNumber = (schema: z.ZodNumber, message: string) =>
  z.union([schema, z.nan()]).refine((value) => !Number.isNaN(value), { message })

export const productFormSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  name: z.string().min(1, "Name is required").max(200),
  slug: z.string().min(1, "Slug is required").max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  priceEuros: z.number().min(0, "Price must be positive"),
  compareAtPriceEuros: optionalNumber(z.number().min(0)),
  taxRate: requiredNumber(
    z.number().min(0, "Le taux de TVA ne peut pas être négatif").max(100, "Le taux de TVA ne peut pas dépasser 100 %"),
    "Le taux de TVA est requis"
  ),
  preparationTime: optionalNumber(z.number().int().min(1).max(240)),
  sku: z.string().max(50).optional(),
  images: z.array(z.string()).optional(),
  options: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    required: z.boolean(),
    /**
     * Empty means "no limit", which is what the input's own « Illimité »
     * placeholder promises and what the storefront, the Uber Eats sync and
     * the Deliveroo sync all read an absent value as. It was the one number
     * on this form without the guard above: `valueAsNumber` turns an empty
     * input into NaN, zod refused it, and react-hook-form then blocked the
     * submit of the entire product with no error anywhere on screen.
     */
    maxSelections: optionalNumber(z.number().int().min(1)),
    externalIds: z.object({
      uberEatsId: z.string().optional(),
      deliverooId: z.string().optional(),
    }).optional(),
    choices: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      priceModifier: z.number(),
      externalIds: z.object({
        uberEatsId: z.string().optional(),
        deliverooId: z.string().optional(),
      }).optional(),
    })),
  })).optional(),
  allergens: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  stock: z.object({
    tracked: z.boolean(),
    quantity: z.number().int().min(0),
    lowStockThreshold: z.number().int().min(0),
  }).optional(),
  scheduling: z.object({
    availableFrom: z.string().optional(),
    availableUntil: z.string().optional(),
    availableDays: z.array(z.number().min(0).max(6)).optional(),
  }).optional(),
  spiceLevel: optionalNumber(z.number().int().min(0).max(5)),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: optionalNumber(z.number().int().min(0)),
})


export type ProductFormData = z.infer<typeof productFormSchema>
