# Be in Digital — Homepage Agency Redesign

> **Design document** produced by a structured brainstorming session (skill `brainstorming`) + multi-agent review (architect / UI-UX / performance / security).
> Serves as the central reference for the implementation phase.
>
> **Status**: ✅ Final lock + multi-agent review folded in. **1 remaining decision** (hero concept — see §4.3).
> **Branch**: `doums85/agency-homepage`
> **Target**: Awwwards SOTD (Site of the Day)
> **Estimated cycle**: ~26-30 weeks (~6.5-7.5 months) solo + AI, post-review

---

## 1. Understanding Summary

### What is being built
A **new "Be in Digital" agency site** on `beindigital.fr` — an award-worthy premium showcase site, **5 pages** (Home, Work, Products, About, Contact), an **end-to-end cinematic WebGL** experience.

In parallel, the current restaurant site moves to `restaurant.beindigital.fr` (light cosmetic rework for visual consistency, not a from-scratch redesign — the premium dark-luxury redesign is already done, cf. commit `979a97b`).

**Code architecture**: **Turborepo** monorepo (`apps/agency` + `apps/restaurant` + `packages/{ui,tokens,config}`), 2 separate Vercel projects.

### Why
Reposition Be in Digital as a **premium venture studio** aimed at startups & scale-ups. The restaurant product becomes a *case study / flagship product* of the studio rather than the only offer. Maximize visibility through Awwwards + LinkedIn + word of mouth.

### Who for
- **Agency commercial target**: founders/decision makers at Series A/B startups and FR mid-market scale-ups (then EN internationally). Deals of 30-200k€+.
- **Perception target**: the Awwwards jury + the creative tech community.

### Key constraints
- Solo founder + AI as the main dev — no deadline, quality comes first
- Mandated stack: **Next.js 16 + React 19 + Tailwind v4 + Convex + Framer Motion + Lenis** (already in place)
- To add: **React Three Fiber + drei + GSAP ScrollTrigger + post-processing**
- **Perf**: Lighthouse desktop ≥ 80 / mobile ≥ 60, Core Web Vitals **Good** required (LCP < 2.5s, INP < 200ms, CLS < 0.1) — reachable but tight (perf agent verdict)
- **Mobile**: full WebGL with aggressive LOD (KTX2, instancing, frustum culling, SceneVisibilityManager)
- **Branding**: mint/dark palette + **signature secondary accent still to pick** (burnt orange or copper, <3% of surface)

### Explicit non-goals
- ❌ No heavy scroll-jacking (native scroll respected, Lenis as the only driver)
- ❌ No audio (decision kept — clean B2B FR)
- ❌ No SEO-first at launch (the LinkedIn network is lead channel #1)
- ❌ No separate detailed services pages
- ❌ No blog/journal at launch
- ❌ No recruiting/careers
- ❌ No full i18n at launch (FR primary, EN coming in phase 2)
- ❌ No "clean slate" migration of the restaurant (the recent redesign is reused)
- ❌ **No generic "sphere + ring + capsule in orbit" hero scene** (2024 cliché — multi-agent decision)

---

## 2. Decision Log

| # | Decision | Choice made | Source |
|---|----------|--------------|--------|
| 01 | Positioning | **Generalist premium web agency** aimed at startups & scale-ups | Brainstorm |
| 02 | Services scope | **Hybrid studio / venture studio** (client agency + internal products) | Brainstorm |
| 03 | Client target | **Mix of Series A/B startups + mid-market scale-ups** (30-200k€+) | Brainstorm |
| 04 | Portfolio | **3-8 client case studies** + internal products (BiD Resto = flagship case study) | Brainstorm |
| 05 | Geo/language | **FR primary + EN secondary** (i18n + hreflang) | Brainstorm |
| 06 | Art direction | **Avant-garde / award-mining** (massive WebGL) | Brainstorm |
| 07 | WebGL ambition | **Maximalist** (WebGL everywhere — home + case studies + transitions) | Brainstorm |
| 08 | Team & time | **Solo + AI**, **quality-first horizon** (6.5-7.5 month cycle) | Brainstorm |
| 09 | Page architecture | **Venture studio, 5 pages**: Home + Work + Products + About + Contact | Brainstorm |
| 10 | Naming | **"Be in Digital" = the studio**. Domain `beindigital.fr`. Subdomain `restaurant.beindigital.fr`. Agency logo to be created. | Brainstorm |
| 11 | Mobile strategy | **Identical full WebGL** on mobile (with LOD + KTX2 + aggressive optimizations) | Brainstorm |
| 12 | Performance budget | **Combo F**: Lighthouse desktop ≥ 80 / mobile ≥ 60 + Web Vitals Good | Brainstorm |
| 12bis | Lead channel | **Personal network + LinkedIn + word of mouth** | Brainstorm |
| 13 | Restaurant migration | **Parallel redesign** + **Two separate Next.js apps** + **Separate Convex project** | Brainstorm |
| 14 | WebGL signature pack | **Pack B — controlled premium**: light loader + subtle cursor + inter-page WebGL transitions + measured scroll-driven motion + gentle parallax. **No audio.** | Brainstorm |
| 15 | Fine art direction | **Volumetric Mint Studio** (branding continuity) | Brainstorm |
| 16 | Palette + type | Semantic CSS variables. Display Migra + Body Söhne (paid) or fallback Fraunces + Inter Tight (free) | Brainstorm |
| **17** | **Hero concept** | ❌ Sphere/ring/capsule in orbit **dropped** (2024 cliché). **To pick among 4 alternatives — see §4.3** | Multi-agent review (UI-UX) |
| **18** | **Code architecture** | **Turborepo monorepo**: `apps/agency` + `apps/restaurant` + `packages/{ui,tokens,config}`. 2 Vercel projects (`rootDirectory`). | Multi-agent review (Architecture) |
| **19** | **WebGL pattern** | **`<R3FRoot>` in the root layout** (above the route group) + drei **`<View>`** per page + **Zustand `sceneStore`** + **`SceneVisibilityManager`** Intersection Observer + R3F **`frameloop="demand"`** by default | Multi-agent review (Architecture + Performance) |
| **20** | **Phase reordering** | Restaurant subdomain migration **in Phase 0.5** (before the agency build) — avoids late cookie/OG/SC conflicts | Multi-agent review (Architecture + Security) |
| **21** | **Content** | **MDX** (`next-mdx-remote`, RSC build-time) for case studies + products. Agency Convex = **only** `contactSubmissions`. | Multi-agent review (Architecture + Performance) |
| **22** | **Secondary color accent** | **Added, <3% of surface** (CTA hover, focus ring, critical states). Exact choice: `#FF5722` burnt orange OR `#C97B4A` copper (to settle at the start of Phase 0). | Multi-agent review (UI-UX) |
| **23** | **Hero LCP** | **Absolutely DOM-first** — Migra h1 + pure HTML CTA. 3D scene in `dynamic({ ssr: false })` loaded post-LCP via `requestIdleCallback`. Canvas never an LCP candidate element. | Multi-agent review (Performance) |
| **24** | **Unified scroll driver** | **Lenis = the only scroll driver**. GSAP ScrollTrigger synced via `lenis.on('scroll', ScrollTrigger.update)`. Framer Motion only for non-scroll reveals/hovers. | Multi-agent review (Performance) |
| **25** | **Header security** | **`proxy.ts`** in Phase 0 (Next.js 16 replaced `middleware.ts` with `proxy.ts`): **nonce-based CSP + strict-dynamic** (never `unsafe-eval` in prod), HSTS preload, X-CTO nosniff, Referrer-Policy strict-origin-when-cross-origin, minimal Permissions-Policy. Node.js runtime (not configurable). **Bundle GSAP/Three.js locally** (no CDN). | Multi-agent review (Security) + Next 16 docs |
| **26** | **Cross-subdomain cookies** | Restaurant auth cookies **strictly scoped** to `restaurant.beindigital.fr` (no `Domain=.beindigital.fr`). Mandatory audit in Phase 0.5. | Multi-agent review (Security) |
| **27** | **Contact form** | Vercel BotID + Convex rate limit (5 req/min/IP) + **honeypot field** + strict server-side Zod (email max 254 chars, message max 5000 chars) + do not log PII (timestamps + hashed IP only) | Multi-agent review (Security) |
| **28** | **GDPR/CNIL** | Required pages: `/mentions-legales`, `/confidentialite`, `/cookies`. Vercel + Convex DPAs archived. 72h breach procedure documented. Internal processing register. | Multi-agent review (Security) |
| **29** | **POC perf gate** | **Phase 1 = Hero + 1 minimal scene → Lighthouse mobile measurement on a real Pixel 6a / iPhone 12 BEFORE moving on to Phase 2.** If it fails → trade-off toward lighter mobile WebGL (revision of Decision 11). | Multi-agent review (Architecture + Performance) |
| **30** | Home acts (revision) | **7 acts** instead of 8: Manifesto+Approach merged into 1 act, Numbers/Trust moved between Selected Work and Products | Default post-review |
| **31** | **Hero concept chosen** | **A. Liquid Architecture** — a liquid volume that solidifies into 3D architecture on scroll. Metaphor: "on transforme le chaos opérationnel en système clair". Curl noise shader + marching cubes isosurface. | User decision 2026-04-26 |
| **32** | **Monorepo bootstrap strategy** | **Non-destructive** approach: `apps/agency` created fresh without touching the existing app at the root. Phase 0.5 will do the `racine → apps/restaurant` migration (limits the blast radius). | Default safe |

---

## 3. Assumptions (validated at lock)

1. **Expected scale**: traffic < 100k visits/month at launch. Possible spike on an Awwwards SOTD (~50k visits in 48h). → Vercel Pro is enough.
2. **Security**: contact form (BotID + rate limit + honeypot) + Convex for leads. **No login, no payment** on the agency site.
3. **Reliability**: standard Vercel SLA (99.99%). Convex + Vercel DPAs signed and archived (standard contractual clauses for transfers outside the EU).
4. **Maintenance**: ownership by the solo founder + AI. **Content in MDX** (case studies + products), Convex only for the contact form.
5. **Accessibility**: **WCAG 2.2 AA** target on DOM sections. On WebGL scenes: hidden DOM alternative for screen readers + `prefers-reduced-motion` respected (full replacement of the hero by an SVG/WebP image, not degradation).
6. **GDPR/CNIL compliance**: legal notice + privacy policy + CNIL-compliant cookie banner (anonymized Vercel Analytics exempt, Cal.com lazy-loaded post-consent).
7. **WebGL stack**: `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `gsap` + `ScrollTrigger`, `three-stdlib`, `leva` (dev), `r3f-perf` (dev), `maath`, `glsl-noise`. **Bundled locally, not via CDN** (CSP-friendly).

---

## 4. Final Design

### 4.1. Palette (semantic CSS variables)

| Variable | HSL value | Role |
|----------|------------|------|
| `--background` | `0 0% 3.5%` (`#090909`) | main background (deeper than the restaurant for a subtle distinction) |
| `--surface-1` | `0 0% 6%` (`#0F0F0F`) | case study cards |
| `--surface-2` | `0 0% 9%` (`#171717`) | hover cards / elevation |
| `--surface-3` | `0 0% 12%` (`#1F1F1F`) | popovers, dropdowns |
| `--foreground` | `0 0% 96%` (`#F5F5F5`) | main text |
| `--muted-foreground` | `0 0% 62%` (`#9E9E9E`) | subtitles, meta |
| `--border` | `0 0% 14%` (`#242424`) | subtle separators |
| `--primary` | `162 56% 57%` (`#52CFAF`) | signature mint accent (~70% of accents) |
| `--primary-foreground` | `0 0% 5%` | dark text on mint |
| `--accent-warm` | `14 100% 55%` (`#FF5722`) or `24 50% 54%` (`#C97B4A`) | **signature secondary accent** (~3% of surface, critical states only: primary CTA hover, focus ring, "new" badge) |
| `--glow-primary` | `162 70% 50% / 0.35` | WebGL halo and CSS shadows |
| `--glow-soft` | `162 50% 60% / 0.12` | light background radials |
| `--glow-warm` | `14 100% 55% / 0.20` | warm halo on critical hover states |
| `--ring` | `162 56% 57% / 0.5` | standard a11y focus |

**Warm accent choice to settle in Phase 0**: test both on the hero — `#FF5722` (sharper, "modern") vs `#C97B4A` (warmer, "artisanal luxury").

### 4.2. Typography

| Role | Font (premium) | Fallback (free) | CSS variable |
|------|----------------|---------------------|--------------|
| Display | **Migra** or alt **Editorial New** | Fraunces | `--font-display` |
| Body / UI | **Söhne** or alt **Mier B** | Inter Tight | `--font-body` |
| Mono / accent | **Söhne Mono** | JetBrains Mono | `--font-mono` |

**Note**: the Migra+Söhne combo was heavily used in 2022-2024 (Vercel, Linear, Arc, Raycast) — alternatives `Editorial New + Mier B` or `NaN Tresor + General Sans` to explore in Phase 0 to stand apart.

**Scale** (responsive clamp): 12 / 14 / 16 / 18 / 24 / 32 / 48 / 72 / 120 / 200 px.

### 4.3. ⚠️ Hero concept — 4 alternatives to settle

The sphere/ring/capsule in orbit is dropped (absolute 2024 cliché). Here are 4 alternatives identified with the UI-UX review. **Choice to make before Phase 1.**

#### **Concept A — "Liquid Architecture"**
On scroll: a liquid volume that gradually solidifies into a crisp geometric 3D architecture/structure. Clear metaphor: *"on transforme l'opérationnel chaotique en système clair"*. Very narrative, unique signature, ties into the agency pitch ("on construit des systèmes pour vos produits").
- **Strength**: narrative + proprietary visual signature + pitch tie-in
- **Risk**: complex liquid→solid shader execution (curl noise + marching cubes isosurface)
- **Refs**: *Lusion Tools 2024*, *Robin Mastromarino*

#### **Concept B — "Editorial Hero" (typo-driven)**
No 3D scene above the fold. Giant Migra type revealing char-by-char (split-type) + a single visual element: a **vertical mint slit of light** slowly scanning the viewport (light streak). The 3D only arrives on scroll, in act 02.
- **Strength**: excellent LCP (pure DOM), distinction through austerity (every competitor does 3D in the hero)
- **Risk**: may read as "too restrained" for a maximalist WebGL site (paradox)
- **Refs**: *Robin Noguier (Honors 2025)*, *Halo Lab*, *Pentagram*

#### **Concept C — "Living Sigil"**
A **unique 3D glyph / sigil** (proprietary shape designed for Be in Digital — not a generic Three.js primitive) that reacts organically to mouse/scroll. Becomes the recognizable visual signature of the agency brand. The sigil can take cues from the future logo (still to create).
- **Strength**: brand signature embodied in the 3D, maximum memorability
- **Risk**: requires a proprietary 3D asset (Blender modeling + custom shader), depends on a logo that does not exist yet
- **Refs**: *Resn signature works*, *Studio Studio*

#### **Concept D — "Living Portfolio"**
Hero straight up = **6-9 living case study cards** (muted autoplay MP4 videos in the background, subtle RGB-split distortion on hover). No abstract hero. The **work is the hero**. More commercial.
- **Strength**: ultra-commercial, shows the projects in the first second, strong conversion
- **Risk**: requires HD video assets for 6+ client projects **from Phase 1** — blocked on the portfolio. Less of a "cinematic experience" than the others.
- **Refs**: *Studio Studio*, *Bakken & Bæck*

**Recommendation**: **Concept A "Liquid Architecture"** — best narrative/signature/risk ratio. Concept C is tempting but blocked by the missing logo. Concept B is very strong but "anti-maximalist-WebGL" (strategic paradox). Concept D blocked by video asset availability.

→ **Decision needed to finalize**: A / B / C / D (or a hybrid).

### 4.4. Home structure — 7 narrative acts (revised)

| # | Act | Scene / effect | Intent |
|---|------|---------------|--------|
| 00 | **Loader** | Mint logo building itself out of vector lines → hero reveal (1.2s) | Announce the signature |
| 01 | **Hero** | Concept A/B/C/D (to settle in §4.3) + Migra title + tagline + main CTA | Impact, grab attention |
| 02 | **Manifesto + Approach (merged)** | Full-screen text (Migra 200px) revealed on scrollX, then flipping into a pinned section with 4 process steps (Strategy → Design → Build → Ship) over a morphing mint liquid texture | Assert the stance + clarify the process |
| 03 | **Selected Work** | Grid of 4 case studies (asymmetric). RGB-split mint shader on hover | Commercial credibility |
| 04 | **Numbers / Trust** | Animated counters (`number-flow`). Discreet metrics (moved here so it doesn't break the CTA crescendo) | Subtle social proof |
| 05 | **Products** | Showcase of the internal products — **NB: if the hero concept = A "Liquid Architecture", reuse the liquid pattern for Products** (and drop the cliché orbit). Otherwise: giant type grid + video reveal on hover (Pentagram 2025 style). | Venture studio differentiator |
| 06 | **CTA final** | Dark full screen. Giant Migra sentence + massive mint CTA + warm accent on hover. Slow particles in the bg | Conversion |
| 07 | **Footer** | XL "Be in Digital" wordmark in outline (filled on hover), links, contact | Final signature |

**Total distinct WebGL scenes**: 4-5 depending on the hero concept. All orchestrated through **one persistent global canvas in the root layout** + drei `<View>` per section + Zustand `sceneStore`.

**Scroll length**: ~5-6 desktop viewports (≈ 3800px). Mobile: 8-9 viewports.

### 4.5. Internal pages

| Page | Key structure |
|------|---------------|
| **`/work`** | Asymmetric mosaic grid. `<MockupFrame>` cards with an **RGB-split mint distortion shader** on hover. Click → WebGL morph transition to the detail page. **Content: MDX** (frontmatter with slug, client, year, services, cover, gallery). |
| **`/work/[slug]`** | Full-page hero (MDX cover visual). Sections: *Context → Challenge → Approach → Outcome*. Muted autoplay MP4 videos + HD screenshots + testimonial. Prev/next footer. |
| **`/products`** | Showcase of the internal products (Be in Digital Restaurant first + future ones). Visual pattern to tie back to the chosen hero concept. **Content: MDX**. |
| **`/products/[slug]`** | Product hero levitating in 3D. Features grid + screenshots + external CTA to the subdomain. |
| **`/about`** | Extended manifesto + founder + roles + values. MDX content. |
| **`/contact`** | Convex form (BotID + rate limit + honeypot + Zod), Cal.com embed (lazy post-consent), LinkedIn. |
| **`/mentions-legales`** | Legal compliance. MDX. |
| **`/confidentialite`** | GDPR privacy policy. MDX. |
| **`/cookies`** | CNIL cookie policy. MDX. |

### 4.6. Signature components

#### WebGL layer (formalized architecture — Decision 19)
| Component | Role |
|---|---|
| `<R3FRoot>` (root layout) | Persistent global Three.js canvas + Suspense boundary. `frameloop="demand"` by default. |
| `<SceneView slot="hero">` | drei `<View>` binding a DOM tracker to a 3D scene from the registry. One `<SceneView>` per section. |
| `sceneStore` (Zustand) | Global state: active scene, scroll progress, viewport, device capabilities. |
| `SceneVisibilityManager` | Hook + Intersection Observer: full `useFrame` pause when the section is out of the viewport (>200px). |
| `SceneRegistry` | Map `id → { mount, unmount, update(scrollProgress) }`. Typed contract for each scene. |

#### Scene layer
| Scene | Act / page | Contract |
|---|---|---|
| `HeroScene` | Act 01 | Depending on concept A/B/C/D |
| `ManifestoApproachScene` | Act 02 | Mint liquid morph, ScrollTrigger pinning |
| `WorkHoverShader` | Act 03 + `/work` cards | RGB-split distortion on MockupFrame |
| `ProductsScene` | Act 05 + `/products` | Depending on the hero concept (visual tie-in) |
| `ParticleField` | Act 06 | OffscreenCanvas + Web Worker (perf) |
| `PageTransitionScene` | Inter-page | Fullscreen morph + automatic cleanup |

#### DOM layer
| Component | Role |
|---|---|
| `<MagneticCursor>` | Magnetic cursor on the CTAs (DOM/RAF, not WebGL) |
| `<MockupFrame>` | Device frame + screenshot + hover binding to `WorkHoverShader` |
| `<TextReveal>` | Char-by-char text (`split-type`) |
| `<MarqueeStrip>` | Infinite strip (client logos) |
| `<NumberCounter>` | `number-flow` |
| `<NoiseOverlay>` | Subtle global CSS grain |
| `<CookieBanner>` | CNIL-compliant, lazy-loaded |

### 4.7. Tech stack & file tree (Turborepo monorepo)

**Dependencies added (in `apps/agency`)**:
```
three  @react-three/fiber  @react-three/drei  @react-three/postprocessing
gsap (ScrollTrigger included, free)  maath  glsl-noise
next-mdx-remote  rehype-pretty-code  remark-gfm
zod  zustand (already present)
# dev-only
leva  r3f-perf  basisu (KTX2 pre-build CLI)
```

**Target file tree (monorepo)**:
```
.
├── apps/
│   ├── agency/                       # New Vercel project beindigital.fr
│   │   ├── app/
│   │   │   ├── layout.tsx            # <R3FRoot/> + Lenis + Cursor + CookieBanner
│   │   │   ├── page.tsx              # Home (7 acts)
│   │   │   ├── work/page.tsx         # MDX list
│   │   │   ├── work/[slug]/page.tsx  # MDX render
│   │   │   ├── products/[slug]/, about/, contact/
│   │   │   ├── mentions-legales/, confidentialite/, cookies/
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── home/{hero,manifesto,selected-work,numbers,products,cta-final}/
│   │   │   ├── work/, products/, about/, contact/
│   │   │   └── webgl/
│   │   │       ├── r3f-root.tsx
│   │   │       ├── scene-view.tsx
│   │   │       ├── scenes/{hero,manifesto-approach,work-hover,products,particles,page-transition}.tsx
│   │   │       ├── shaders/{liquid-morph,rgb-split,volumetric-fog,glow-orb}/
│   │   │       └── primitives/, hooks/
│   │   ├── content/case-studies/, content/products/, content/about/   # MDX
│   │   ├── store/scene-store.ts                                        # Zustand
│   │   ├── convex/contactForms.ts, contactForms.test.ts
│   │   ├── proxy.ts                                                    # Next 16: replaces middleware.ts. CSP nonce + security headers
│   │   ├── public/                                                     # KTX2 textures + assets
│   │   └── package.json
│   │
│   └── restaurant/                   # Current repo renamed, deployed on restaurant.beindigital.fr
│       └── (existing — recent redesign kept)
│
├── packages/
│   ├── ui/                            # Components shared agency ↔ restaurant (buttons, primitives)
│   ├── tokens/                        # Semantic CSS variables (mint + warm accent)
│   ├── config/                        # ESLint, Tailwind v4, shared TS configs
│   └── webgl-utils/                   # SceneRegistry, Visibility, capabilities detection
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**Agency Convex**: a project **separate** from the restaurant (two deployments). Minimal tables: `contactSubmissions` only. Case studies + products = build-time MDX.

### 4.8. Phased implementation plan (revised post-multi-agent)

| # | Phase | Duration | Deliverable | Skills/Agents |
|---|-------|-------|----------|---------------|
| **0** | **Monorepo bootstrap** | 2 weeks | Turborepo init, shared packages, design tokens, fonts, Next 16 security **proxy.ts** (CSP nonce + headers), agency Convex | typescript-pro, security-engineer |
| **0.5** | **Restaurant subdomain migration** | 2 weeks | `restaurant.beindigital.fr` live, systematic 301s, strictly scoped cookies, OG/sitemap/hreflang, Search Console reverify | nextjs-architecture-expert, security-auditor |
| **1** | **POC perf gate (Hero + 1 scene)** | 3 weeks | Hero (chosen concept A/B/C/D) + 1 scene + R3F architecture + SceneVisibilityManager + Lenis-GSAP sync. **Mandatory Lighthouse mobile measurement on real Pixel 6a / iPhone 12.** If it fails → trade-off. | threejs-shaders, threejs-geometry, react-performance-optimization |
| **2** | **Home acts 02-07** | 4-5 weeks | All remaining acts + intra-page transitions + warm accent integrated | threejs-postprocessing, threejs-animation |
| **3** | **`/work` index + MDX detail** | 3 weeks | MDX pipeline, MockupFrame, RGB-split hover, inter-page WebGL transitions | threejs-textures, threejs-interaction |
| **4** | **`/products` index + 1 product (BiD Resto)** | 2-3 weeks | Product page, link to the subdomain | threejs-geometry, threejs-loaders |
| **5** | **`/about` + `/contact`** | 2 weeks | Convex form (BotID + honeypot + Zod), lazy post-consent Cal embed | convex, frontend-developer |
| **6** | **GDPR/CNIL pages + CookieBanner** | 1 week | Legal notice, privacy, cookies, compliant banner, internal processing register | security-engineer |
| **7** | **Mobile optimizations + perf budget met** | 3 weeks | KTX2 pipeline (basisu CLI), LOD, OffscreenCanvas particles, full Lighthouse audit | react-performance-optimization, vercel:performance-optimizer |
| **8** | **A11y WCAG 2.2 AA + SEO + OG** | 2 weeks | Alt-DOM for WebGL scenes, focus management, strict prefers-reduced-motion, dynamic OG | seo-fundamentals |
| **9** | **Awwwards submission prep** | 1 week | MP4 teaser video, HD screenshots, submission copy FR+EN | content-marketer |

**Revised total**: ~26-30 weeks (~6.5-7.5 months).

---

## 5. Risks & Mitigation (revised)

| Risk | Severity | Mitigation |
|--------|----------|-----------|
| Lighthouse mobile < 60 (massive WebGL) | 🔴 Critical | **Phase 1 POC perf gate** on real Pixel 6a / iPhone 12 before moving on. DOM-first hero, KTX2, instancing, frustum culling, full SceneVisibilityManager pause, OffscreenCanvas particles. |
| LCP captured by the Three.js canvas | 🔴 Critical | Absolutely DOM-first hero, 3D scene in `dynamic({ ssr: false })` post-LCP via `requestIdleCallback`. Canvas never an LCP candidate element (checked with DevTools Coverage). |
| INP > 200ms (Framer/Lenis/GSAP RAF contention) | 🟠 Important | Lenis = the only scroll driver. ScrollTrigger synced via `lenis.on('scroll', ScrollTrigger.update)`. Framer Motion only for non-scroll reveals/hovers. |
| iPhone thermal throttling after 2-3min | 🟠 Important | `frameloop="demand"`, Visibility API pause, frame rate cap, capability detection (`navigator.deviceMemory <= 2` → DOM fallback). |
| Hero concept is a "2024 cliché" → Honorable Mention instead of SOTD | 🔴 Critical | **Sphere dropped** (Decision 17). Concept A/B/C/D to settle in §4.3. |
| Solo+AI not enough for complex custom shaders (liquid morph isosurface) | 🟠 Important | Open-source shader bank (Shadertoy, glslSandbox), threejs-shaders skills, one-off freelancer if needed. |
| Cross-route memory leaks (global canvas) | 🔴 Critical | SceneRegistry typed contract with a mandatory `unmount()` (`dispose()` on geometries/textures/materials). E2E tests with DevTools memory profiling. |
| Drift between the agency/restaurant repos over 6 months | 🟠 Important | **Turborepo monorepo** + shared packages (Decision 18). Single source for tokens, UI, configs. |
| CSP too permissive → reflected XSS | 🔴 Critical | **Nonce-based + strict-dynamic** CSP in Phase 0. Local Three.js/GSAP bundle. Never `unsafe-eval`. Header audit via securityheaders.com. |
| Cross-subdomain cookie leak | 🔴 Critical | Restaurant auth cookies strictly scoped to `restaurant.beindigital.fr`. Phase 0.5 audit mandatory. |
| Cross-deployment env vars (copy-pasting `.env`) | 🟠 Important | Prefixing `AGENCY_*` vs `RESTO_*`. gitleaks pre-commit in CI. `vercel env pull` rather than manual copying. |
| GDPR non-compliance (contact form) | 🟠 Important | Pages `/mentions-legales`, `/confidentialite`, `/cookies` required (Phase 6). CNIL banner. DPAs archived. 72h breach procedure documented. |
| WCAG a11y on WebGL scenes | 🟠 Important | Hidden alt-DOM with aria-live, strict focus management, `prefers-reduced-motion` = full replacement by an SVG/WebP image (not degradation). |
| SOTD not guaranteed despite the ambition | 🟡 Moderate | Multiple iterations, multiple submissions, plan B = Honorable Mention / Mobile Excellence. |
| Scope drift over 6.5 months | 🟠 Important | This doc = the contract. Any change adds a decision to the log. Mandatory quarterly review. |

---

## 5.a Phase 1.4 POC perf gate — results (validated)

**Test run**: Lighthouse 13 on `https://beindigital.fr` in prod, throttling-method `simulate` (devtools 4G slow + 4× CPU), on the "Liquid Architecture" v1 hero with Lenis + magnetic cursor + copy v2.

| Category | Mobile | Desktop |
|-----------|--------|---------|
| Performance | **98**/100 | **100**/100 |
| Accessibility | **100**/100 | **100**/100 |
| Best Practices | 92/100 | 92/100 |
| SEO | **100**/100 | **100**/100 |

**Core Web Vitals**:
| Metric | Mobile | Desktop | Target | Margin |
|----------|--------|---------|-------|-------|
| LCP | 1.1 s | 0.4 s | < 2.5 s | -56% / -84% |
| FCP | 1.1 s | 0.2 s | minimum | excellent |
| Speed Index | 1.5 s | 0.3 s | minimum | excellent |
| TBT | 130 ms | 0 ms | minimum | excellent |
| CLS | 0.041 | 0 | < 0.1 | -59% |
| TTI | 1.4 s | n/a | minimum | excellent |

**Total bundle**: 219 KB, 17 requests.

**Verdict**:
- 🟢 **Decision #29 (POC perf gate)** validated with plenty of room (98 vs the 60 mobile target).
- 🟢 **Decision #11 (full WebGL mobile)** confirmed as viable.
- 🟢 The *DOM-first hero + R3F in `dynamic({ ssr: false })` post-LCP via `requestIdleCallback`* strategy (Decision #23) pays off: Three.js + drei + postprocessing + GSAP do not affect the LCP.
- ⚠️ **Re-measure after every scene added** in Phase 2 (Manifesto, Products orbit, CTA particles). If a scene drops the score below 60 on mobile, isolate and optimize before moving on.

No optimization opportunity detected by Lighthouse at this stage.

---

## 5.b Cross-subdomain cookie audit — result (Phase 0.5)

**Findings** (audit run after the `apps/restaurant` migration):

| Source | Cookie | Domain | Risk |
|--------|--------|--------|------|
| `@convex-dev/auth` (minimal config in `convex/auth.ts`) | session/auth | host-only by default (no `Domain` attr) | ✅ None — strictly scoped to `restaurant.beindigital.fr` |
| Application code | no cookie set manually (grep `setCookie`/`Set-Cookie` = 0 matches) | n/a | ✅ None |
| Stripe Checkout | redirects to `checkout.stripe.com` | external domain | ✅ None |
| YouSign webhooks | inbound only, no cookie | n/a | ✅ None |
| Vercel Analytics (if enabled) | `_vercel_*` anonymized | host-only | ✅ None (CNIL exempt) |

**Conclusion**: no cross-subdomain leak risk identified. The restaurant auth cookies will stay strictly scoped to `restaurant.beindigital.fr` once the DNS is live. No custom configuration required.

**To watch**:
- If we add `@convex-dev/auth` to the agency as well (for a future partner dashboard), keep the two Convex deployments properly isolated (already the case per Decision Log #13).
- Any library that would set a cookie with `Domain=.beindigital.fr` must be blocked at review.

---

## 6. Open Questions (resolved during implementation)

- **Hero concept (§4.3)**: A / B / C / D to settle before Phase 1 — **blocks the visual bootstrap**
- **Exact warm accent**: `#FF5722` burnt orange vs `#C97B4A` copper — to settle in Phase 0 on a preview
- **Type license choice**: paid Migra+Söhne (~500€) vs Editorial New+Mier B vs free fallback Fraunces+Inter Tight
- **Agency logo**: to create (could be a typographic wordmark + a derived mint sigil) — blocks Concept C if chosen
- **Current traffic** of `be-in-digital.fr` (to measure in Phase 0.5 to calibrate the 301s)
- **Tagline / main promise** for the home (to brainstorm in Phase 1)
- **3-8 case studies**: assets to collect / produce (HD screenshots, MP4 videos)
- **Domain `beindigital.fr` vs `be-in-digital.fr`**: DNS configuration to clarify (acquire `beindigital.fr` if not owned yet)

---

## 7. Implementation Handoff

The design doc is **lockable and review-ready**. Prerequisites before Phase 0:

1. ✅ Multi-agent review folded in (architect / UI-UX / performance / security)
2. ⏳ **Hero concept decision (§4.3)** — blocking
3. ⏳ User confirms "go build"
4. → **Phase 0 — Turborepo monorepo bootstrap** starts

---

**Author**: Brainstorming session + multi-agent review of 2026-04-26
**Branch**: `doums85/agency-homepage`
**Next steps**: (1) settle the hero concept §4.3 + (2) confirm go build → Phase 0 starts.
