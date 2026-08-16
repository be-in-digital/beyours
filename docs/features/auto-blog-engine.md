# Auto Blog Engine

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [Plan Tiers and Quotas](#4-plan-tiers-and-quotas)
5. [Stripe Subscription Flow](#5-stripe-subscription-flow)
6. [Article Generation Pipeline](#6-article-generation-pipeline)
7. [Image Generation Pipeline](#7-image-generation-pipeline)
8. [Unsplash Integration](#8-unsplash-integration)
9. [Blog Editor](#9-blog-editor)
10. [Auto Blog Configuration](#10-auto-blog-configuration)
11. [Blog CRUD Operations](#11-blog-crud-operations)
12. [Guard System](#12-guard-system)
13. [Usage Tracking](#13-usage-tracking)
14. [SEO Optimization Rules](#14-seo-optimization-rules)
15. [Security Measures](#15-security-measures)
16. [API Reference](#16-api-reference)
17. [UI Components Reference](#17-ui-components-reference)
18. [Routes](#18-routes)
19. [Environment Variables](#19-environment-variables)
20. [Testing](#20-testing)
21. [Error Handling](#21-error-handling)
22. [Configuration](#22-configuration)

---

## 1. Feature Overview

### What It Does

The Auto Blog Engine is a premium SaaS feature of BeYours Engine that allows restaurant owners to generate SEO-optimized blog articles using AI. It covers the entire blog content lifecycle: AI-powered article generation, image sourcing (Unsplash stock photos and GPT-generated images), rich text editing, multi-language auto-translation, scheduled publishing, and Stripe-based subscription billing.

### Who It Is For

Restaurant owners who purchase a BeYours theme and want to maintain an active blog to improve their SEO ranking and attract customers. The feature is gated behind a monthly/annual subscription with three plan tiers (Starter, Pro, Enterprise).

### Business Value

- **Recurring Revenue**: Monthly/annual subscriptions at 19/49/99 EUR per month (or 15/39/79 EUR annual with 2 months free).
- **SEO Boost for Customers**: Professionally written, SEO-optimized articles increase organic search traffic for restaurant websites.
- **Minimal Effort**: Restaurant owners describe a topic and the system produces a complete article with images, metadata, and tags.
- **Scalability**: The multi-store `targetStoreIds` field in the config allows future cross-store content distribution.

### Key Capabilities

| Capability | Description |
|------------|-------------|
| AI Article Generation | GPT-4o-mini produces 1200-1800 word SEO-optimized HTML articles |
| Cover Image Pipeline | Unsplash (priority) with GPT Image 1 fallback for cover images |
| Content Images | 3 inline images per article via Unsplash or GPT Image generation |
| Standalone Image Generation | GPT Image 1 Mini for on-demand image creation in the editor |
| Rich Text Editor | Tiptap-based editor with BubbleMenu, image insert, and AI tools |
| Subscription Billing | Stripe Checkout + Customer Portal with webhook sync |
| Plan-Gated Features | Auto-publish, multi-language, topic limits vary by plan |
| Auto-Translation | Optional GPT-based translation to all active store languages |
| Scheduled Publishing | Convex scheduler for future publication dates |
| Usage Tracking | Monthly quota enforcement with period-key-based tracking |

---

## 2. Architecture

### System Diagram

```
+----------------------------------------------------------------------+
|                           FRONTEND (Next.js)                          |
|                                                                       |
|  BlogContent  BlogArticleEditor  BlogAutoConfigForm  SubscriptionPage |
|  GenerateArticleDialog  GenerateImageDialog  UnsplashImagePicker      |
|  BlogRichTextEditor (Tiptap)  BlogCategoryManager  BlogArticlesTable  |
+-------+------------------+-------------------+-----------------------+
        |                  |                   |
        | useQuery         | useMutation       | useAction
        | useAction        |                   |
        v                  v                   v
+----------------------------------------------------------------------+
|                     APP LAYER (Convex - reference/convex/)      |
|                                                                       |
|  blog.ts                 blogAutoConfig.ts    bidSubscription.ts       |
|  (query/mutation)        (query/mutation)     (action "use node")     |
|                                                                       |
|  blogAutoGenerate.ts     blogImageGenerate.ts  unsplashSearch.ts      |
|  (action "use node")     (action "use node")   (action "use node")   |
|                                                                       |
|  blogAutoGenerateInternal.ts    blogImageGenerateInternal.ts          |
|  (internalQuery/Mutation)       (internalQuery/Mutation)              |
|                                                                       |
|  bidSubscriptionInternal.ts     bidStripeWebhook.ts                   |
|  (internalQuery/Mutation)       (httpAction)                          |
+-------+------------------+-------------------+-----------------------+
        |                  |                   |
        | delegates to     |                   |
        v                  v                   v
+----------------------------------------------------------------------+
|                   PACKAGE LAYER (packages/convex-functions/src/)       |
|                                                                       |
|  blogAutoGuards.ts     blogAutoGenerate.ts     blogAutoUsage.ts       |
|  blogAutoConfig.ts     blog.ts                 blogPublish.ts         |
|  ownerEntitlements.ts  bidSubscription.ts                             |
+----------------------------------------------------------------------+
        |                  |                   |
        v                  v                   v
+-------------------+  +-------------------+  +-------------------+
|  CONVEX DATABASE  |  |   EXTERNAL APIs   |  |   AWS STORAGE     |
|                   |  |                   |  |                   |
|  blogArticles     |  |  OpenAI GPT-4o    |  |  S3 (cms/ prefix) |
|  blogCategories   |  |  GPT Image 1      |  |                   |
|  blogTags         |  |  GPT Image 1 Mini |  +-------------------+
|  blogArticleTags  |  |  Unsplash API     |
|  blogAutoConfig   |  |  Stripe API       |
|  blogAutoQueue    |  |                   |
|  blogAutoUsage    |  +-------------------+
|  ownerEntitlements|
|  cmsMedia         |
+-------------------+
```

### Layer Separation

| Layer | Location | Runtime | Purpose |
|-------|----------|---------|---------|
| **Package Layer** | `packages/convex-functions/src/` | Default Convex | Pure business logic, guards, validators, query/mutation handlers. No auth, no API calls, no `"use node"`. Reusable across apps. |
| **App Layer** | `apps/reference/convex/` | Default Convex + `"use node"` | Convex function wrappers that add auth checks. Actions with `"use node"` handle external API calls (OpenAI, Unsplash, Stripe, S3). Internal functions bridge actions and the database. |
| **UI Layer** | `apps/reference/components/admin/blog/` and `subscription/` | Client (React) | React components using Convex hooks (`useQuery`, `useMutation`, `useAction`). Forms, dialogs, tables, rich text editor. |
| **Schema Layer** | `packages/convex-schema/src/tables/` | Build-time | Convex table definitions with validators and indexes. |

### Why `"use node"` Separation?

Convex actions with `"use node"` run in a Node.js environment and can use npm packages (`@aws-sdk/client-s3`, `stripe`, `sanitize-html`, etc.) and the `fetch` API. However, they cannot directly read/write the database. They must call `ctx.runQuery()` or `ctx.runMutation()` to interact with the database via internal functions.

This is why each `"use node"` file has a companion `*Internal.ts` file:

| Node Action File | Internal Companion | Purpose |
|---|---|---|
| `blogAutoGenerate.ts` | `blogAutoGenerateInternal.ts` | Article generation: auth check, context lookup, save article, create media |
| `blogImageGenerate.ts` | `blogImageGenerateInternal.ts` | Image generation: auth check, increment usage |
| `bidSubscription.ts` | `bidSubscriptionInternal.ts` | Subscription: lookup entitlements, upsert from Stripe events |

---

## 3. Database Schema

All tables are defined in `packages/convex-schema/src/tables/autoBlog.ts`.

### 3.1 `ownerEntitlements`

Feature gating per owner account. Source of truth for plan limits and Stripe subscription state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ownerId` | `string` | Yes | Better Auth user ID |
| `autoBlog` | `object` | Yes | Auto Blog feature configuration (see sub-fields below) |
| `autoBlog.enabled` | `boolean` | Yes | Master toggle for the feature |
| `autoBlog.plan` | `"starter" \| "pro" \| "enterprise" \| undefined` | No | Current plan tier. `undefined` = no active plan |
| `autoBlog.monthlyQuota` | `number` | Yes | Maximum articles per calendar month (2, 8, or 30) |
| `autoBlog.maxTopics` | `number \| undefined` | No | Maximum themes/topics allowed. `undefined` = unlimited |
| `autoBlog.allowMultiLanguage` | `boolean` | Yes | Whether auto-translation is available |
| `autoBlog.allowAutoPublish` | `boolean` | Yes | Whether auto-publish mode is available |
| `autoBlog.monthlyImageQuota` | `number \| undefined` | No | Maximum AI-generated images per month (5, 20, or 100). Optional for migration safety, falls back to `?? 0` |
| `stripeCustomerId` | `string \| undefined` | No | Stripe customer ID (`cus_xxx`) |
| `stripeSubscriptionId` | `string \| undefined` | No | Stripe subscription ID (`sub_xxx`) |
| `subscriptionStatus` | `string \| undefined` | No | Stripe subscription status: `active`, `trialing`, `past_due`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` |
| `createdAt` | `number` | Yes | Unix timestamp (ms) |
| `updatedAt` | `number` | Yes | Unix timestamp (ms) |

**Indexes:**

| Index Name | Fields | Purpose |
|------------|--------|---------|
| `by_ownerId` | `["ownerId"]` | Lookup by authenticated user |
| `by_stripeCustomerId` | `["stripeCustomerId"]` | Webhook lookup by Stripe customer |
| `by_stripeSubscriptionId` | `["stripeSubscriptionId"]` | Webhook lookup by subscription |

### 3.2 `blogAutoConfig`

Editorial configuration per store. One record per store, linked to owner via `ownerId`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ownerId` | `string` | Yes | Better Auth user ID |
| `storeId` | `Id<"stores">` | Yes | Associated store |
| `isEnabled` | `boolean` | Yes | Whether auto-generation is active for this store |
| `themes` | `string[]` | Yes | Topic themes for article generation (e.g., "recettes de saison", "nouveautes") |
| `frequency` | `"weekly" \| "monthly"` | Yes | Generation frequency |
| `preferredWeekday` | `number \| undefined` | No | **DEPRECATED** -- single weekday, kept for backward compat |
| `preferredMonthDay` | `number \| undefined` | No | **DEPRECATED** -- single month day, kept for backward compat |
| `preferredWeekdays` | `number[] \| undefined` | No | Days of week for generation (0=Monday through 6=Sunday) |
| `preferredMonthDays` | `number[] \| undefined` | No | Days of month for generation (1-28) |
| `preferredHour` | `number` | Yes | Local hour for generation (0-23) |
| `timezone` | `string` | Yes | IANA timezone (e.g., "Europe/Paris") |
| `tone` | `"formel" \| "decontracte" \| "storytelling"` | Yes | Writing tone for generated articles |
| `primaryLocale` | `string` | Yes | Primary language code (e.g., "fr", "en") |
| `autoTranslate` | `boolean` | Yes | Whether to auto-translate after generation |
| `approvalMode` | `"draft_review" \| "auto_publish"` | Yes | Whether articles are saved as drafts or auto-published |
| `categoryId` | `Id<"blogCategories"> \| undefined` | No | Default category for generated articles |
| `targetStoreIds` | `Id<"stores">[] \| undefined` | No | Target stores for cross-store distribution (future) |
| `lastPlannedAt` | `number \| undefined` | No | Timestamp of last planning run |
| `lastGeneratedAt` | `number \| undefined` | No | Timestamp of last generation |
| `createdAt` | `number` | Yes | Unix timestamp (ms) |
| `updatedAt` | `number` | Yes | Unix timestamp (ms) |

**Indexes:**

| Index Name | Fields | Purpose |
|------------|--------|---------|
| `by_storeId` | `["storeId"]` | Lookup config by store |
| `by_ownerId` | `["ownerId"]` | List configs for an owner |
| `by_isEnabled` | `["isEnabled"]` | Query active configs for cron planning |

### 3.3 `blogAutoQueue`

Job queue and journal for auto-generated articles. Each record represents one generation job.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ownerId` | `string` | Yes | Better Auth user ID |
| `storeId` | `Id<"stores">` | Yes | Target store |
| `configId` | `Id<"blogAutoConfig">` | Yes | Reference to editorial config |
| `status` | `"pending" \| "generating" \| "draft_created" \| "published" \| "failed" \| "cancelled"` | Yes | Job status |
| `scheduledFor` | `number` | Yes | When the job should execute |
| `startedAt` | `number \| undefined` | No | When generation started |
| `completedAt` | `number \| undefined` | No | When generation completed |
| `theme` | `string` | Yes | Topic/theme for this article |
| `locale` | `string` | Yes | Language code |
| `generatedTitle` | `string \| undefined` | No | Title of the generated article |
| `generatedSlug` | `string \| undefined` | No | Slug of the generated article |
| `articleId` | `Id<"blogArticles"> \| undefined` | No | Reference to created article |
| `errorCode` | `string \| undefined` | No | Error classification code |
| `errorMessage` | `string \| undefined` | No | Human-readable error |
| `retryCount` | `number` | Yes | Number of retry attempts |
| `maxRetries` | `number` | Yes | Maximum retries allowed (default 3) |
| `idempotencyKey` | `string` | Yes | Deduplication key (e.g., `storeId + yyyy-mm + slot + theme`) |
| `createdAt` | `number` | Yes | Unix timestamp (ms) |
| `updatedAt` | `number` | Yes | Unix timestamp (ms) |

**Indexes:**

| Index Name | Fields | Purpose |
|------------|--------|---------|
| `by_storeId` | `["storeId"]` | List jobs for a store |
| `by_status_scheduledFor` | `["status", "scheduledFor"]` | Cron: find pending jobs due for execution |
| `by_configId` | `["configId"]` | List jobs for a config |
| `by_idempotencyKey` | `["idempotencyKey"]` | Prevent duplicate jobs |

### 3.4 `blogAutoUsage`

Monthly quota tracking per owner. One record per owner per calendar month.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ownerId` | `string` | Yes | Better Auth user ID |
| `periodKey` | `string` | Yes | Month identifier in `"YYYY-MM"` format (e.g., "2026-03") |
| `generatedCount` | `number` | Yes | Number of articles generated this month |
| `publishedCount` | `number` | Yes | Number of articles published this month |
| `imageGeneratedCount` | `number \| undefined` | No | Number of AI images generated this month. Optional for migration safety, falls back to `?? 0` |
| `updatedAt` | `number` | Yes | Unix timestamp (ms) |

**Indexes:**

| Index Name | Fields | Purpose |
|------------|--------|---------|
| `by_ownerId_periodKey` | `["ownerId", "periodKey"]` | Lookup usage for current month |

### 3.5 Blog Content Tables

The blog content tables are defined separately and used by both manual and AI-generated articles. Key tables:

**`blogArticles`** -- Single-document draft/published model. Each article has both `draftContent` and `publishedContent` in the same record.

**`blogCategories`** -- Taxonomy for articles with `storeId`, `name`, `slug`, `description`, `sortOrder`.

**`blogTags`** -- Flat tags per store with `name` and `slug`.

**`blogArticleTags`** -- Join table with `isDraft` flag for versioned tag assignment. Tags are copied from draft to published on publish.

---

## 4. Plan Tiers and Quotas

Plans are defined as `PLAN_PRESETS` in `packages/convex-functions/src/ownerEntitlements.ts`.

### Comparison Table

| Feature | Starter | Pro | Enterprise | Disabled |
|---------|---------|-----|------------|----------|
| **Monthly article quota** | 2 | 8 | 30 | 0 |
| **Monthly image quota (AI)** | 5 | 20 | 100 | 0 |
| **Max topics/themes** | 3 | Unlimited | Unlimited | -- |
| **Auto-publish** | No | Yes | Yes | No |
| **Multi-language (auto-translate)** | No | No | Yes | No |
| **Max schedule days (weekly)** | min(quota, 7) = 2 | min(quota, 7) = 7 | min(quota, 7) = 7 | -- |
| **Max schedule days (monthly)** | min(quota, 28) = 2 | min(quota, 28) = 8 | min(quota, 28) = 28 | -- |

### Pricing

| Plan | Monthly | Annual (per month) | Annual Savings |
|------|---------|-------------------|----------------|
| Starter | 19 EUR | 15 EUR | 2 months free |
| Pro | 49 EUR | 39 EUR | 2 months free |
| Enterprise | 99 EUR | 79 EUR | 2 months free |

### PLAN_PRESETS Definition

```typescript
export const PLAN_PRESETS = {
  starter: {
    enabled: true,
    plan: "starter",
    monthlyQuota: 2,
    maxTopics: 3,
    allowMultiLanguage: false,
    allowAutoPublish: false,
    monthlyImageQuota: 5,
  },
  pro: {
    enabled: true,
    plan: "pro",
    monthlyQuota: 8,
    maxTopics: undefined, // unlimited
    allowMultiLanguage: false,
    allowAutoPublish: true,
    monthlyImageQuota: 20,
  },
  enterprise: {
    enabled: true,
    plan: "enterprise",
    monthlyQuota: 30,
    maxTopics: undefined, // unlimited
    allowMultiLanguage: true,
    allowAutoPublish: true,
    monthlyImageQuota: 100,
  },
  disabled: {
    enabled: false,
    plan: undefined,
    monthlyQuota: 0,
    maxTopics: undefined,
    allowMultiLanguage: false,
    allowAutoPublish: false,
    monthlyImageQuota: 0,
  },
}
```

---

## 5. Stripe Subscription Flow

### 5.1 Checkout Flow

```
User clicks "Subscribe"
       |
       v
PricingView.handleSubscribe(plan, billing)
       |
       v
useAction(api.bidSubscription.createCheckoutSession)
       |  args: { plan: "starter"|"pro"|"enterprise", billing: "monthly"|"annual" }
       v
+-- createCheckoutSession action ("use node") --+
|  1. ctx.auth.getUserIdentity() -> ownerId      |
|  2. resolvePriceIdFromPlan(plan, env, billing)  |
|     -> reads STRIPE_BID_PRICE_{PLAN}[_ANNUAL]   |
|  3. ctx.runQuery(getByOwnerId) -> entitlements   |
|  4. Guard: reject if active subscription exists  |
|  5. Get or create Stripe customer                |
|     -> stripe.customers.create({ metadata: { ownerId } }) |
|     -> ctx.runMutation(attachStripeCustomerId)   |
|  6. stripe.checkout.sessions.create({            |
|       mode: "subscription",                      |
|       customer: customerId,                      |
|       line_items: [{ price: priceId, qty: 1 }],  |
|       metadata: { ownerId },                     |
|       subscription_data: { metadata: { ownerId } }, |
|       success_url: .../subscription?status=success, |
|       cancel_url: .../subscription               |
|     })                                           |
|  7. Return { url: session.url }                  |
+------------------------------------------------+
       |
       v
window.location.href = result.url  (redirect to Stripe)
       |
       v
Stripe Checkout -> Payment -> Redirect back to success_url
```

### 5.2 Price ID Resolution

The `resolvePriceIdFromPlan` function maps plan names to Stripe Price IDs using environment variables:

| Plan + Billing | Environment Variable |
|---|---|
| starter + monthly | `STRIPE_BID_PRICE_STARTER` |
| starter + annual | `STRIPE_BID_PRICE_STARTER_ANNUAL` |
| pro + monthly | `STRIPE_BID_PRICE_PRO` |
| pro + annual | `STRIPE_BID_PRICE_PRO_ANNUAL` |
| enterprise + monthly | `STRIPE_BID_PRICE_ENTERPRISE` |
| enterprise + annual | `STRIPE_BID_PRICE_ENTERPRISE_ANNUAL` |

The reverse mapping (`buildPriceMap`) creates a `Record<priceId, plan>` for webhook processing.

### 5.3 Webhook Processing

```
Stripe POST /webhooks/stripe-bid
       |
       v
+-- bidStripeWebhook.handleWebhook (httpAction) --+
|  1. Read raw body + Stripe-Signature header      |
|  2. Validate signature exists                    |
|  3. ctx.runAction(processWebhookEvent, { body, sig }) |
+-------------------------------------------------+
       |
       v
+-- processWebhookEvent (internalAction "use node") --+
|  1. stripe.webhooks.constructEvent(body, sig, secret) |
|  2. buildPriceMap(process.env) -> priceMap            |
|  3. Switch on event.type:                             |
|                                                       |
|  checkout.session.completed:                          |
|    -> Retrieve subscription to get priceId            |
|    -> resolvePlanFromPriceId(priceId, priceMap)        |
|    -> upsertFromStripe({ ownerId, customerId,         |
|         subscriptionId, status: "active", plan })     |
|                                                       |
|  customer.subscription.updated:                       |
|    -> Extract priceId from subscription items         |
|    -> resolvePlanFromPriceId -> plan                  |
|    -> upsertFromStripe({ ..., status, plan })         |
|                                                       |
|  customer.subscription.deleted:                       |
|    -> upsertFromStripe({ ..., status: "canceled",     |
|         plan: undefined })                            |
|                                                       |
|  invoice.payment_failed:                              |
|    -> Log warning (status update via subscription.updated) |
+------------------------------------------------------+
```

### 5.4 Entitlement Upsert Logic

The `upsertFromStripe` mutation uses a cascading lookup strategy:

1. Look up by `stripeSubscriptionId` (most specific)
2. Fall back to `stripeCustomerId`
3. Fall back to `ownerId` (first checkout only)

When a plan is resolved, the corresponding `PLAN_PRESETS` object replaces the entire `autoBlog` field. When a subscription is deleted, `PLAN_PRESETS.disabled` is applied.

### 5.5 Customer Portal

For existing subscribers, the `createPortalSession` action creates a Stripe Billing Portal session, redirecting the user to manage/upgrade/cancel their subscription.

---

## 6. Article Generation Pipeline

### Overview

When a user clicks "Generate with AI" in the `GenerateArticleDialog`, the following 10-step pipeline executes:

### Step-by-Step Flow

```
GenerateArticleDialog.handleSubmit()
       |
       v
useAction(api.blogAutoGenerate.generateArticle)
  args: { storeId, topic, tone, locale, categoryId, autoTranslate? }
       |
       v
+============== generateArticle action ("use node") ==============+
|                                                                   |
|  STEP 1: Authentication                                           |
|    ctx.auth.getUserIdentity() -> identity                         |
|    if (!identity) throw "Not authenticated"                      |
|    ownerId = identity.subject                                     |
|                                                                   |
|  STEP 1b: Input Validation                                        |
|    if (topic.length > 500) throw "Topic trop long"               |
|    if (locale.length > 10) throw "Locale invalide"               |
|                                                                   |
|  STEP 2: Access & Quota Check                                     |
|    ctx.runQuery(_checkAccess, { ownerId })                       |
|    -> checkAutoBlogAccess(ctx, ownerId)                           |
|    Returns { allowed, reason, entitlements, usage, remainingQuota }|
|    if (!allowed) throw access.reason                              |
|                                                                   |
|  STEP 3: Generation Context                                       |
|    ctx.runQuery(_getGenerationContext, { storeId, categoryId })   |
|    -> { storeName, categoryName }                                 |
|                                                                   |
|  STEP 4: OpenAI Text Generation                                   |
|    Model: gpt-4o-mini                                             |
|    Temperature: 0.7                                               |
|    Max tokens: 8192                                               |
|    System prompt: SEO expert + restaurant blog writer             |
|    User message: "Ecris un article sur : {topic}"                |
|    Response format: JSON                                          |
|                                                                   |
|  STEP 5: Parse JSON Response                                      |
|    Strip ```json fences                                           |
|    JSON.parse -> { title, excerpt, content, metaTitle,            |
|      metaDescription, tags, coverImageKeyword,                    |
|      coverImageAlt, imageKeywords[3], imageCaptions[3] }          |
|    Validate: title and content are required                       |
|                                                                   |
|  STEP 6: Cover Image                                              |
|    a. fetchFromUnsplash(coverImageKeyword)                        |
|       If found: downloadAndUploadImage() -> cmsMedia record       |
|    b. If no Unsplash result:                                      |
|       generateWithOpenAI(coverImageKeyword, coverImageAlt)        |
|       -> GPT Image 1, 1024x1024, medium quality                  |
|       -> S3 upload + cmsMedia record                              |
|    Result: coverImageId (Id<"cmsMedia">)                          |
|                                                                   |
|  STEP 7: Content Images (3 images)                                |
|    For each keyword in imageKeywords[]:                            |
|      a. fetchFromUnsplash(keyword) -> direct URL                  |
|      b. If no result: generateWithOpenAI(keyword, caption)        |
|         -> S3 upload + cmsMedia record                            |
|    Result: ImageResult[] with { url, alt, source, mediaId?,       |
|      photographerName?, photographerUrl? }                        |
|                                                                   |
|  STEP 8: Image Injection                                          |
|    Replace [IMAGE_1], [IMAGE_2], [IMAGE_3] placeholders           |
|    Unsplash images: <img> + attribution paragraph                 |
|    OpenAI images: <img> only                                      |
|    Remaining placeholders: removed                                |
|                                                                   |
|  STEP 9: HTML Sanitization                                        |
|    sanitize-html with strict allowlist (see section 15)           |
|                                                                   |
|  STEP 10: Save Article                                            |
|    ctx.runMutation(_saveGeneratedArticle, { ... all fields })     |
|    -> createArticleCore() (empty draft)                           |
|    -> Patch draftContent with generated HTML + metadata           |
|    -> Create/find tags by slug, attach as draft tags              |
|    -> incrementUsageCore() (increment generatedCount)             |
|    -> If autoTranslate: scheduleBlogTranslation()                 |
|    Returns: articleId                                             |
|                                                                   |
+===================================================================+
       |
       v
router.push(`/content/blog/${result.articleId}`)
```

### GPT System Prompt (Complete)

The system prompt sent to GPT-4o-mini is extensive and enforces the following:

**General Rules:**
- Write in the specified locale
- Use the specified tone (formel et professionnel / decontracte et accessible / storytelling et immersif)
- Reference the restaurant name and article category

**Mandatory HTML Format:**
- All content must be wrapped in valid HTML tags
- Paragraphs in `<p>`, sections in `<h2>`, subsections in `<h3>`
- Lists in `<ul>/<ol>` with `<li>`
- Blockquotes in `<blockquote><p>`
- Bold with `<strong>`, italic with `<em>`
- No `<h1>` (title is separate from content)
- No `<br>` between paragraphs
- Image placeholders `[IMAGE_1]`, `[IMAGE_2]`, `[IMAGE_3]` on their own lines between sections

**Strict SEO Rules (Maximum Priority):**
- 1200-1800 words minimum
- 4-6 sections with `<h2>` titles, `<h3>` for subsections
- Main keyword in first 100 words, in at least 2 `<h2>` titles, and in conclusion
- Keyword density: 1-2% naturally (no keyword stuffing)
- 3-5 LSI (Latent Semantic Indexing) secondary keywords
- At least 1 list of 5-8 items (for Featured Snippets / Position Zero)
- Question formats ("What is...", "How to...", "Why...") in `<h2>` when relevant
- Short answer paragraph (40-60 words) after each `<h2>`
- Short paragraphs (3-4 sentences max) for mobile readability
- 2-3 `<strong>` highlights per section
- Alternating paragraphs, lists, and quotes for rhythm
- Concrete data, statistics, and facts when possible
- Rhetorical questions for reader engagement
- 2-3 internal linking suggestions ("Discover also...", "Learn more about...")

**JSON Response Format:**

```json
{
  "title": "...",
  "excerpt": "...(max 160 chars)...",
  "content": "<p>...</p>[IMAGE_1]<h2>...</h2>...",
  "metaTitle": "...(max 60 chars, SEO-optimized)...",
  "metaDescription": "...(max 160 chars, with keywords)...",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "coverImageKeyword": "keyword in english for cover image",
  "coverImageAlt": "alt description in article language",
  "imageKeywords": ["keyword1 in english", "keyword2", "keyword3"],
  "imageCaptions": ["caption 1 in article language", "caption 2", "caption 3"]
}
```

**Metadata SEO Rules:**
- `title`: Include main keyword, 50-70 characters, click-worthy
- `metaTitle`: Different from title if possible, max 60 chars, keyword at beginning
- `metaDescription`: Max 160 chars, main keyword, clear benefit, action verb
- `excerpt`: Engaging summary with main keyword
- `tags`: 4-6 relevant tags in the article's locale

**Image Keyword Rules:**
- `coverImageKeyword`: 1 keyword in English, visually attractive
- `coverImageAlt`: Alt text in article language, max 125 chars, includes main keyword
- `imageKeywords`: 3 keywords in English, VERY SPECIFIC to the exact article topic
- Must include cuisine, culture, country, or specific dish
- Bad examples: "african food", "traditional dish", "restaurant interior"
- Good examples: "senegalese thieboudienne rice fish dish", "moroccan tagine lamb couscous"

### Image Injection Details

The `injectImages` function replaces `[IMAGE_N]` placeholders in the HTML content:

- **Unsplash images**: `<img src="..." alt="..." />` followed by attribution: `<p><em>Photo : <a href="...?utm_source=beindigital&utm_medium=referral">Photographer Name</a> -- <a href="https://unsplash.com/?utm_source=beindigital&utm_medium=referral">Unsplash</a></em></p>`
- **OpenAI images**: `<img src="..." alt="..." />` (no attribution needed)
- **Null images**: Placeholder removed entirely
- **Remaining `[IMAGE_N]` placeholders**: Cleaned up via regex after injection

### HTML Sanitization

After image injection, all content passes through `sanitize-html` with this configuration:

**Allowed Tags:**
`p`, `h2`, `h3`, `h4`, `strong`, `em`, `u`, `s`, `ul`, `ol`, `li`, `a`, `img`, `blockquote`, `hr`, `br`

**Allowed Attributes:**
- `a`: `href`, `target`, `rel`
- `img`: `src`, `alt`, `class`

Everything else (scripts, iframes, event handlers, data attributes, etc.) is stripped.

---

## 7. Image Generation Pipeline

### Standalone Image Generation

The `GenerateImageDialog` component allows users to generate images on-demand for use in the blog editor. This is a separate flow from the article generation pipeline.

```
GenerateImageDialog.handleGenerate()
       |
       v
useAction(api.blogImageGenerate.generateImage)
  args: { storeId, prompt }
       |
       v
+============== generateImage action ("use node") ==============+
|                                                                 |
|  1. Auth: ctx.auth.getUserIdentity()                           |
|  2. Input validation: prompt.length <= 1000                    |
|  3. Quota check: ctx.runQuery(_checkImageAccess, { ownerId })  |
|     -> checkImageGenerationAccess(ctx, ownerId)                |
|     Checks: entitlements exist, subscription active,           |
|       monthlyImageQuota > 0, imageGeneratedCount < quota       |
|  4. OpenAI API call:                                           |
|     Model: gpt-image-1-mini                                    |
|     Size: 1024x1024                                            |
|     Quality: medium                                            |
|     Output format: png                                         |
|     Response: b64_json                                         |
|  5. Decode base64 -> Buffer                                    |
|  6. Create cmsMedia record via _createBlogImage                |
|     (status: "processing", folder: "blog-auto")                |
|  7. Upload to S3: key = `cms/{mediaId}/source.png`             |
|  8. Schedule processImage (sharp: thumb + card variants)       |
|  9. Increment image usage AFTER S3 upload succeeds             |
|     (prevents consuming quota on failures)                     |
| 10. Return { url: sourceUrl, mediaId, alt: prompt }            |
|                                                                 |
+================================================================+
```

### Key Difference: Article vs Standalone Image

| Aspect | Article Generation Images | Standalone Image |
|--------|--------------------------|------------------|
| Model | `gpt-image-1` (article) / Unsplash (priority) | `gpt-image-1-mini` |
| Quota tracked | Part of article quota (not tracked separately) | Separate `imageGeneratedCount` |
| Usage increment timing | After article save | After S3 upload |
| Prompt | Auto-generated from article context | User-provided |
| Result | Injected into article HTML | Returned to editor for manual insertion |

---

## 8. Unsplash Integration

### 8.1 Search API

**File:** `apps/reference/convex/unsplashSearch.ts`

Two public actions for client-side Unsplash integration:

**`searchPhotos`** (action, "use node")
- Args: `{ query: string, page?: number }`
- Calls `https://api.unsplash.com/search/photos` with:
  - `per_page: 12`
  - `orientation: "landscape"`
  - `order_by: "relevant"`
- Returns: `{ total, totalPages, results: UnsplashPhoto[] }`
- Each result includes: `id`, `url` (regular), `thumbUrl` (small), `alt`, `photographerName`, `photographerUrl`, `downloadLocation`

**`triggerDownload`** (action, "use node")
- Args: `{ downloadLocation: string }`
- **SSRF Protection**: Validates that the URL hostname is exactly `api.unsplash.com`
- Calls the Unsplash download tracking endpoint (required by Unsplash API guidelines)

### 8.2 Internal Unsplash Search (Article Generation)

The `fetchFromUnsplash` function in `blogAutoGenerate.ts` is used internally during article generation:

1. Search with full keyword (landscape orientation, relevant order, 10 results)
2. If no results: retry with simplified keyword (first 2-3 words)
3. If still no results: return `null` (triggers GPT Image fallback)
4. Random selection from results for variety
5. Trigger download tracking (fire-and-forget)
6. Return `{ url, alt, source: "unsplash", photographerName, photographerUrl }`

### 8.3 Attribution Compliance

Unsplash requires proper attribution and download tracking:

- **Download tracking**: Called via `photo.links.download_location?client_id=...` on every use
- **Attribution in articles**: `Photo : <a href="{photographerUrl}?utm_source=beindigital&utm_medium=referral">{photographerName}</a> -- <a href="https://unsplash.com/?utm_source=beindigital&utm_medium=referral">Unsplash</a>`
- **Attribution in editor**: Inserted as a paragraph with italic text and proper UTM parameters
- **Attribution in picker**: Footer text "Photos fournies par Unsplash" with UTM link

### 8.4 Cover Image Download

For cover images, Unsplash photos are downloaded and re-uploaded to S3 (not hotlinked):

1. `fetch(imageUrl)` -- download the image
2. Create `cmsMedia` record with status "processing"
3. Upload to S3 at `cms/{mediaId}/source.{ext}`
4. Schedule `processImage` for thumbnail/card variant generation via sharp

---

## 9. Blog Editor

### 9.1 Tiptap Configuration

**File:** `apps/reference/components/admin/blog/BlogRichTextEditor.tsx`

The editor uses Tiptap with the following extensions:

| Extension | Configuration |
|-----------|---------------|
| `StarterKit` | Headings limited to levels 2, 3, 4. Code block and inline code disabled. |
| `Link` | `openOnClick: false`, custom CSS class `underline text-primary` |
| `Placeholder` | Configurable placeholder text (default: "Redigez votre article...") |
| `Image` | CSS class `rounded-md max-w-full` |
| `CharacterCount` | Optional, enabled when `maxLength` prop is provided |

### 9.2 Toolbar

The toolbar provides these actions:

| Group | Actions |
|-------|---------|
| Text formatting | Bold, Italic, Link |
| Headings | H2, H3, H4 |
| Lists | Bullet list, Ordered list |
| Blocks | Blockquote, Horizontal rule |
| Media | Insert image (CmsMediaPicker), Generate AI image (GenerateImageDialog) |

### 9.3 BubbleMenu

When an image is selected in the editor, a floating `BubbleMenu` appears with these options:

| Action | Icon | Behavior |
|--------|------|----------|
| IA | Sparkles | Opens `GenerateImageDialog` for AI image replacement |
| Unsplash | Search | Opens `UnsplashImagePicker` for stock photo replacement |
| Remplacer | RefreshCw | Opens `CmsMediaPicker` to replace with uploaded media |
| Delete | Trash2 | Deletes the selected image from the editor |

When an Unsplash image is selected via the BubbleMenu, the editor inserts the image and appends an attribution paragraph with proper UTM links.

### 9.4 Autosave Mechanism

**File:** `apps/reference/components/admin/blog/BlogArticleEditor.tsx`

The editor implements a debounced autosave system:

- **Debounce delay**: 1500ms (`DEBOUNCE_MS`)
- Any field change (title, slug, excerpt, content, category, tags, media) triggers `scheduleAutosave()`
- The previous debounce is cancelled and a new one starts
- On save: calls `api.blog.saveDraft` mutation with all current draft data
- **Save status indicator**: Shows "Sauvegarde..." (saving), "Sauvegarde" (saved, 2s), or "Erreur" (error)
- **Flush before critical actions**: Before publish, schedule, or archive, `flushPendingSave()`:
  1. Cancels pending debounce
  2. Waits for in-flight save
  3. If dirty, executes immediate save
- **Slug auto-generation**: Auto-generates slug from title via `slugify()` unless manually edited
- **Snapshot comparison**: Uses JSON.stringify to detect dirty state vs last saved state

### 9.5 Editor Tabs

The `BlogArticleEditor` organizes content into 5 tabs:

| Tab | Contents |
|-----|----------|
| Contenu | Title, Slug, Excerpt (with char count /300), Rich text editor |
| Media | Cover image picker/preview, Cover image alt text, OG image picker/preview |
| SEO | Meta title, Meta description (with char count /160) |
| Categories & Tags | Category selector, Tag picker (toggle existing + create new) |
| Publication | Current status, Publish now, Schedule (datetime-local picker), Unschedule, Archive/Unarchive, Delete (danger zone) |

---

## 10. Auto Blog Configuration

### 10.1 Configuration Form

**File:** `apps/reference/components/admin/blog/BlogAutoConfigForm.tsx`

The form uses React Hook Form + Zod validation with the following sections:

1. **Activation**: Toggle switch to enable/disable auto-blog for the store
2. **Sujets (Topics)**: Tag-like input to add/remove themes. Limited by `maxTopics` per plan.
3. **Planification (Scheduling)**:
   - Frequency: Weekly or Monthly
   - Weekly: Multi-select day buttons (Mon-Sun), limited by `min(monthlyQuota, 7)`
   - Monthly: 28-day grid (1-28), limited by `min(monthlyQuota, 28)`
   - Preferred hour (0-23 selector)
   - Timezone (auto-detected, read-only)
4. **Style & Langue**:
   - Tone: Formel / Decontracte / Storytelling
   - Primary locale: Selector from store's active languages
   - Auto-translate toggle (disabled unless `allowMultiLanguage` is true)
5. **Publication**:
   - Approval mode: Draft review (default) / Auto-publish (disabled unless `allowAutoPublish`)
   - Default category selector

### 10.2 Plan Downgrade Handling

When a user downgrades their plan, the form automatically coerces values:

- Topics exceeding `maxTopics` are truncated
- Auto-publish is reverted to draft_review if not allowed
- Auto-translate is disabled if not allowed
- Schedule days are truncated to the new maximum
- A warning banner is displayed: "Certains reglages ont ete ajustes"

### 10.3 Config Page Orchestrator

**File:** `apps/reference/components/admin/blog/BlogAutoConfigPage.tsx`

The page displays one of three states:

1. **Loading**: Skeleton cards while `accessStatus` and `config` load
2. **Locked**: Lock icon with reason message and upgrade link (for "no subscription", "inactive", or "no plan")
3. **Form**: Quota badge + `BlogAutoConfigForm` (for authorized users)

### 10.4 Plan Validation on Save

When saving config, the `blogAutoConfig.upsert` mutation:

1. Checks `checkAutoBlogAccess()` for subscription validity
2. Calls `validateConfigAgainstPlan()` which enforces:
   - Theme count <= `maxTopics` (if defined)
   - Auto-publish only if `allowAutoPublish`
   - Auto-translate only if `allowMultiLanguage`
   - Weekly days: must be non-empty, each in [0..6], unique, count <= min(quota, 7)
   - Monthly days: must be non-empty, each in [1..28], unique, count <= min(quota, 28)
   - Exclusivity: weekly and monthly days cannot both be provided
3. Delegates to package-layer `blogAutoConfig.upsert` handler

---

## 11. Blog CRUD Operations

### 11.1 Public Queries (Storefront, No Auth)

| Function | File | Args | Returns |
|----------|------|------|---------|
| `listPublishedArticles` | `blog.ts` | `storeId, limit?` | Published articles sorted by `publishedAt` desc, with resolved cover image and category |
| `listByCategory` | `blog.ts` | `storeId, categorySlug, limit?` | Published articles in a category |
| `listByTag` | `blog.ts` | `storeId, tagSlug, limit?` | Published articles with a tag (via join table, `isDraft=false`) |
| `getArticleBySlug` | `blog.ts` | `storeId, slug` | Full article with published content, cover image, OG image, category, tags |
| `listCategories` | `blog.ts` | `storeId` | All categories sorted by `sortOrder` |
| `listTags` | `blog.ts` | `storeId` | All tags sorted alphabetically |

### 11.2 Admin Queries (Auth Required)

| Function | File | Args | Returns |
|----------|------|------|---------|
| `listAdminArticles` | `blog.ts` | `storeId, status?` | All articles with optional status filter, sorted by `updatedAt` desc |
| `getAdminArticle` | `blog.ts` | `articleId` | Full article with draft + published content, media, tags, category |

### 11.3 Article Mutations (Auth Required)

| Function | Args | Description |
|----------|------|-------------|
| `createArticle` | `storeId, title, categoryId` | Create empty draft with auto-generated unique slug |
| `saveDraft` | `articleId, draftContent, categoryId, tagIds?` | Save draft content, track media usage deltas, recalculate `hasUnpublishedChanges`, trigger auto-translation |
| `publishArticle` | `articleId` | Copy draft to published, validate completeness (title, slug, excerpt, cover, content), sync tags, copy translations, update media usage |
| `scheduleArticle` | `articleId, publishAt` | Schedule future publication via `ctx.scheduler.runAt()`, validate draft completeness |
| `unscheduleArticle` | `articleId` | Cancel scheduled job, revert to draft |
| `archiveArticle` | `articleId` | Set status to "archived", cancel scheduled jobs |
| `unarchiveArticle` | `articleId` | Restore to "published" (if published content exists) or "draft" |
| `deleteArticle` | `articleId` | Delete article + tags + translations + cancel jobs, decrement media usage |

### 11.4 Category Mutations

| Function | Args | Description |
|----------|------|-------------|
| `createCategory` | `storeId, name, description?, imageId?` | Create with auto-slug, sortOrder = max + 1 |
| `updateCategory` | `categoryId, name?, description?, imageId?, sortOrder?` | Update with slug uniqueness check |
| `deleteCategory` | `categoryId` | Delete if no articles reference it |

### 11.5 Tag Mutations

| Function | Args | Description |
|----------|------|-------------|
| `createTag` | `storeId, name` | Create with auto-slug, uniqueness check |
| `deleteTag` | `tagId` | Delete tag + cleanup join table |
| `updateArticleTags` | `articleId, tagIds` | Replace all draft tags with new set |

### 11.6 Draft/Published Model

The blog uses a single-document model where each `blogArticles` record contains both:

- `draftContent`: Always present, editable
- `publishedContent`: Only present after first publish, immutable until next publish

On publish, draft content is copied to published content. The `hasUnpublishedChanges` flag tracks whether they differ (compared field by field: title, slug, excerpt, content, coverImageId, coverImageAlt, ogImageId, metaTitle, metaDescription).

Tags use a similar model via the `blogArticleTags` join table with an `isDraft` boolean. On publish, draft tags are duplicated as published tags.

---

## 12. Guard System

### 12.1 `checkAutoBlogAccess(ctx, ownerId)`

**File:** `packages/convex-functions/src/blogAutoGuards.ts`

Returns `AutoBlogAccessResult`:

```typescript
interface AutoBlogAccessResult {
  allowed: boolean
  reason?: string
  entitlements: any | null
  usage: any | null
  remainingQuota: number
}
```

**Checks performed (in order):**

1. **Entitlements exist**: Query `ownerEntitlements` by `ownerId`. If not found or `autoBlog.enabled === false`, return `{ allowed: false, reason: "Aucun abonnement Auto Blog actif" }`
2. **Subscription status**: If `subscriptionStatus` exists and is not `"active"` or `"trialing"`, return `{ allowed: false, reason: "Abonnement inactif" }`. Manual entitlements (no `subscriptionStatus`) skip this check.
3. **Plan exists**: If `autoBlog.plan` is undefined, return `{ allowed: false, reason: "Aucun plan Auto Blog actif" }`
4. **Monthly quota**: Get `blogAutoUsage` for current period key (`YYYY-MM`). Calculate `remainingQuota = monthlyQuota - generatedCount`. If `<= 0`, return `{ allowed: false, reason: "Quota mensuel atteint" }`
5. **All checks pass**: Return `{ allowed: true, remainingQuota, entitlements, usage }`

### 12.2 `checkImageGenerationAccess(ctx, ownerId)`

Returns `ImageGenerationAccessResult`:

```typescript
interface ImageGenerationAccessResult {
  allowed: boolean
  reason?: string
  remainingImageQuota: number
}
```

**Checks performed (in order):**

1. **Entitlements exist**: Same as above
2. **Subscription status**: Same as above
3. **Plan exists**: Same as above
4. **Image quota defined**: If `monthlyImageQuota <= 0`, return `{ allowed: false, reason: "Generation d'images non disponible avec votre plan" }`
5. **Image quota remaining**: Calculate `remainingImageQuota = monthlyImageQuota - (imageGeneratedCount ?? 0)`. If `<= 0`, return `{ allowed: false, reason: "Quota mensuel d'images atteint" }`
6. **All checks pass**: Return `{ allowed: true, remainingImageQuota }`

### 12.3 `validateConfigAgainstPlan(entitlements, config)`

Throws descriptive French error messages if validation fails.

**Checks performed:**

| Check | Condition | Error Message |
|-------|-----------|---------------|
| Feature active | `!ab.enabled` | "Aucun abonnement Auto Blog actif" |
| Max topics | `themes.length > maxTopics` (when maxTopics defined) | "Votre plan {plan} est limite a {maxTopics} thematique(s)..." |
| Auto-publish | `approvalMode === "auto_publish" && !allowAutoPublish` | "La publication automatique n'est pas disponible..." |
| Multi-language | `autoTranslate && !allowMultiLanguage` | "La traduction automatique n'est pas disponible..." |
| Weekly: exclusivity | `frequency === "weekly" && preferredMonthDays.length > 0` | "En mode hebdomadaire, les jours du mois ne doivent pas etre renseignes." |
| Weekly: non-empty | `preferredWeekdays.length === 0` | "Veuillez selectionner au moins un jour de la semaine." |
| Weekly: bounds | Any day `< 0` or `> 6` or not integer | "Jours de la semaine invalides (attendu : 0-6)." |
| Weekly: unique | Duplicate days | "Les jours de la semaine doivent etre uniques." |
| Weekly: max count | `count > min(quota, 7)` | "Votre plan {plan} permet de choisir au maximum {max} jour(s) par semaine." |
| Monthly: exclusivity | `frequency === "monthly" && preferredWeekdays.length > 0` | "En mode mensuel, les jours de la semaine ne doivent pas etre renseignes." |
| Monthly: non-empty | `preferredMonthDays.length === 0` | "Veuillez selectionner au moins un jour du mois." |
| Monthly: bounds | Any day `< 1` or `> 28` or not integer | "Jours du mois invalides (attendu : 1-28)." |
| Monthly: unique | Duplicate days | "Les jours du mois doivent etre uniques." |
| Monthly: max count | `count > min(quota, 28)` | "Votre plan {plan} permet de choisir au maximum {max} jour(s) par mois." |

### 12.4 `normalizeScheduleDays(config)`

Handles backward compatibility between old single-number fields and new array fields:

```typescript
// Old format: preferredWeekday: 3 -> New format: preferredWeekdays: [3]
// Old format: preferredMonthDay: 15 -> New format: preferredMonthDays: [15]
```

---

## 13. Usage Tracking

### 13.1 Period Key Format

The period key is computed by `getCurrentPeriodKey()` in `blogAutoUsage.ts`:

```typescript
function getCurrentPeriodKey(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}` // e.g., "2026-03"
}
```

Usage resets automatically each month because a new `blogAutoUsage` record is created.

### 13.2 Article Usage Increment

`incrementUsageCore(ctx, ownerId)` in `blogAutoGenerate.ts`:

1. Get current period key
2. Query `blogAutoUsage` by `(ownerId, periodKey)`
3. If record exists: `patch({ generatedCount: existing.generatedCount + 1 })`
4. If no record: `insert({ generatedCount: 1, publishedCount: 0 })`

Called at the END of `saveGeneratedArticleCore()`, after the article is successfully saved.

### 13.3 Image Usage Increment

`incrementImageUsageCore(ctx, ownerId)` in `blogAutoGenerate.ts`:

1. Same lookup as above
2. If exists: `patch({ imageGeneratedCount: (existing.imageGeneratedCount ?? 0) + 1 })`
3. If no record: `insert({ generatedCount: 0, publishedCount: 0, imageGeneratedCount: 1 })`

Called in `blogImageGenerate.ts` AFTER successful S3 upload (step 8 of the standalone image pipeline).

### 13.4 Quota Calculation

```
remainingArticleQuota = entitlements.autoBlog.monthlyQuota - usage.generatedCount
remainingImageQuota = entitlements.autoBlog.monthlyImageQuota - (usage.imageGeneratedCount ?? 0)
```

---

## 14. SEO Optimization Rules

The GPT system prompt enforces these rules (extracted from the actual prompt):

### Structure and Length
- 1200-1800 words minimum
- 4-6 sections with `<h2>` titles and `<h3>` subtitles
- Strict hierarchy: `<h2>` for main sections, `<h3>` for sub-points
- Main keyword in the first 100 words
- Conclusion with main keyword recall and call-to-action

### Keywords and Semantics
- 1 main keyword + 3-5 LSI secondary keywords
- Main keyword in: title, first paragraph, at least 2 `<h2>` titles, conclusion
- Keyword density: 1-2% naturally
- Synonyms and semantic variations throughout
- LSI terms related to restaurant/cuisine themes

### Featured Snippets (Position Zero)
- At least 1 list (`<ul>` or `<ol>`) of 5-8 items
- At least 1 section starting with a definition or direct answer
- Question formats in `<h2>` titles when relevant
- Short answer paragraph (40-60 words) after each `<h2>`

### Engagement and Readability
- Short paragraphs (3-4 sentences max) for mobile
- `<strong>` for key information (2-3 per section)
- Alternating paragraphs, lists, and quotes
- Concrete data, statistics, facts
- Rhetorical questions for engagement

### Internal Linking Suggestions
- 2-3 natural suggestions for related topics
- Phrased as "Decouvrez aussi nos..." or "Pour en savoir plus sur..."

### Metadata
- `title`: 50-70 characters, main keyword, click-worthy
- `metaTitle`: Max 60 characters, keyword at beginning, different from title
- `metaDescription`: Max 160 characters, main keyword, clear benefit, action verb
- `excerpt`: Engaging summary with main keyword
- `tags`: 4-6 relevant tags in the article's locale

---

## 15. Security Measures

### 15.1 Authentication

- All public actions/mutations/queries verify `ctx.auth.getUserIdentity()` and throw `"Not authenticated"` if null.
- Internal functions (`internalQuery`, `internalMutation`, `internalAction`) bypass auth but are only callable from other Convex functions (never from client).
- The `ownerId` is always derived from `identity.subject`, never from client input.

### 15.2 HTML Sanitization

**Library:** `sanitize-html`

Applied to all GPT-generated content before saving:

```typescript
sanitizeHtml(html, {
  allowedTags: [
    "p", "h2", "h3", "h4",
    "strong", "em", "u", "s",
    "ul", "ol", "li",
    "a", "img",
    "blockquote", "hr", "br",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "class"],
  },
})
```

This strips all `<script>`, `<iframe>`, `<style>`, event handlers (`onclick`, `onerror`, etc.), `data-*` attributes, and any tags/attributes not in the allowlist.

### 15.3 SVG Sanitizer

**File:** `packages/cms/src/sanitize/svgSanitizer.ts`

For SVG uploads (separate from blog but part of the CMS media system):

- **Max size**: 1MB
- **Removed elements**: `script`, `iframe`, `object`, `embed`, `applet`, `form`, `input`, `textarea`, `button`, `select`, `foreignObject`, `math`, `annotation-xml`, `base`
- **Removed attributes**: All event handlers matching `on\w+=...` pattern
- **Removed URIs**: `javascript:` URIs in `href` and `xlink:href`

### 15.4 SSRF Protection

In `unsplashSearch.triggerDownload`:

```typescript
const url = new URL(args.downloadLocation)
if (url.hostname !== "api.unsplash.com") {
  throw new Error("Invalid download location")
}
```

This prevents the server from being used as a proxy to make requests to arbitrary URLs.

### 15.5 Input Validation

| Location | Validation |
|----------|------------|
| `generateArticle` action | `topic.length > 500` throws error, `locale.length > 10` throws error |
| `generateImage` action | `prompt.length > 1000` throws error |
| All Convex args | Runtime validation via `v.string()`, `v.id()`, `v.number()`, `v.union()`, etc. |
| `validateConfigAgainstPlan` | Bounds checking on all schedule day values |
| Blog editor | `excerpt` max 300 chars, `metaDescription` max 160 chars (UI-enforced) |
| Slug generation | `ensureUniqueSlug` prevents duplicate slugs per store |

### 15.6 Attribute Escaping

The `escapeAttr` function in `blogAutoGenerate.ts` escapes user-provided strings before inserting into HTML attributes:

```typescript
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
```

### 15.7 S3 Key Construction

S3 keys are always constructed from Convex document IDs, never from user input:

```
cms/{mediaId}/source.{ext}
```

This prevents path traversal attacks.

### 15.8 Stripe Webhook Security

- Signature verification via `stripe.webhooks.constructEvent(body, signature, secret)`
- Webhook secret stored in `STRIPE_BID_WEBHOOK_SECRET` env var
- Raw body read (not parsed JSON) to ensure signature verification works correctly

### 15.9 Environment Variables

All API keys and secrets are server-side only (Convex `"use node"` environment):
- `OPENAI_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `STRIPE_BID_SECRET_KEY`
- `STRIPE_BID_WEBHOOK_SECRET`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

---

## 16. API Reference

### 16.1 App Layer -- Actions ("use node")

#### `blogAutoGenerate.generateArticle`
| Property | Value |
|----------|-------|
| Type | `action` |
| Runtime | Node.js (`"use node"`) |
| Auth | `ctx.auth.getUserIdentity()` |
| Args | `storeId: Id<"stores">`, `topic: string`, `tone: "formel" \| "decontracte" \| "storytelling"`, `locale: string`, `categoryId: Id<"blogCategories">`, `autoTranslate?: boolean` |
| Returns | `{ articleId: string }` |
| Description | Generates a complete blog article with images using GPT-4o-mini, Unsplash, and GPT Image. |

#### `blogImageGenerate.generateImage`
| Property | Value |
|----------|-------|
| Type | `action` |
| Runtime | Node.js (`"use node"`) |
| Auth | `ctx.auth.getUserIdentity()` |
| Args | `storeId: Id<"stores">`, `prompt: string` |
| Returns | `{ url: string, mediaId: string, alt: string }` |
| Description | Generates a standalone image using GPT Image 1 Mini, uploads to S3. |

#### `unsplashSearch.searchPhotos`
| Property | Value |
|----------|-------|
| Type | `action` |
| Runtime | Node.js (`"use node"`) |
| Auth | `ctx.auth.getUserIdentity()` |
| Args | `query: string`, `page?: number` |
| Returns | `{ total: number, totalPages: number, results: UnsplashPhoto[] }` |
| Description | Search Unsplash for landscape photos. |

#### `unsplashSearch.triggerDownload`
| Property | Value |
|----------|-------|
| Type | `action` |
| Runtime | Node.js (`"use node"`) |
| Auth | `ctx.auth.getUserIdentity()` |
| Args | `downloadLocation: string` |
| Returns | `void` |
| Description | Trigger Unsplash download tracking. SSRF-protected (hostname must be `api.unsplash.com`). |

#### `bidSubscription.createCheckoutSession`
| Property | Value |
|----------|-------|
| Type | `action` |
| Runtime | Node.js (`"use node"`) |
| Auth | `ctx.auth.getUserIdentity()` |
| Args | `plan: "starter" \| "pro" \| "enterprise"`, `billing?: "monthly" \| "annual"` |
| Returns | `{ url: string \| null }` |
| Description | Creates a Stripe Checkout session. Guards against double subscriptions. |

#### `bidSubscription.createPortalSession`
| Property | Value |
|----------|-------|
| Type | `action` |
| Runtime | Node.js (`"use node"`) |
| Auth | `ctx.auth.getUserIdentity()` |
| Args | `{}` (none) |
| Returns | `{ url: string }` |
| Description | Creates a Stripe Billing Portal session for subscription management. |

#### `bidSubscription.processWebhookEvent`
| Property | Value |
|----------|-------|
| Type | `internalAction` |
| Runtime | Node.js (`"use node"`) |
| Auth | Internal only (Stripe signature verification) |
| Args | `body: string`, `signature: string` |
| Returns | `void` |
| Description | Processes Stripe webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. |

### 16.2 App Layer -- Queries and Mutations

#### `blogAutoConfig.getByStoreId`
| Property | Value |
|----------|-------|
| Type | `query` |
| Auth | `ctx.auth.getUserIdentity()` |
| Args | `storeId: Id<"stores">` |
| Returns | `blogAutoConfig \| null` |

#### `blogAutoConfig.getAccessStatus`
| Property | Value |
|----------|-------|
| Type | `query` |
| Auth | `ctx.auth.getUserIdentity()` |
| Args | `{}` (none) |
| Returns | `AutoBlogAccessResult` |

#### `blogAutoConfig.getImageAccessStatus`
| Property | Value |
|----------|-------|
| Type | `query` |
| Auth | `ctx.auth.getUserIdentity()` |
| Args | `{}` (none) |
| Returns | `ImageGenerationAccessResult` |

#### `blogAutoConfig.upsert`
| Property | Value |
|----------|-------|
| Type | `mutation` |
| Auth | `ctx.auth.getUserIdentity()` + `checkAutoBlogAccess` + `validateConfigAgainstPlan` |
| Args | `storeId`, `isEnabled`, `themes`, `frequency`, `preferredWeekdays?`, `preferredMonthDays?`, `preferredHour`, `timezone`, `tone`, `primaryLocale`, `autoTranslate`, `approvalMode`, `categoryId?`, `targetStoreIds?` |
| Returns | `Id<"blogAutoConfig">` |

#### `blog.listPublishedArticles`
| Type | `query` | Auth | None (public) | Args | `storeId, limit?` |

#### `blog.listByCategory`
| Type | `query` | Auth | None (public) | Args | `storeId, categorySlug, limit?` |

#### `blog.listByTag`
| Type | `query` | Auth | None (public) | Args | `storeId, tagSlug, limit?` |

#### `blog.getArticleBySlug`
| Type | `query` | Auth | None (public) | Args | `storeId, slug` |

#### `blog.listCategories`
| Type | `query` | Auth | None (public) | Args | `storeId` |

#### `blog.listTags`
| Type | `query` | Auth | None (public) | Args | `storeId` |

#### `blog.listAdminArticles`
| Type | `query` | Auth | Required | Args | `storeId, status?` |

#### `blog.getAdminArticle`
| Type | `query` | Auth | Required | Args | `articleId` |

#### `blog.createArticle`
| Type | `mutation` | Auth | Required | Args | `storeId, title, categoryId` |

#### `blog.saveDraft`
| Type | `mutation` | Auth | Required | Args | `articleId, draftContent, categoryId, tagIds?` |

#### `blog.publishArticle`
| Type | `mutation` | Auth | Required | Args | `articleId` |

#### `blog.scheduleArticle`
| Type | `mutation` | Auth | Required | Args | `articleId, publishAt` |

#### `blog.unscheduleArticle`
| Type | `mutation` | Auth | Required | Args | `articleId` |

#### `blog.archiveArticle`
| Type | `mutation` | Auth | Required | Args | `articleId` |

#### `blog.unarchiveArticle`
| Type | `mutation` | Auth | Required | Args | `articleId` |

#### `blog.deleteArticle`
| Type | `mutation` | Auth | Required | Args | `articleId` |

#### `blog.createCategory`
| Type | `mutation` | Auth | Required | Args | `storeId, name, description?, imageId?` |

#### `blog.updateCategory`
| Type | `mutation` | Auth | Required | Args | `categoryId, name?, description?, imageId?, sortOrder?` |

#### `blog.deleteCategory`
| Type | `mutation` | Auth | Required | Args | `categoryId` |

#### `blog.createTag`
| Type | `mutation` | Auth | Required | Args | `storeId, name` |

#### `blog.deleteTag`
| Type | `mutation` | Auth | Required | Args | `tagId` |

#### `blog.updateArticleTags`
| Type | `mutation` | Auth | Required | Args | `articleId, tagIds` |

### 16.3 App Layer -- Internal Functions

#### `blogAutoGenerateInternal._checkAccess`
| Type | `internalQuery` | Args | `ownerId: string` | Returns | `AutoBlogAccessResult` |

#### `blogAutoGenerateInternal._getGenerationContext`
| Type | `internalQuery` | Args | `storeId, categoryId` | Returns | `{ storeName, categoryName }` |

#### `blogAutoGenerateInternal._createBlogImage`
| Type | `internalMutation` | Args | `storeId, filename, mimeType, size, uploadedBy` | Returns | `Id<"cmsMedia">` |

#### `blogAutoGenerateInternal._saveGeneratedArticle`
| Type | `internalMutation` | Args | `storeId, ownerId, title, excerpt, content, categoryId, authorId, coverImageId?, coverImageAlt?, metaTitle?, metaDescription?, tags?, autoTranslate?` | Returns | `string` (articleId) |

#### `blogImageGenerateInternal._checkImageAccess`
| Type | `internalQuery` | Args | `ownerId: string` | Returns | `ImageGenerationAccessResult` |

#### `blogImageGenerateInternal._incrementImageUsage`
| Type | `internalMutation` | Args | `ownerId: string` | Returns | `void` |

#### `bidSubscriptionInternal.getByOwnerId`
| Type | `internalQuery` | Args | `ownerId: string` | Returns | `ownerEntitlements \| null` |

#### `bidSubscriptionInternal.attachStripeCustomerId`
| Type | `internalMutation` | Args | `ownerId, stripeCustomerId` | Returns | `Id<"ownerEntitlements">` |

#### `bidSubscriptionInternal.upsertFromStripe`
| Type | `internalMutation` | Args | `ownerId?, stripeCustomerId, stripeSubscriptionId, subscriptionStatus, plan?` | Returns | `Id<"ownerEntitlements">` |

#### `blog._publishArticleInternal`
| Type | `internalMutation` | Args | `articleId` | Description | Called by scheduler for scheduled publish |

### 16.4 HTTP Actions

#### `bidStripeWebhook.handleWebhook`
| Type | `httpAction` |
| Route | `POST /webhooks/stripe-bid` |
| Auth | Stripe Signature header |
| Description | Receives raw body + `Stripe-Signature` header, delegates to `processWebhookEvent` |

---

## 17. UI Components Reference

### 17.1 Blog Components

#### `BlogContent`
| File | `components/admin/blog/BlogContent.tsx` |
|------|-------|
| Props | None (reads `storeId` from hook) |
| Features | Article list with status tabs (All/Draft/Scheduled/Published/Archived), status filter via `listAdminArticles` query, actions: publish/archive/unarchive/delete from list, buttons: New Article, Generate with AI, Categories |
| Dependencies | `BlogArticlesTable`, `CreateArticleDialog`, `GenerateArticleDialog`, `BlogCategoryManager`, `DeleteConfirmDialog` |

#### `BlogArticleEditor`
| File | `components/admin/blog/BlogArticleEditor.tsx` |
|------|-------|
| Props | `articleId: string` |
| Features | Full article editing with 5 tabs (Content, Media, SEO, Tags, Publication), debounced autosave (1500ms), save status indicator, slug auto-generation, publish/schedule/archive/delete actions, CmsMediaPicker for cover and OG images |
| Dependencies | `BlogRichTextEditor`, `CmsMediaPicker`, `DeleteConfirmDialog` |

#### `BlogRichTextEditor`
| File | `components/admin/blog/BlogRichTextEditor.tsx` |
|------|-------|
| Props | `value: string`, `onChange: (html) => void`, `placeholder?: string`, `maxLength?: number`, `disabled?: boolean` |
| Features | Tiptap editor with toolbar (Bold, Italic, Link, H2, H3, H4, Lists, Blockquote, HR, Image, AI Image), BubbleMenu on image selection (AI, Unsplash, Replace, Delete), external value sync |
| Dependencies | `CmsMediaPicker`, `UnsplashImagePicker`, `GenerateImageDialog` |

#### `BlogAutoConfigForm`
| File | `components/admin/blog/BlogAutoConfigForm.tsx` |
|------|-------|
| Props | `config: any \| null`, `accessStatus: AutoBlogAccess`, `storeId: Id<"stores">` |
| Features | React Hook Form + Zod validation, 6 card sections (Activation, Topics, Scheduling, Style & Language, Publication, Actions), plan downgrade coercion with warning banner, multi-day schedule selectors |
| Dependencies | `api.blogAutoConfig.upsert`, `api.languages.list`, `api.blog.listCategories` |

#### `BlogAutoConfigPage`
| File | `components/admin/blog/BlogAutoConfigPage.tsx` |
|------|-------|
| Props | None |
| Features | Orchestrator with 3 states: loading, locked (with upgrade link), form. Quota badge display. |
| Dependencies | `BlogAutoConfigForm`, `LoadingState` |

#### `BlogCategoryManager`
| File | `components/admin/blog/BlogCategoryManager.tsx` |
|------|-------|
| Props | `open: boolean`, `onOpenChange: (open) => void` |
| Features | Sheet (side panel) with category CRUD: create form (name + description), inline edit, delete with confirmation |
| Dependencies | `DeleteConfirmDialog` |

#### `GenerateArticleDialog`
| File | `components/admin/blog/GenerateArticleDialog.tsx` |
|------|-------|
| Props | `open: boolean`, `onOpenChange: (open) => void` |
| Features | Dialog with form: topic input, tone selector, language selector, auto-translate toggle (Enterprise-gated), category selector with inline creation, quota badge, loading/locked states |
| Dependencies | `api.blogAutoGenerate.generateArticle`, `api.blogAutoConfig.getAccessStatus` |

#### `GenerateImageDialog`
| File | `components/admin/blog/GenerateImageDialog.tsx` |
|------|-------|
| Props | `open: boolean`, `onOpenChange: (open) => void`, `onInsert: (image) => void`, `defaultPrompt?: string` |
| Features | Dialog with prompt textarea, generate button, image preview, insert button, quota badge, quota-reached state |
| Dependencies | `api.blogImageGenerate.generateImage`, `api.blogAutoConfig.getImageAccessStatus` |

#### `UnsplashImagePicker`
| File | `components/admin/blog/UnsplashImagePicker.tsx` |
|------|-------|
| Props | `open: boolean`, `onOpenChange: (open) => void`, `onSelect: (photo) => void`, `initialQuery?: string` |
| Features | Dialog with search input, 2-3 column grid of results with photographer overlay, Unsplash attribution footer, download tracking on select |
| Dependencies | `api.unsplashSearch.searchPhotos`, `api.unsplashSearch.triggerDownload` |

#### `BlogArticlesTable`
| File | `components/admin/blog/BlogArticlesTable.tsx` |
|------|-------|
| Props | `articles: ArticleRow[]`, `onPublish`, `onArchive`, `onUnarchive`, `onDelete` |
| Features | Table with columns: Title (+ slug), Category, Status (badges), Modified date, Actions (dropdown: Edit, Publish, Archive, Delete). Clickable rows navigate to editor. |

#### `CreateArticleDialog`
| File | `components/admin/blog/CreateArticleDialog.tsx` |
|------|-------|
| Props | `open: boolean`, `onOpenChange: (open) => void`, `onOpenCategoryManager: () => void` |
| Features | Dialog with title input and category selector. Empty state prompts category creation. Navigates to editor on success. |

### 17.2 Subscription Components

#### `SubscriptionPage`
| File | `components/admin/subscription/SubscriptionPage.tsx` |
|------|-------|
| Props | None |
| Features | Orchestrator: shows `PricingView` (no active subscription) or `CurrentPlanView` (active). Handles `?status=success` toast on return from Stripe. |

#### `PricingView`
| File | `components/admin/subscription/PricingView.tsx` |
|------|-------|
| Props | None |
| Features | Monthly/Annual billing toggle, 3 plan cards (Starter/Pro/Enterprise) with feature lists, "2 mois offerts" badge for annual. Redirects to Stripe Checkout on subscribe. |

#### `CurrentPlanView`
| File | `components/admin/subscription/CurrentPlanView.tsx` |
|------|-------|
| Props | `entitlements: { autoBlog, stripeCustomerId?, subscriptionStatus? }` |
| Features | Card showing current plan name, status badge (Active/Trial), feature list with check/X icons, "Gerer mon abonnement" button (Stripe Portal), upgrade prompt for non-Enterprise plans. |

---

## 18. Routes

| Route | File | Component | Description |
|-------|------|-----------|-------------|
| `/content/blog` | `app/(admin)/content/blog/page.tsx` | `BlogContent` | Blog articles list with status tabs, create/generate dialogs |
| `/content/blog/[articleId]` | `app/(admin)/content/blog/[articleId]/page.tsx` | `BlogArticleEditor` | Full article editor with autosave, publish, schedule |
| `/content/blog/auto-config` | `app/(admin)/content/blog/auto-config/page.tsx` | `BlogAutoConfigPage` | Auto-blog configuration (topics, schedule, tone, approval mode) |
| `/subscription` | `app/(admin)/subscription/page.tsx` | `SubscriptionPage` | Subscription management (pricing cards or current plan view) |

All routes are under the `(admin)` route group and require authentication.

---

## 19. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o-mini (text) and GPT Image 1 / GPT Image 1 Mini (images) |
| `UNSPLASH_ACCESS_KEY` | No | Unsplash API access key. If not set, all images fall back to GPT Image generation. |
| `STRIPE_BID_SECRET_KEY` | Yes | Stripe secret key for the BeYours subscription product |
| `STRIPE_BID_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret for `POST /webhooks/stripe-bid` |
| `BID_APP_URL` | Yes | Application URL for Stripe redirect URLs (e.g., `https://myrestaurant.com`) |
| `STRIPE_BID_PRICE_STARTER` | Yes | Stripe Price ID for Starter monthly plan |
| `STRIPE_BID_PRICE_PRO` | Yes | Stripe Price ID for Pro monthly plan |
| `STRIPE_BID_PRICE_ENTERPRISE` | Yes | Stripe Price ID for Enterprise monthly plan |
| `STRIPE_BID_PRICE_STARTER_ANNUAL` | Yes | Stripe Price ID for Starter annual plan |
| `STRIPE_BID_PRICE_PRO_ANNUAL` | Yes | Stripe Price ID for Pro annual plan |
| `STRIPE_BID_PRICE_ENTERPRISE_ANNUAL` | Yes | Stripe Price ID for Enterprise annual plan |
| `AWS_REGION` | Yes | AWS region (default: `eu-west-3`) |
| `AWS_ACCESS_KEY_ID` | Yes | AWS IAM access key for S3 uploads |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key for S3 uploads |
| `AWS_S3_BUCKET_NAME` | Yes | S3 bucket name for media storage |
| `AWS_S3_PUBLIC_BASE_URL` | No | Custom public URL for S3 assets (e.g., CloudFront). Falls back to `https://{bucket}.s3.{region}.amazonaws.com` |

---

## 20. Testing

### 20.1 Unit Tests (Vitest)

| Test File | Location | Test Count | Coverage |
|-----------|----------|------------|----------|
| `blogAutoGuards.test.ts` | `packages/convex-functions/src/__tests__/` | ~74 test cases | `checkAutoBlogAccess` (entitlements exist, enabled, subscription status, plan exists, quota check, remaining quota calculation), `checkImageGenerationAccess` (same checks + image quota), `validateConfigAgainstPlan` (max topics, auto-publish, multi-language, weekly day validation, monthly day validation, exclusivity, bounds, uniqueness, max count), `normalizeScheduleDays` (backward compat) |
| `bidSubscription.test.ts` | `packages/convex-functions/src/__tests__/` | ~20 test cases | `resolvePlanFromPriceId` (known/unknown prices), `buildPriceMap` (monthly + annual prices, missing env vars), `resolvePriceIdFromPlan` (all plans + both billing intervals, missing env vars throw) |
| `ownerEntitlements.test.ts` | `packages/convex-functions/src/__tests__/` | ~8 test cases | `PLAN_PRESETS` structure validation (all plans have correct quotas, feature flags, image quotas) |
| `blogAutoUsage.test.ts` | `packages/convex-functions/src/__tests__/` | ~6 test cases | `getCurrentPeriodKey` format (YYYY-MM, zero-padded month, correct month/year) |

### 20.2 E2E Tests (Playwright)

| Test File | Location | Test Count | Coverage |
|-----------|----------|------------|----------|
| `blog-articles.spec.ts` | `apps/reference/e2e/admin/` | 11 tests | Page loading, heading display, create article dialog, generate AI dialog, category manager, status tabs, empty states |
| `blog-editor.spec.ts` | `apps/reference/e2e/admin/` | 3 tests | Editor page loading, toolbar display, tab navigation |
| `blog-auto-config.spec.ts` | `apps/reference/e2e/admin/` | 5 tests | Config page loading, form elements visible, save button, locked state for unauthenticated users |
| `subscription.spec.ts` | `apps/reference/e2e/admin/` | 7 tests | Pricing cards display, plan features listed, billing toggle, subscribe buttons, current plan view |

### 20.3 Running Tests

```bash
# All unit tests
pnpm test

# Specific unit test file
pnpm vitest run packages/convex-functions/src/__tests__/blogAutoGuards.test.ts

# Unit tests with coverage
pnpm test:coverage

# All E2E tests (requires running Convex backend)
pnpm test:e2e

# Specific E2E test file
pnpm playwright test apps/reference/e2e/admin/blog-articles.spec.ts

# E2E tests with UI
pnpm test:e2e:ui
```

---

## 21. Error Handling

### 21.1 Action Layer (Convex)

| Error Type | Handling |
|------------|----------|
| Auth failure | `throw new Error("Not authenticated")` -- caught by Convex and returned as error to client |
| Access denied (quota, no plan) | `throw new Error(access.reason)` with French message |
| Input validation | `throw new Error("Topic trop long (max 500 caracteres)")` |
| OpenAI API error | `throw new Error("OpenAI API error: {status} {statusText}")` |
| Empty OpenAI response | `throw new Error("OpenAI returned empty response")` |
| JSON parse failure | `throw new Error("Failed to parse AI response as JSON")` |
| Missing required fields | `throw new Error("AI response missing required fields (title, content)")` |
| Missing env var | `throw new Error("{ENV_VAR} not configured")` |

### 21.2 Mutation Layer

| Error Type | Handling |
|------------|----------|
| Article not found | `throw new Error("Article not found")` |
| Slug conflict | `throw new Error("Le slug ... est deja utilise")` |
| Draft incomplete (publish) | `throw new Error("Le titre est requis")`, etc. |
| Schedule in past | `throw new Error("La date de publication doit etre dans le futur")` |
| Category has articles | `throw new Error("Impossible de supprimer : des articles utilisent cette categorie")` |
| Config validation | `throw new Error(...)` with plan-specific French messages |

### 21.3 UI Layer

All mutations and actions are wrapped in try/catch blocks:

```typescript
try {
  await someAction(args)
  toast.success("Message de succes")
} catch (err) {
  toast.error(
    err instanceof Error ? err.message : "Erreur generique"
  )
}
```

Error toasts display the server error message directly (since they are written in French for the end user).

### 21.4 Stripe Webhook Errors

- Missing signature: HTTP 400 "Missing Stripe-Signature header"
- Invalid signature / processing error: HTTP 400 "Webhook processing error" + `console.error`
- Missing customer/subscription ID: Logged via `console.error`, event skipped (no throw)
- Payment failed: Logged via `console.warn`, no state change (handled by `subscription.updated`)

### 21.5 Image Pipeline Errors

Image pipeline errors are non-fatal. If an image fails to fetch/generate:

- Unsplash failure: Returns `null`, triggers GPT Image fallback
- GPT Image failure: Returns `null`, image placeholder is removed from HTML
- Cover image failure: Article is saved without a cover image (`coverImageId` is undefined)
- S3 upload failure: Returns `null` for images within article, throws for standalone image generation

---

## 22. Configuration

### 22.1 Setting Up From Scratch

#### 1. Create Stripe Products

1. Create a Stripe product "Auto Blog" in the Stripe Dashboard
2. Create 6 prices:
   - Starter Monthly, Starter Annual
   - Pro Monthly, Pro Annual
   - Enterprise Monthly, Enterprise Annual
3. Note the Price IDs (`price_xxx`)

#### 2. Configure Stripe Webhook

1. In Stripe Dashboard > Webhooks, add endpoint: `{CONVEX_DEPLOYMENT_URL}/webhooks/stripe-bid`
2. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
3. Note the Webhook Signing Secret

#### 3. Set Environment Variables

In your Convex deployment settings, set all variables from section 19.

#### 4. Register HTTP Route

Ensure the webhook HTTP route is registered in your Convex `http.ts`:

```typescript
import { handleWebhook } from "./bidStripeWebhook"

http.route({
  path: "/webhooks/stripe-bid",
  method: "POST",
  handler: handleWebhook,
})
```

#### 5. Deploy Schema

```bash
pnpx convex deploy
```

This creates all required tables (`ownerEntitlements`, `blogAutoConfig`, `blogAutoQueue`, `blogAutoUsage`, `blogArticles`, `blogCategories`, `blogTags`, `blogArticleTags`, `cmsMedia`) with their indexes.

#### 6. Seed Entitlements (Development)

For development, you can manually create entitlements:

```typescript
// In a Convex mutation or the Convex dashboard:
await ctx.db.insert("ownerEntitlements", {
  ownerId: "your-better-auth-user-id",
  autoBlog: PLAN_PRESETS.pro,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})
```

In production, entitlements are created and managed automatically through the Stripe subscription flow.

#### 7. Configure Unsplash (Optional)

1. Create an Unsplash Developer account
2. Create an application to get an Access Key
3. Set `UNSPLASH_ACCESS_KEY` in Convex environment
4. If not configured, all images will be generated via GPT Image (higher cost but no dependency)

### 22.2 File Inventory

```
packages/
  convex-schema/src/tables/
    autoBlog.ts                    # Schema: ownerEntitlements, blogAutoConfig, blogAutoQueue, blogAutoUsage
  convex-functions/src/
    blogAutoGuards.ts              # Guard: checkAutoBlogAccess, checkImageGenerationAccess, validateConfigAgainstPlan
    blogAutoGenerate.ts            # Logic: incrementUsageCore, incrementImageUsageCore, getGenerationContextCore, saveGeneratedArticleCore
    blogAutoUsage.ts               # Logic: getCurrentPeriodKey, getByOwnerIdPeriod
    blogAutoConfig.ts              # Logic: getByStoreId, listByOwnerId, upsert
    blog.ts                        # Logic: All blog CRUD queries/mutations/helpers
    blogPublish.ts                 # Logic: publishArticleCore, scheduleArticleCore, archiveArticleCore
    ownerEntitlements.ts           # Logic: PLAN_PRESETS, upsert, getByOwnerId
    bidSubscription.ts             # Logic: resolvePlanFromPriceId, buildPriceMap, resolvePriceIdFromPlan, attachStripeCustomerId, upsertFromStripe
    __tests__/
      blogAutoGuards.test.ts       # 74 test cases
      bidSubscription.test.ts      # 20 test cases
      ownerEntitlements.test.ts    # 8 test cases
      blogAutoUsage.test.ts        # 6 test cases
  cms/src/sanitize/
    svgSanitizer.ts                # SVG sanitization

apps/reference/
  convex/
    blogAutoGenerate.ts            # Action: generateArticle (Node runtime)
    blogAutoGenerateInternal.ts    # Internal: _checkAccess, _getGenerationContext, _createBlogImage, _saveGeneratedArticle
    blogImageGenerate.ts           # Action: generateImage (Node runtime)
    blogImageGenerateInternal.ts   # Internal: _checkImageAccess, _incrementImageUsage
    unsplashSearch.ts              # Action: searchPhotos, triggerDownload (Node runtime)
    bidSubscription.ts             # Action: createCheckoutSession, createPortalSession, processWebhookEvent (Node runtime)
    bidSubscriptionInternal.ts     # Internal: getByOwnerId, attachStripeCustomerId, upsertFromStripe
    bidStripeWebhook.ts            # httpAction: handleWebhook
    blogAutoConfig.ts              # Query/Mutation: getByStoreId, getAccessStatus, getImageAccessStatus, upsert
    blog.ts                        # Query/Mutation: All blog CRUD wrappers with auth
  components/admin/blog/
    BlogContent.tsx                # Article list page
    BlogArticleEditor.tsx          # Full article editor with autosave
    BlogRichTextEditor.tsx         # Tiptap editor with BubbleMenu
    BlogAutoConfigForm.tsx         # Auto-blog configuration form
    BlogAutoConfigPage.tsx         # Config page orchestrator
    BlogCategoryManager.tsx        # Category CRUD in sheet
    GenerateArticleDialog.tsx      # AI article generation dialog
    GenerateImageDialog.tsx        # AI image generation dialog
    UnsplashImagePicker.tsx        # Unsplash photo search dialog
    BlogArticlesTable.tsx          # Article list table
    CreateArticleDialog.tsx        # Manual article creation dialog
  components/admin/subscription/
    SubscriptionPage.tsx           # Subscription management orchestrator
    PricingView.tsx                # Plan comparison with billing toggle
    CurrentPlanView.tsx            # Active plan display with portal link
  app/(admin)/content/blog/
    page.tsx                       # Route: /content/blog
    [articleId]/page.tsx           # Route: /content/blog/[articleId]
    auto-config/page.tsx           # Route: /content/blog/auto-config
  app/(admin)/subscription/
    page.tsx                       # Route: /subscription
  e2e/admin/
    blog-articles.spec.ts          # 11 E2E tests
    blog-editor.spec.ts            # 3 E2E tests
    blog-auto-config.spec.ts       # 5 E2E tests
    subscription.spec.ts           # 7 E2E tests
```

---

**Version**: 2.0.0
**Last Updated**: 2026-03-07
**Maintained by**: BeYours Team
