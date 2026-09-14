---
"@be-in-digital/admin": minor
---

Let an owner put a photograph on a dish

`products.images` is an array the storefront reads at three render sites — the
card, the grid and the detail page all take `product.images?.[0]` — and the product
form had **no control for it**. Its defaults said `images: []` and nothing ever
wrote one, so the only way a dish got a photograph was the AI image-to-product
flow. A *category* could be given an image, from the same `ImageUploader`; a dish
could not.

`ProductImagesField` wraps that uploader for a list: add up to six, remove one,
and promote one to the front — the front being the card image everywhere the
storefront shows the dish, which is why the reordering is a pure, tested function
rather than an inline splice. It uploads to the `products` folder, which is in
`S3_FOLDERS` and among the five `/api/upload` accepts.
