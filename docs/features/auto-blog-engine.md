# Auto Blog Engine

## Overview

The Auto Blog Engine is a premium feature of BeInDigital Engine that enables restaurant owners to generate SEO-optimized blog articles using AI. It includes article generation (GPT-4o-mini), image generation (GPT Image 1 Mini), Unsplash integration, Stripe-based subscription billing, and a rich text editor built on Tiptap.

## Architecture

```
+------------------+     +-------------------+     +------------------+
|   Next.js UI     |     |   Convex Actions  |     |  External APIs   |
|                  |     |   ("use node")    |     |                  |
|  BlogContent     +---->+ blogAutoGenerate  +---->+  OpenAI GPT-4o   |
|  BlogEditor      |     | blogImageGenerate |     |  GPT Image 1    |
|  AutoConfigForm  |     | unsplashSearch    |     |  Unsplash API    |
|  SubscriptionPage|     | bidSubscription   |     |  Stripe API      |
+--------+---------+     +--------+----------+     +------------------+
         |                         |
         v                         v
+------------------+     +-------------------+     +------------------+
|  Convex Queries  |     |  Package Layer    |     |  Storage         |
|  & Mutations     |     |  (convex-funcs)   |     |                  |
|                  |     |                   |     |  AWS S3          |
|  blog.ts         +---->+ blogAutoGuards    |     |  (images, media) |
|  blogAutoConfig  |     | blogAutoGenerate  |     |                  |
|  blogAutoUsage   |     | ownerEntitlements |     +------------------+
+------------------+     +-------------------+
```

### Layer Separation

| Layer | Location | Purpose |
|-------|----------|---------|
| **Package Layer** | `packages/convex-functions/src/` | Pure business logic, guards, validators. Reusable across apps. |
| **App Layer** | `apps/restaurant-theme/convex/` | Convex function wrappers, actions with `"use node"`, API calls. |
| **UI Layer** | `apps/restaurant-theme/components/admin/blog/` | React components, forms, dialogs. |

## Database Schema

### Tables (`packages/convex-schema/src/tables/autoBlog.ts`)

#### `ownerEntitlements`
Feature gating per owner account. Source of truth for plan limits.

| Field | Type | Description |
|-------|------|-------------|
| `ownerId` | `string` | Better Auth user ID |
| `autoBlog.enabled` | `boolean` | Feature toggle |
| `autoBlog.plan` | `"starter" \| "pro" \| "enterprise"` | Current plan |
| `autoBlog.monthlyQuota` | `number` | Articles per month (2/8/30) |
| `autoBlog.monthlyImageQuota` | `number?` | AI images per month (5/20/100) |
| `autoBlog.maxTopics` | `number?` | Max themes (3/10/unlimited) |
| `autoBlog.allowMultiLanguage` | `boolean` | Auto-translation access |
| `autoBlog.allowAutoPublish` | `boolean` | Direct publish (vs draft review) |
| `stripeCustomerId` | `string?` | Stripe customer ID |
| `stripeSubscriptionId` | `string?` | Stripe subscription ID |
| `subscriptionStatus` | `string?` | active, trialing, canceled, etc. |

#### `blogAutoConfig`
Editorial configuration per store.

| Field | Type | Description |
|-------|------|-------------|
| `storeId` | `Id<"stores">` | Associated store |
| `frequency` | `"weekly" \| "monthly"` | Generation frequency |
| `preferredWeekdays` | `number[]?` | Days of week (0-6) |
| `preferredMonthDays` | `number[]?` | Days of month (1-28) |
| `themes` | `string[]` | Topic themes for generation |
| `tone` | `"formel" \| "decontracte" \| "storytelling"` | Writing tone |
| `approvalMode` | `"draft_review" \| "auto_publish"` | Publication mode |
| `autoTranslate` | `boolean` | Auto-translate to other languages |

#### `blogAutoQueue`
Job queue for generation tracking with idempotency.

#### `blogAutoUsage`
Monthly quota tracking per owner (`periodKey` = "YYYY-MM").

## Plan Tiers and Quotas

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| **Monthly articles** | 2 | 8 | 30 |
| **AI images/month** | 5 | 20 | 100 |
| **Max themes** | 3 | 10 | Unlimited |
| **Auto-translate** | No | Yes | Yes |
| **Auto-publish** | No | Yes | Yes |

Plans are defined in `packages/convex-functions/src/ownerEntitlements.ts` as `PLAN_PRESETS`.

## API Reference

### Article Generation

**`blogAutoGenerate.generateArticle`** (action, `"use node"`)
- **Args**: `storeId`, `theme`, `locale`, `autoTranslate?`, `configId?`, `queueId?`
- **Flow**: Auth -> Quota check -> GPT-4o-mini generation -> HTML sanitization -> Unsplash/GPT cover image -> Save article -> Increment usage
- **Returns**: `{ articleId, title, slug }`

### Image Generation

**`blogImageGenerate.generateImage`** (action, `"use node"`)
- **Args**: `storeId`, `prompt`
- **Flow**: Auth -> Image quota check -> GPT Image 1 Mini -> S3 upload -> cmsMedia record -> Process variants -> Increment usage
- **Returns**: `{ url, mediaId, alt }`

### Configuration

**`blogAutoConfig.getConfig`** (query) - Get store config
**`blogAutoConfig.saveConfig`** (mutation) - Save/update config with plan validation
**`blogAutoConfig.getImageAccessStatus`** (query) - Check remaining image quota

### Subscription

**`bidSubscription.createCheckoutSession`** (action) - Create Stripe Checkout
**`bidSubscription.createPortalSession`** (action) - Create Stripe Billing Portal
**`bidSubscription.processWebhookEvent`** (internalAction) - Handle Stripe webhooks

### Blog CRUD

**`blog.listArticles`** (query) - List articles with pagination
**`blog.getArticle`** (query) - Get single article
**`blog.createArticle`** (mutation) - Create manual article
**`blog.updateArticle`** (mutation) - Update article
**`blog.deleteArticle`** (mutation) - Soft delete article
**`blog.publishArticle`** (mutation) - Publish draft

## SEO Optimization

The GPT prompt enforces these SEO rules:

1. **Keyword density**: 1-2% for the main keyword
2. **Heading hierarchy**: H2 for sections, H3 for subsections (no H1 in body)
3. **Featured snippets**: Lists with 3-8 items for "best of" type content
4. **LSI keywords**: 3-5 semantic variations included naturally
5. **Article length**: 1200-1800 words per article
6. **HTML structure**: Proper `<h2>`, `<h3>`, `<p>`, `<ul>`, `<ol>`, `<blockquote>` tags
7. **Sanitization**: All GPT output is sanitized via `sanitize-html` with a strict whitelist

## Security

### Authentication
- All public queries/mutations/actions verify `ctx.auth.getUserIdentity()`
- Internal functions use `internalQuery`/`internalMutation`/`internalAction`
- Stripe webhooks verify signature via `stripe.webhooks.constructEvent()`

### Quota Enforcement
- `checkAutoBlogAccess()` verifies subscription status + monthly article quota
- `checkImageGenerationAccess()` verifies image quota separately
- Usage incremented AFTER successful operations (not before)
- Guards are in package layer (`blogAutoGuards.ts`) for reuse

### Input Validation
- All Convex args use `v.string()`, `v.id()`, etc. (Convex runtime validation)
- HTML from GPT sanitized via `sanitize-html` with allowed tags whitelist
- SVG uploads sanitized via custom `svgSanitizer.ts`
- S3 keys constructed from Convex document IDs (no user-controlled paths)

### API Keys
- All secrets in environment variables (never client-side)
- `.env*` files in `.gitignore`
- Stripe keys prefixed `STRIPE_BID_*` for namespace isolation

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT |
| `UNSPLASH_ACCESS_KEY` | No | Unsplash API for stock photos |
| `STRIPE_BID_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_BID_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `STRIPE_BID_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `BID_APP_URL` | Yes | App URL for Stripe redirects |
| `STRIPE_BID_PRICE_STARTER_MONTHLY` | Yes | Stripe Price ID |
| `STRIPE_BID_PRICE_STARTER_ANNUAL` | Yes | Stripe Price ID |
| `STRIPE_BID_PRICE_PRO_MONTHLY` | Yes | Stripe Price ID |
| `STRIPE_BID_PRICE_PRO_ANNUAL` | Yes | Stripe Price ID |
| `STRIPE_BID_PRICE_ENTERPRISE_MONTHLY` | Yes | Stripe Price ID |
| `STRIPE_BID_PRICE_ENTERPRISE_ANNUAL` | Yes | Stripe Price ID |

## Testing

### Unit Tests (Vitest)

| Test File | Coverage |
|-----------|----------|
| `blogAutoGuards.test.ts` | 51 tests — access checks, quota validation, schedule validation |
| `bidSubscription.test.ts` | 19 tests — price resolution, plan mapping |
| `ownerEntitlements.test.ts` | 7 tests — plan presets, hierarchy |
| `blogAutoUsage.test.ts` | 5 tests — period key generation |

### E2E Tests (Playwright)

| Test File | Coverage |
|-----------|----------|
| `blog-articles.spec.ts` | Page loading, create dialog, generate dialog |
| `blog-editor.spec.ts` | Editor loading, toolbar display |
| `blog-auto-config.spec.ts` | Config form elements, save button |
| `subscription.spec.ts` | Pricing cards, quotas, billing toggle |

### Running Tests

```bash
# Unit tests
pnpm test

# E2E tests (requires running Convex backend)
pnpm test:e2e

# Specific test file
pnpm vitest run packages/convex-functions/src/__tests__/blogAutoGuards.test.ts
```

## UI Components

| Component | Path | Description |
|-----------|------|-------------|
| `BlogContent` | `components/admin/blog/BlogContent.tsx` | Article list page |
| `BlogArticleEditor` | `components/admin/blog/BlogArticleEditor.tsx` | Full article editor |
| `BlogRichTextEditor` | `components/admin/blog/BlogRichTextEditor.tsx` | Tiptap editor with BubbleMenu |
| `BlogAutoConfigForm` | `components/admin/blog/BlogAutoConfigForm.tsx` | Auto-blog configuration |
| `BlogAutoConfigPage` | `components/admin/blog/BlogAutoConfigPage.tsx` | Config page orchestrator |
| `GenerateArticleDialog` | `components/admin/blog/GenerateArticleDialog.tsx` | AI article generation dialog |
| `GenerateImageDialog` | `components/admin/blog/GenerateImageDialog.tsx` | AI image generation dialog |
| `UnsplashImagePicker` | `components/admin/blog/UnsplashImagePicker.tsx` | Stock photo search |
| `SubscriptionPage` | `components/admin/subscription/SubscriptionPage.tsx` | Subscription management |
| `PricingView` | `components/admin/subscription/PricingView.tsx` | Plan comparison cards |
| `CurrentPlanView` | `components/admin/subscription/CurrentPlanView.tsx` | Active plan display |

## Routes

| Route | Description |
|-------|-------------|
| `/content/blog` | Blog articles list |
| `/content/blog/[articleId]` | Article editor |
| `/content/blog/auto-config` | Auto-blog configuration |
| `/subscription` | Subscription management |
