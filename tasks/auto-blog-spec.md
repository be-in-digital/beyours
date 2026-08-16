# Auto Blog Engine — Feature Spec

> Premium upsell: automatic generation of blog articles via LLM.

---

## 1. Subscription model

| | Starter | Pro | Enterprise |
|---|---------|-----|------------|
| Articles/month | 2 | 8 (2/week) | ~30 (daily) |
| Topics | 3 max | Unlimited | Unlimited |
| Multi-language translation | No | No | Yes |
| Approval mode | Draft only | Draft or auto-publish | Draft or auto-publish + multi-language |

- **Billing**: Stripe Subscriptions, at the **owner account** level (not per store)
- **1 owner = N stores**: rights come from the owner subscription, not from the store
- **Editorial config**: per store (each store can have its own settings)

---

## 2. Configurable parameters (`blogAutoConfig`)

| Parameter | Type | Description |
|-----------|------|-------------|
| `themes` | `string[]` | Free-form guided list (e.g. "seasonal recipes", "local events") |
| `frequency` | `"weekly" \| "monthly"` | Generation frequency |
| `preferredWeekday` | `number? (0-6)` | Preferred day if weekly |
| `preferredMonthDay` | `number? (1-28)` | Preferred day if monthly |
| `preferredHour` | `number (0-23)` | Preferred local hour |
| `timezone` | `string` | E.g. "Europe/Paris" |
| `tone` | `"formel" \| "decontracte" \| "storytelling"` | Writing tone |
| `primaryLocale` | `string` | Source language (e.g. "fr") |
| `autoTranslate` | `boolean` | Plugs into the existing i18n pipeline |
| `approvalMode` | `"draft_review" \| "auto_publish"` | Approval mode |
| `targetStoreIds` | `Id<"stores">[]?` | Stores used for local context (optional) |
| `categoryId` | `Id<"blogCategories">?` | Default category for generated articles |

**Per-plan approval rules**:
- Starter: `draft_review` only
- Pro: `draft_review` or `auto_publish`
- Enterprise: `draft_review` or `auto_publish` + multi-language

---

## 3. Content generation

### 3.1 LLM — Model-agnostic approach

Config per task type (no hardcoded SKU):

```
generationModel: string   // e.g. "gpt-4o-mini" (cheap) or "gpt-4o" (quality)
seoModel: string           // for meta/keywords
translationModel: string   // already exists via i18n
```

- **Standard (Starter/Pro)**: cheap model
- **Enterprise**: quality model for rewriting + multi-language

### 3.2 Context sources

The LLM receives structured context, never an empty prompt:

1. **Restaurant/brand**: name, positioning, specialties, brand tone
2. **Menu/products/categories**: popular dishes, new items, prices
3. **Location**: city, neighborhood, local seasonality, events
4. **Internal data**: promos, special hours, news
5. **Article history**: titles/topics already published → avoid duplicates

**Types of generated articles**:
- Seasonal recipes
- Product focus / signature dish
- Restaurant news
- Local events connected to the brand
- Behind the scenes / storytelling
- Food and wine pairings

### 3.3 Images

Priority order:
1. **Existing cmsMedia** first (consistent with the brand)
2. **Stock photo fallback** (Unsplash/Pexels API) if there is no internal visual
3. **AI generation**: out of scope for V1

In V1: if no relevant image is found, the article ships without a cover (the restaurant owner can add one during review).

### 3.4 SEO

The engine automatically generates:
- `slug`
- `metaTitle`
- `metaDescription`
- Target keywords
- The SEO angle, before writing

**Admin override**: the restaurant owner can fix the slug, the metas and the final title after generation.

---

## 4. Technical architecture

### 4.1 New Convex tables

#### `blogAutoConfig` — Editorial configuration per store

```typescript
{
  ownerId: string,              // Better Auth userId
  storeId: Id<"stores">,        // config per store

  isEnabled: boolean,

  themes: string[],
  frequency: "weekly" | "monthly",
  preferredWeekday?: number,    // 0-6 if weekly
  preferredMonthDay?: number,   // 1-28 if monthly
  preferredHour: number,        // local hour
  timezone: string,             // e.g. "Europe/Paris"

  tone: "formel" | "decontracte" | "storytelling",
  primaryLocale: string,
  autoTranslate: boolean,

  approvalMode: "draft_review" | "auto_publish",

  categoryId?: Id<"blogCategories">,
  targetStoreIds?: Id<"stores">[],

  lastPlannedAt?: number,
  lastGeneratedAt?: number,

  createdAt: number,
  updatedAt: number,
}
```

**Indexes**: `by_storeId`, `by_ownerId`, `by_isEnabled`

#### `blogAutoQueue` — Job queue / job log

```typescript
{
  ownerId: string,
  storeId: Id<"stores">,
  configId: Id<"blogAutoConfig">,

  status: "pending" | "generating" | "draft_created" | "published" | "failed" | "cancelled",

  scheduledFor: number,
  startedAt?: number,
  completedAt?: number,

  theme: string,
  locale: string,

  generatedTitle?: string,
  generatedSlug?: string,

  articleId?: Id<"blogArticles">,

  errorCode?: string,
  errorMessage?: string,

  retryCount: number,
  maxRetries: number,           // default 3
  idempotencyKey: string,       // e.g. storeId + yyyy-mm + slot + theme

  createdAt: number,
  updatedAt: number,
}
```

**Indexes**: `by_storeId`, `by_status_scheduledFor`, `by_configId`, `by_idempotencyKey`

#### `blogAutoUsage` — Monthly quotas

```typescript
{
  ownerId: string,
  periodKey: string,        // "2026-02"
  generatedCount: number,
  publishedCount: number,
  updatedAt: number,
}
```

**Indexes**: `by_ownerId_periodKey`

### 4.2 Convex crons (2 separate crons)

#### A. `planAutoBlogJobs` — Every hour

Role:
1. Read the `blogAutoConfig` entries with `isEnabled=true`
2. Check the owner plan + remaining quota (`blogAutoUsage`)
3. Compute whether an article should be scheduled based on frequency/day/hour/timezone
4. Create a `blogAutoQueue(status="pending")` with an `idempotencyKey` to avoid duplicates

**This cron does NOT generate content.** It only schedules.

#### B. `executeAutoBlogQueue` — Every 5-15 minutes

Role:
1. Fetch the `pending` jobs with `scheduledFor <= now`
2. Move the job to `generating`
3. Call the generation pipeline (Convex action → OpenAI API)
4. Mark `draft_created` / `published` / `failed`
5. Increment `blogAutoUsage.generatedCount`

**Separating planning from execution** → more reliable, easier to debug.

### 4.3 Generation pipeline

```
1. Job selection
   └─ blogAutoQueue.status = "pending"

2. Context assembly
   ├─ Restaurant/brand info (stores, name, specialties)
   ├─ Menu / products / categories
   ├─ Location (city, neighborhood, season)
   ├─ Internal data (promos, special hours)
   ├─ Chosen theme
   ├─ Tone and language
   └─ History of published articles (anti-duplicate)

3. LLM prompt
   └─ Generates: title, excerpt, content (HTML), metaTitle, metaDescription, keywords, image suggestion

4. Image selection
   ├─ Search cmsMedia by keywords
   └─ Fallback: no image (or stock photo in V2)

5. Article creation (existing functions)
   ├─ createArticle({ storeId, title, categoryId })
   ├─ saveDraft({ articleId, draftContent, categoryId, tagIds })
   └─ If auto_publish: publishArticle({ articleId })

6. Translation (if autoTranslate=true and the plan allows it)
   └─ Triggers the existing i18n pipeline

7. Queue update
   ├─ articleId
   ├─ status: "draft_created" | "published"
   └─ timestamps
```

**Important**: auto-blog is an orchestration layer, NOT a second article system. It reuses `createArticle`, `saveDraft`, `publishArticle`.

---

## 5. Gating / Access control

### 5.1 Hierarchy

```
Stripe = source of truth (paying or not)
    ↓
Owner Entitlements = what they are allowed to use
    ↓
Store Config = how they want to use it on this store
```

`blogAutoConfig.isEnabled` is a local config toggle, NOT the billing source of truth.

### 5.2 Owner Feature Entitlements

Derived from Stripe, stored app-side:

```typescript
autoBlog: {
  enabled: boolean,
  plan: "starter" | "pro" | "enterprise" | null,
  monthlyQuota: number,       // 2, 8, 30
  maxTopics: number | null,   // 3, null, null
  allowMultiLanguage: boolean, // false, false, true
  allowAutoPublish: boolean,  // false, true, true
}
```

### 5.3 Three levels of gating

#### A. Admin UI
- No plan → section hidden + upsell CTA
- Quota reached → button disabled + message
- Starter → 3 themes max, draft only
- Current plan badge + monthly usage counter

#### B. Backend (Convex mutations/actions)
Every sensitive mutation re-checks:
- Feature is active
- Remaining quota
- Plan limits (themes, auto-publish, multi-language)

**Never trust the UI alone.**

#### C. Cron
The cron skips stores if:
- The subscription has expired
- The quota is reached
- The feature is disabled

### 5.4 Stripe webhooks

Events to listen to:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Effects:
- Enable/disable `autoBlog`
- Update the plan
- Recompute the limits

Intermediate states:
- `past_due` → read-only access, no new generations
- `canceled` → feature cut off

### 5.5 Gating tables

```
ownerSubscription / billing table     ← synced from Stripe webhooks
ownerFeatureEntitlements              ← derived rights
blogAutoConfig (per store)            ← editorial config
blogAutoUsage (per owner/month)       ← quotas
```

---

## 6. Admin UX — Screens

### 6.1 Auto Blog page (`/content/blog/auto`)

**If no subscription**: upsell page presenting the plans

**If subscribed**:
- Header: "Blog Automatique" + plan badge + usage counter (e.g. "3/8 articles ce mois")
- Editorial config (form)
- Generation history (blogAutoQueue table)
- Enable/disable toggle

### 6.2 Configuration

- Themes: multi-value input (chips + add)
- Frequency: weekly/monthly radio + day/hour selects
- Tone: radio, 3 options
- Language: select
- Auto-translation: toggle (gated by plan)
- Approval mode: radio draft/auto-publish (gated by plan)
- Default category: select from blogCategories

### 6.3 History / Queue

Table with columns:
- Theme
- Status (pending/generating/draft/published/failed)
- Scheduled date
- Article (link to the editor if created)
- Actions (cancel if pending, retry if failed)

### 6.4 Badge in the blog list

Automatically generated articles: distinctive "Auto" badge in BlogArticlesTable.

---

## 7. Implementation phases

### Phase 1 — Schema + Gating (P0)
- Tables: `blogAutoConfig`, `blogAutoQueue`, `blogAutoUsage`
- Owner entitlements / feature flags
- Stripe webhooks for auto-blog
- Upsell page if no subscription

### Phase 2 — Config UI (P1)
- `/content/blog/auto` page
- Configuration form
- Validation of per-plan limits

### Phase 3 — Generation pipeline (P1)
- Convex action for the LLM call
- Restaurant context assembly
- Article creation through the existing functions
- `executeAutoBlogQueue` cron

### Phase 4 — Scheduling (P1)
- `planAutoBlogJobs` cron
- Frequency/timezone/preferred-day logic
- Deduplication via `idempotencyKey`

### Phase 5 — Translation + Polish (P2)
- Integration with the existing i18n pipeline
- cmsMedia image selection
- History/queue UI
- Usage metrics

---

## 8. Technical decisions

| Decision | Choice | Rationale |
|----------|-------|--------|
| Billing level | Owner account | 1 owner = N stores |
| Config level | Per store | Each store has its own settings |
| Billing source of truth | Stripe | No billing status in blogAutoConfig |
| LLM | GPT (model-agnostic config) | cheap for standard, quality for Enterprise |
| Images V1 | Existing cmsMedia | Brand consistency, no AI generation |
| Article creation | Existing blog functions | A layer on top, no duplication |
| Crons | 2 separate ones (plan + execute) | Reliability, debuggability |
| Anti-duplicate | idempotencyKey | storeId + period + slot + theme |
| Default approval | draft_review | Safety, gated by plan |

---

## 9. Risks and mitigations

| Risk | Mitigation |
|--------|------------|
| Off-topic LLM content | Structured context + mandatory review (Starter) |
| Duplicate articles | idempotencyKey + anti-duplicate history |
| Quota exceeded | Double check: cron + mutation |
| Stripe webhook rate | Idempotent handlers + retry |
| High LLM cost | Cheap model by default, quality gated by plan |
| Restaurant owner forgets to review | Notification/email when a draft is generated |
