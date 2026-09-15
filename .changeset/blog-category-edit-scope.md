---
"@be-in-digital/convex-functions": patch
---

Refuse another establishment's rubric on the EDIT path too

#499 put `assertCategoryInStore` in `createArticleCore` and stopped there. The
wrapper's own guard does not close the gap: `saveDraft` validates the ARTICLE's
store through `storeIdFromArticle` and never the `categoryId` beside it, which
arrives from the browser. A member holding `content:write` on their own
establishment could edit their own article with another establishment's rubric
id.

It does not stay in the draft. `publishArticleCore` copies `draftCategoryId` to
`publishedCategoryId` unconditionally, three public readers resolve it with a
bare `ctx.db.get`, and `category.name` renders on the page — the other
establishment's rubric on this one's blog. The article also self-orphans: its own
category listing seeks on `storeId` + `publishedCategoryId`, which now matches
nothing.

The store comes from `article.storeId`, not from an argument: taking it from the
caller would reopen the door one field along. `saveDraftCore` has no `storeId`
argument at all, and a test pins that it stays that way.
