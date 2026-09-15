---
"@be-in-digital/convex-functions": patch
"@be-in-digital/convex-schema": patch
"@be-in-digital/admin": patch
---

Three package functions the product needed and no app wrapped.

`emailSegments.refreshCount` was the only writer of a real `subscriberCount`,
and nothing wrapped it — so `create` wrote 0, `duplicate` copied 0, and three
screens presented that as a subscriber count for as long as segments have
existed. The campaign wizard's audience estimate, read one click before a send,
said « 0 abonnés » for every segment. Those screens count live now, through
`emailSegments.countMatchingSubscribers`, which is the same query the segment
editor already uses to preview a rule set as it is typed. `refreshCount` is
deleted: caching needed a refresh policy, and a stale figure on that screen is
worse than none.

`blog.deleteTag` existed, join cleanup and all, and no app wrapped it. The
editor has created tags since it was written and nothing deleted one, so every
typo stayed in the picker for the life of the establishment. It is wrapped on
`content:delete` with `storeIdFrom` resolving the establishment from the tag
itself — the core takes a bare `tagId`, and a caller that supplies the
establishment its own permission is checked against is not a check.

`translations.bulkUpsert` is deleted: its `storeId` sat inside each array
element, where no store guard can read it, so it could never be wrapped as
written and nothing needs it. `cmsPublish.publishPage` is deleted too — it took
`updatedBy` from the client, and each app's own wrapper supersedes it.
