---
"@be-in-digital/convex-functions": patch
"@be-in-digital/convex-schema": minor
---

Stop three deletes leaving a reference behind.

- `categories.remove` left `stores.stationMapping[].categoryId` — a required
  `v.id("categories")` inside an array — naming a row that no longer exists.
  Inert only because `orders.ts` compares strings rather than dereferencing,
  and re-persisted on every save of the kitchen tab. It is stripped now.
- `blog.deleteArticle` left `blogAutoQueue.articleId`: a generation work item
  for an article nobody can open. Cascaded, through a new `by_articleId` index.
- `languages.remove` left every `translations` row for that language.
  `languageCode` is a `v.string()`, so no validator could see the orphan — and
  re-adding the same code **resurrected** the stale rows, putting last month's
  German back on the storefront. Cascaded, batched at
  `LANGUAGE_TRANSLATION_BATCH`, with the app wrapper draining the rest.

`requiredActions.remove` is measured and left alone: its ids live in
`gamePlays.completedActions`, nothing dereferences them, and those rows carry
the prize claim, the cooldown and the art. 7.1 consent. The reason is now in
the code rather than absent from it.
