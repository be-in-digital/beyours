---
"@be-in-digital/convex-functions": major
---

Serve the blog somebody actually wrote, and run Auto Blog on the schedule it is sold on

Three things met in the same feature: a public blog wired to a fixture, a
subscription with no scheduler, and a generation path that authorised the wrong
thing and counted the cost too late.

**The public blog showed six of somebody else's articles.** `BLOG_POSTS` was a
hard-coded array — Unsplash photography, dates in the future — repeated across
three storefront surfaces in each app, and every card linked to `/blog/${slug}`
on a route that did not exist. Twelve dead links on every client site. Meanwhile
`listPublishedArticles` had been written, exported, and never called by anything.

`/blog`, the menu teaser and the homepage teaser now read
`api.blog.listPublishedArticles`, and `app/(storefront)/blog/[slug]/page.tsx`
exists: a server component, because a blog earns its keep in search results and
`generateMetadata` cannot run in a client one. It resolves the article through
`getArticleBySlug`, answers `notFound()` for a draft or an unknown slug, and
sanitises the stored HTML at the render. Server-side store resolution is new —
`resolveStorefrontStore` reads the `storeSlug` cookie and otherwise falls back to
the first published establishment, which is the same answer the browser's
`useStoreId` settles on, so a crawler arriving without a cookie reads what a
visitor reads. `listPublishedArticles` and `getArticleBySlug` now return
`readingMinutes`, computed from the stored markup, because the card design has
always shown a reading time and only the fixture ever had one.

**Auto Blog had no scheduler at all.** `blogAutoConfig` stored a frequency,
weekdays, an hour, a timezone and an approval mode; `blogAutoQueue` carried an
index whose own comment read "Cron: find pending jobs due for execution"; `grep
cronJobs` across both apps returned nothing. An owner who configured "weekly,
Tuesday, 09:00, auto-publish" and saved got an article only by pressing the
button themselves.

Both crons from `tasks/auto-blog-spec.md` §4.2 now exist: `plan auto blog jobs`
hourly, which asks each enabled configuration whether this is its hour in its own
timezone and writes a queue row if it is, and `execute auto blog queue` every ten
minutes, which generates what was queued. Planning is separate from generating so
that a generation dying half way leaves a row saying so rather than an hour of
silence. The scheduling rule is pure and tested against a clock rather than a
database: local wall-clock time via `Intl`, so 09:00 stays 09:00 across a
summer-time shift; one slot key per store per hour, so a retried or overlapping
sweep cannot queue the same slot twice; and themes rotate by date, so an owner
with three of them sees all three.

**`approvalMode` was validated and then read by nobody** — every generated
article was saved as a draft, whatever the owner had configured and paid for. It
is honoured now, and re-checked against `entitlements.autoBlog.allowAutoPublish`
at execution time rather than trusted from the config row, because a
subscription can be downgraded after the row was written. An article the model
produced without a cover image still stays a draft: `publishArticleCore` requires
one, and failing the whole generation over it would throw away work already paid
for.

**The quota was checked, then charged after the OpenAI call.** Measured: ten
concurrent requests against a quota of two produced ten articles, every one of
them billed. Nothing about the check was wrong — the several-minute gap after it
was. `reserveArticleQuota` and `reserveImageQuota` read and write in one Convex
mutation, before the first paid call, and the caller releases on failure so a
generation that produced nothing costs no slot. The article pipeline's own image
generations — up to four `gpt-image-1` calls each — were free of the image quota
entirely; they are charged now, and running out of images skips the image rather
than failing the article.

**The generation actions never authorised their `storeId`.** `_checkAccess` took
an `ownerId` and nothing else, so any account holding an Auto Blog plan could
generate into any establishment in the deployment — and the `@guarded-inline`
marker above the action asserted this check covered the store, which is what kept
the linter quiet about it. Both `generateArticle` and `generateImage` now
authorise `content:write` on the store they are given and derive the owner from
the session. The Enterprise multi-language gate, previously a disabled `<Switch>`
and nothing else, is enforced on the server.

**Article HTML is sanitised on write.** Only the AI path was cleaned; the
editor's own output went into the database verbatim and out to the public site
unchanged, which mattered the moment the blog stopped rendering a fixture. One
allow-list now serves all three writers — `saveDraftCore`, `publishArticleCore`
and `saveGeneratedArticleCore` — and the public renderer sanitises again, for the
rows written before it existed.

**Image-to-Product had the same quota defect, and was not on the card.** It
checked the analysis quota, made three OpenAI requests — a vision pass, an
enrichment pass and up to several image generations — and incremented the
counter seventy-five lines later. It now reserves through the same primitive and
releases on failure. Reported rather than left, because it is the same hole and
it spends the same money.

**`prose` was a class nothing defined.** `@tailwindcss/typography` was never
installed, so the blog preview's `prose prose-lg dark:prose-invert` container
produced no CSS at all: an article's `<h2>`, `<p>` and `<ul>` came out with
Tailwind's preflight reset still on them — no margins, no heading sizes, no
bullets — and read as one wall of text. The public article page renders the same
stored markup, so the plugin is installed and loaded rather than a second set of
hand-written rules being added beside it.

**Reading time is computed by a scan, not a regular expression.**
`/<[^>]*>/g` looks linear and is not: given markup with many `<` and no `>`, the
engine restarts at each one and the cost becomes quadratic — measured at 15
seconds, inside `listPublishedArticles`, which is the query behind every render
of `/blog`. It is one pass over the characters now, and bounded at 200 kB.

An adversarial pass over the above found five more, all fixed here. The
`storeSlug` cookie had **three server-side readers and no writer anywhere in the
repository**, so a server render always fell back to the first published
establishment while the browser resolved its own from localStorage or
geolocation: on a multi-store deployment the blog listed one store's articles
and linked to slugs the server looked for in another — the same dead links,
reintroduced. `useStoreId` now writes the cookie, and the article route falls
back to the deployment's other published establishments, because an article
belongs to the brand rather than to a branch. Configurations saved in the
deprecated `preferredWeekday`/`preferredMonthDay` shape were **silently never
due** — not queued, not skipped, not reported. A stale-executor recovery put the
job back without giving the reserved slot back, so four dead executors burned
four articles' quota and produced none; and a run that died *after* the article
committed would have been retried into a duplicate, which is why the article and
its queue row now commit in one transaction. A missed sweep lost the slot for
ever; there is a six-hour catch-up window now. `preferredHour` and `timezone`
are bounded where they are saved rather than only in the form.

Two of that pass's findings were not defects and are recorded as such: the
sanitiser held against forty hostile payloads, and three apparent bypasses were
correctly entity-escaped attribute values.

Breaking: `saveGeneratedArticleCore` returns `{ articleId, status }` rather than
an id, and takes an `approvalMode`. `incrementUsageCore` and
`incrementImageUsageCore` are removed — counting after the fact is the defect,
and `reserveArticleQuota` / `reserveImageQuota` replace them.
