import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  MAX_PRODUCT_IMAGES,
  promoteImage,
  removeImage,
} from "../pages/products/product-images-field"

/**
 * A dish can be given a photograph (#105).
 *
 * WHAT WAS WRONG. `products.images` is an array the storefront reads at three
 * render sites — the card, the grid and the detail page all take
 * `product.images?.[0]` — and the product form had no control for it. Its defaults
 * said `images: []` and nothing ever wrote one, so the only way a dish got a
 * photograph was the AI image-to-product flow. A CATEGORY could be given an image,
 * from the same `ImageUploader`; a dish could not.
 *
 * The position is the meaning: index 0 is the card image, which is why the
 * reordering is a pure function with a test rather than an inline splice.
 */

const HERE = path.dirname(new URL(import.meta.url).pathname)
const PRODUCTS = path.join(HERE, "..", "pages", "products")

describe("promoteImage", () => {
  it("moves the chosen photo to the front", () => {
    // The front is the card image everywhere the storefront shows the dish, so
    // "make this the main one" is the only ordering an owner actually wants.
    expect(promoteImage(["a", "b", "c"], 2)).toEqual(["c", "a", "b"])
  })

  it("keeps the others in their own order", () => {
    expect(promoteImage(["a", "b", "c", "d"], 2)).toEqual(["c", "a", "b", "d"])
  })

  it("does nothing when the photo is already first", () => {
    const images = ["a", "b"]
    expect(promoteImage(images, 0)).toBe(images)
  })

  it("does nothing for an index that is not there", () => {
    // A stale click after another tab removed the photo.
    const images = ["a", "b"]
    expect(promoteImage(images, 9)).toBe(images)
    expect(promoteImage(images, -1)).toBe(images)
  })

  it("loses no photo", () => {
    const images = ["a", "b", "c"]
    expect(promoteImage(images, 1).sort()).toEqual(images.slice().sort())
  })
})

describe("removeImage", () => {
  it("drops the chosen photo and keeps the order", () => {
    expect(removeImage(["a", "b", "c"], 1)).toEqual(["a", "c"])
  })

  it("promotes the second photo when the first is removed", () => {
    // Not a special case in the code, and worth pinning: removing the card image
    // has to leave a card image behind.
    expect(removeImage(["a", "b", "c"], 0)[0]).toBe("b")
  })

  it("does nothing for an index that is not there", () => {
    const images = ["a"]
    expect(removeImage(images, 3)).toBe(images)
    expect(removeImage(images, -1)).toBe(images)
  })

  it("empties the list when the last photo goes", () => {
    expect(removeImage(["a"], 0)).toEqual([])
  })
})

describe("the field itself", () => {
  const source = fs.readFileSync(
    path.join(PRODUCTS, "product-images-field.tsx"),
    "utf8"
  )
  const form = fs.readFileSync(path.join(PRODUCTS, "product-form.tsx"), "utf8")

  it("uploads into a folder the allow-list actually accepts", () => {
    /* `S3_FOLDERS` in `core/src/aws/folders.ts` is a closed set of eleven and
       `/api/upload` narrows it to five. `products` is in both. A folder outside
       the set throws at `uploadOptionsSchema.parse()` — the failure that lost
       category, blog and storefront images. */
    expect(source).toContain('folder="products"')
  })

  it("accepts only the image types the upload route does", () => {
    expect(source).toContain("image/jpeg,image/png,image/webp")
  })

  it("reuses the one uploader rather than a second implementation", () => {
    // `ImageUploader` carries the presigned-POST dance, the size check and the
    // content-type allow-list. A second copy is a second thing to get wrong.
    expect(source).toContain('from "../../components/image-uploader"')
  })

  it("bounds the number of photos", () => {
    expect(MAX_PRODUCT_IMAGES).toBeGreaterThan(1)
    expect(MAX_PRODUCT_IMAGES).toBeLessThanOrEqual(10)
  })

  it("is actually rendered by the product form", () => {
    // The defect was a field with no control, so a component with no call site
    // would be the same defect one layer along.
    expect(form).toContain("<ProductImagesField")
    expect(form).toContain('setValue("images"')
  })

  it("marks the form dirty when a photo changes, so Save is offered", () => {
    // Without `shouldDirty` the button stays inert and the upload is lost on
    // navigation — the photo would be in S3 and on no dish.
    expect(form).toMatch(/setValue\("images",[\s\S]{0,40}shouldDirty: true/)
  })
})
