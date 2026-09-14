---
"@be-in-digital/convex-functions": patch
---

Refuse an article filed under another establishment's rubric

`generateArticle` is guarded — `_reserveQuota` checks `content:write` on
`storeId` — and that check said nothing about `categoryId`, which arrives as a
separate argument. A caller holding `content:write` on their own establishment
could pass another one's `blogCategories` id, and the article was written with it.
The manual editor had the same door.

Not a listing leak: `listByCategory` is keyed on `storeId` +
`publishedCategoryId`, so the other establishment's blog never surfaced the
article. Two things did go wrong. `getArticleBySlug` resolves the category with a
bare `ctx.db.get` and renders `category.name` on the public page, so another
establishment's rubric name appeared on this one's blog — and the article was
unreachable from its own category listing, which resolves rubrics by
`by_storeId_slug`. Published, and filed under nothing.

`assertCategoryInStore` sits in `createArticleCore`, the single insert the manual
editor, the generation action and the queue consumer all funnel through — a rule
that lives in one caller is a rule the other two skip.
