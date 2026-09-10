---
"@be-in-digital/convex-functions": patch
---

Make five delete refusals reach the owner.

Convex redacts the message of a plainly thrown `Error` in production — the
browser receives "Server Error" — and `categories.remove`, `languages.remove`,
`blog.deleteCategory` and both branches of `cmsMedia.deleteMedia` were thrown
that way. Each is a sentence the owner has to act on: how many products to
move, which page still shows this image, which language to make default first.

They are `ConvexError({ code, message })` now, in French, and two of them name
a count the caller already had in hand. `categories.remove` was the sharpest:
`products.ts` cites it as "the precedent and the reasoning" for its own
refusal, and it was the one being redacted.
