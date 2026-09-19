"use client"

/**
 * A dish's photographs (#105).
 *
 * WHAT WAS MISSING. `products.images` is an array the storefront reads — the card,
 * the grid and the detail page all take `product.images?.[0]` — and the product
 * form had no control for it at all. Its defaults said `images: []` and nothing
 * ever wrote one, so the only way a dish got a photograph was the AI
 * image-to-product flow. A CATEGORY could be given an image, from the same
 * `ImageUploader` this file wraps; a dish could not.
 *
 * WHY A WRAPPER AND NOT A SECOND UPLOADER. `ImageUploader` handles ONE url and
 * already carries the presigned-POST dance, the size check and the content-type
 * allow-list — all of which are the same here. What a product needs on top is a
 * LIST: several photographs, in an order the owner controls, because the first one
 * is the card image everywhere the storefront shows the dish. That ordering is the
 * whole reason this is not four copies of the same field.
 */

import { useState } from "react"
import { ArrowLeft, Star, Trash2 } from "lucide-react"
import { Button, Label } from "@be-yours/ui"
import { ImageUploader } from "../../components/image-uploader"

/** The most photographs one dish may carry. */
export const MAX_PRODUCT_IMAGES = 6

interface PresignedUrlResult {
  uploadUrl: string
  key: string
  publicUrl: string
}

export interface ProductImagesFieldProps {
  value: string[]
  onChange: (images: string[]) => void
  onRequestUploadUrl: (args: {
    folder: string
    contentType: string
  }) => Promise<PresignedUrlResult>
}

/**
 * Move one image to the front.
 *
 * Exported and pure because the position IS the meaning — index 0 is what the
 * storefront renders on the card — so it is worth a test rather than an inline
 * splice.
 */
export function promoteImage(images: string[], index: number): string[] {
  if (index <= 0 || index >= images.length) return images
  const chosen = images[index] as string
  return [chosen, ...images.filter((_, i) => i !== index)]
}

/** Drop one image, keeping the rest in order. */
export function removeImage(images: string[], index: number): string[] {
  if (index < 0 || index >= images.length) return images
  return images.filter((_, i) => i !== index)
}

export function ProductImagesField({
  value,
  onChange,
  onRequestUploadUrl,
}: ProductImagesFieldProps) {
  // The uploader is a one-url control, so it gets a scratch slot: a URL lands
  // here, is appended to the list, and the slot is cleared for the next one.
  const [pending, setPending] = useState("")

  const atCapacity = value.length >= MAX_PRODUCT_IMAGES

  const append = (url: string) => {
    setPending("")
    if (!url) return
    // Silently ignoring a duplicate rather than refusing it: the same file
    // uploaded twice is a slip, not something to explain.
    if (value.includes(url)) return
    if (value.length >= MAX_PRODUCT_IMAGES) return
    onChange([...value, url])
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Photos du plat</Label>
        <p className="text-xs text-muted-foreground">
          La première photo est celle qui s&apos;affiche sur la carte.{" "}
          {MAX_PRODUCT_IMAGES} au maximum.
        </p>
      </div>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((url, index) => (
            <li
              key={url}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
            >
              {/* A plain `img`, not `next/image`: this package is framework-free
                  and is consumed by two Next apps, neither of which guarantees the
                  loader here. Same as `image-uploader.tsx`'s own preview. The
                  storefront uses `next/image` where it renders these. */}
              <img
                src={url}
                alt=""
                className="h-14 w-14 shrink-0 rounded object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {index === 0 ? "Photo principale" : `Photo ${index + 1}`}
              </span>
              {index > 0 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Mettre la photo ${index + 1} en principale`}
                  onClick={() => onChange(promoteImage(value, index))}
                >
                  <Star className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Retirer la photo ${index + 1}`}
                onClick={() => onChange(removeImage(value, index))}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {atCapacity ? (
        <p className="text-xs text-muted-foreground">
          <ArrowLeft className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Retirez une photo pour en ajouter une autre.
        </p>
      ) : (
        <ImageUploader
          value={pending}
          onChange={append}
          onRequestUploadUrl={onRequestUploadUrl}
          // `products`, which is in `S3_FOLDERS` and in the five the
          // `/api/upload` route accepts — see `core/src/aws/folders.ts`.
          folder="products"
          accept="image/jpeg,image/png,image/webp"
          maxSizeMB={5}
          label={value.length === 0 ? "Ajouter une photo" : "Ajouter une autre photo"}
          placeholder="JPEG, PNG ou WebP, 5 Mo maximum"
        />
      )}
    </div>
  )
}
