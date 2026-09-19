# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Environment Variables Validation
- `.env.example` template with 40+ documented variables organized by tier (package-level vs site-level)
- `validateAllEnv()` function for non-throwing Zod-based validation of all env vars at startup
- `formatEnvReport()` for formatted console output grouping missing vars by tier with box-drawing characters
- `instrumentation.ts` integration: warning in dev, blocking error in production
- 9 unit tests covering validation and reporting

#### Single Store Auto-Selection
- `StoreSelector` auto-selects and displays store name as label when only one store exists
- `StoreGuard` auto-selects the single store without prompting the user

#### Store Creation Workflow (Draft to Open)
- New stores start in `draft` status automatically
- Toast notification post-creation with configuration guidance
- Amber warning banner on store detail page for draft stores
- New store statuses: `draft`, `open`, `closed`, `temporarily_unavailable`

#### Store Detail Navigation
- Back arrow button on store detail page to return to stores list

#### Dynamic Branding from CMS
- `branding` block added to `storefront-layout` CMS page (logo, favicon, brandName)
- Storefront header: dynamic logo image or brand name text fallback
- Admin sidebar: `logoUrl` and `brandName` props from CMS data
- `DynamicFavicon` client component for runtime favicon injection from CMS

#### MCP Server & Documentation
- 6 new exports registered in MCP server for `@be-yours/core` (env schemas, getters, validation)
- 5 new exports registered for `@be-yours/admin` (AppSidebar, StoreSelector, StoreGuard, pages)
- Updated documentation: `core.md`, `admin.md`, `environment-variables.md`, `multi-store.md`, `cms-content.md`

- **Auto Blog Engine**: AI-powered blog article generation using GPT-4o-mini with SEO optimization
  - Keyword density (1-2%), heading hierarchy (H2/H3), featured snippets, LSI keywords
  - 1200-1800 words per article with proper HTML structure
- **AI Image Generation**: GPT Image 1 Mini integration with monthly quota system per plan
- **Unsplash Integration**: Stock photo search and insertion with proper attribution
- **Stripe Subscription System**: Starter/Pro/Enterprise plans with monthly and annual billing
  - Monthly article quotas (2/8/30) and image quotas (5/20/100)
  - Checkout, portal, and webhook handling
- **Blog Editor**: Tiptap rich text editor with BubbleMenu, image management, and autosave
- **Blog Auto Config**: Scheduled article generation with frequency, themes, tone, and approval mode
- **Blog Categories**: CRUD management for article categorization
- **Auto Translation**: GPT-powered translation of articles to multiple languages
- **Generate Article Dialog**: One-click AI article generation with topic, tone, and locale selection
- **Generate Image Dialog**: AI image generation from text prompts with quota display
- **Subscription Management UI**: Plan comparison cards, current plan view, billing portal access
- **Feature Documentation**: Comprehensive docs at `docs/features/auto-blog-engine.md`

### Changed
- **CMS Media Library**: Added folder-based filtering and blog media support
- **S3 Storage**: Restructured folder layout (`cms/`, `blog/` prefixes)
- **SVG Sanitizer**: Added `foreignObject`, `math`, `annotation-xml`, `base` to dangerous elements list
- **Navigation**: Added blog and subscription routes to admin sidebar

### Fixed
- **XSS Prevention**: Escape HTML attributes in image injection (alt, photographer name/URL)
- **SSRF Prevention**: Validate Unsplash download URL domain before appending API key
- **Input Validation**: Added length limits on topic (500), prompt (1000), locale (10)
- **Error Logging**: Added `console.error` in silent catch blocks for production debugging
- **Image ID Extraction**: Return `mediaId` from `generateWithOpenAI` instead of fragile URL regex
- **Timezone Bug**: Fixed `timestampToDatetimeLocal` converting to UTC instead of local time
- **Stripe Redirect**: Fixed cancel URL path (`/subscription` -> `/admin/subscription`)
- **ESLint Compliance**: Resolved all 74+ lint errors across 20+ files

### Security
- All public Convex actions/queries verify authentication via `ctx.auth.getUserIdentity()`
- Stripe webhooks verify signature via `stripe.webhooks.constructEvent()`
- GPT output sanitized via `sanitize-html` with strict tag/attribute whitelist
- S3 paths constructed from Convex document IDs (no user-controlled paths)
- API keys stored in environment variables, `.env*` in `.gitignore`
- Unsplash `triggerDownload` validates URL hostname to prevent SSRF and API key leakage

### CI/CD
- E2E workflow now requires `CONVEX_E2E_ENABLED=true` repo variable to run
- Added `e2e-status` job as always-passing gate for branch protection rules
- E2E gracefully skips when no Convex backend is configured instead of failing
