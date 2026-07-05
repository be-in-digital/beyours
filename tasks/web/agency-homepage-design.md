# Be in Digital — Homepage Agency Redesign

> **Document de design** issu d'une session de brainstorming structuré (skill `brainstorming`) + multi-agent review (architect / UI-UX / performance / security).
> Sert de référence centrale pour la phase d'implémentation.
>
> **Statut** : ✅ Lock final + multi-agent review intégrée. **1 décision résiduelle** (concept hero — voir §4.3).
> **Branche** : `doums85/agency-homepage`
> **Cible** : Awwwards SOTD (Site of the Day)
> **Cycle estimé** : ~26-30 semaines (~6.5-7.5 mois) en cycle solo + IA, post-révision

---

## 1. Understanding Summary

### Quoi est construit
Un **nouveau site agence "Be in Digital"** sur `beindigital.fr` — site vitrine premium award-worthy, **5 pages** (Home, Work, Products, About, Contact), expérience **WebGL cinématographique de bout en bout**.

En parallèle, le site restaurant actuel migre vers `restaurant.beindigital.fr` (refonte cosmétique légère pour cohérence visuelle, pas refonte from scratch — la refonte premium dark-luxury est déjà faite cf. commit `979a97b`).

**Architecture code** : monorepo **Turborepo** (`apps/agency` + `apps/restaurant` + `packages/{ui,tokens,config}`), 2 projets Vercel séparés.

### Pourquoi
Repositionner Be in Digital comme **studio venture premium** orienté startups & scale-ups. Le produit resto devient un *case study/produit phare* du studio plutôt que l'unique offre. Maximiser visibilité via Awwwards + LinkedIn + bouche-à-oreille.

### Pour qui
- **Cible commerciale agence** : founders/decision makers de startups Series A/B et scale-ups mid-market FR (puis EN à l'international). Tickets 30-200k€+.
- **Cible perception** : jury Awwwards + communauté creative tech.

### Contraintes-clés
- Solo founder + IA comme dev principal — pas de deadline, qualité prime
- Stack imposée : **Next.js 16 + React 19 + Tailwind v4 + Convex + Framer Motion + Lenis** (déjà en place)
- À ajouter : **React Three Fiber + drei + GSAP ScrollTrigger + post-processing**
- **Perf** : Lighthouse desktop ≥ 80 / mobile ≥ 60, Core Web Vitals **Good** obligatoires (LCP < 2.5s, INP < 200ms, CLS < 0.1) — atteignable mais tendu (verdict perf agent)
- **Mobile** : full WebGL avec LOD agressif (KTX2, instancing, frustum culling, SceneVisibilityManager)
- **Branding** : palette mint/dark + **accent secondaire signature à choisir** (orange brûlé ou cuivré, <3% surface)

### Non-goals explicites
- ❌ Pas de scroll-jacking lourd (scroll natif respecté via Lenis seul driver)
- ❌ Pas d'audio (décision conservée — clean B2B FR)
- ❌ Pas de SEO-first au launch (réseau LinkedIn = canal lead #1)
- ❌ Pas de pages services détaillées séparées
- ❌ Pas de blog/journal au launch
- ❌ Pas de recrutement/careers
- ❌ Pas d'i18n complète au launch (FR primaire, EN à venir en phase 2)
- ❌ Pas de migration "clean slate" du resto (réutilisation refonte récente)
- ❌ **Pas de scène hero "sphère + ring + capsule en orbite" générique** (cliché 2024 — décision multi-agent)

---

## 2. Decision Log

| # | Décision | Choix retenu | Source |
|---|----------|--------------|--------|
| 01 | Positionnement | **Agence web premium généraliste** orientée startups & scale-ups | Brainstorm |
| 02 | Scope services | **Studio hybride / venture studio** (agence client + produits internes) | Brainstorm |
| 03 | Cible client | **Mix Startups Series A/B + Scale-ups mid-market** (30-200k€+) | Brainstorm |
| 04 | Portfolio | **3-8 case studies clients** + produits internes (BiD Resto = case study phare) | Brainstorm |
| 05 | Géo/langue | **FR primaire + EN secondaire** (i18n + hreflang) | Brainstorm |
| 06 | Direction artistique | **Avant-gardiste / Award-mining** (WebGL massif) | Brainstorm |
| 07 | Ambition WebGL | **Maximaliste** (WebGL partout — home + case studies + transitions) | Brainstorm |
| 08 | Équipe & temps | **Solo + IA**, **horizon qualité prime** (cycle 6.5-7.5 mois) | Brainstorm |
| 09 | Architecture pages | **Studio venture, 5 pages** : Home + Work + Products + About + Contact | Brainstorm |
| 10 | Naming | **"Be in Digital" = studio**. Domaine `beindigital.fr`. Sous-domaine `restaurant.beindigital.fr`. Logo agence à créer. | Brainstorm |
| 11 | Stratégie mobile | **Full WebGL identique** sur mobile (avec LOD + KTX2 + optims agressives) | Brainstorm |
| 12 | Performance budget | **Combo F** : Lighthouse desktop ≥ 80 / mobile ≥ 60 + Web Vitals Good | Brainstorm |
| 12bis | Canal lead | **Réseau perso + LinkedIn + bouche-à-oreille** | Brainstorm |
| 13 | Migration resto | **Refonte parallèle** + **Deux apps Next.js séparées** + **Convex projet séparé** | Brainstorm |
| 14 | Pack signature WebGL | **Pack B — Premium contrôlé** : loader léger + cursor subtil + transitions WebGL inter-pages + scroll-driven mesuré + parallax doux. **Pas d'audio.** | Brainstorm |
| 15 | Direction artistique fine | **Volumetric Mint Studio** (continuité branding) | Brainstorm |
| 16 | Palette + typo | Variables CSS sémantiques. Display Migra + Body Söhne (payant) ou fallback Fraunces + Inter Tight (gratuit) | Brainstorm |
| **17** | **Concept hero** | ❌ Sphère/ring/capsule en orbite **abandonné** (cliché 2024). **À choisir parmi 4 alternatives — voir §4.3** | Multi-agent review (UI-UX) |
| **18** | **Architecture code** | **Monorepo Turborepo** : `apps/agency` + `apps/restaurant` + `packages/{ui,tokens,config}`. 2 projets Vercel (`rootDirectory`). | Multi-agent review (Architecture) |
| **19** | **Pattern WebGL** | **`<R3FRoot>` dans root layout** (au-dessus du group route) + drei **`<View>`** par page + **Zustand `sceneStore`** + **`SceneVisibilityManager`** Intersection Observer + R3F **`frameloop="demand"`** par défaut | Multi-agent review (Architecture + Performance) |
| **20** | **Réordre phases** | Migration sous-domaine resto **en Phase 0.5** (avant build agence) — évite conflits cookies/OG/SC tardifs | Multi-agent review (Architecture + Security) |
| **21** | **Content** | **MDX** (`next-mdx-remote`, RSC build-time) pour case studies + products. Convex agence = **uniquement** `contactSubmissions`. | Multi-agent review (Architecture + Performance) |
| **22** | **Accent couleur secondaire** | **Ajouté <3% surface** (hover CTA, focus ring, états critiques). Choix précis : `#FF5722` orange brûlé OU `#C97B4A` cuivré (à trancher en début Phase 0). | Multi-agent review (UI-UX) |
| **23** | **Hero LCP** | **DOM-first absolu** — h1 Migra + CTA HTML pur. Scène 3D en `dynamic({ ssr: false })` chargée post-LCP via `requestIdleCallback`. Canvas jamais élément LCP candidat. | Multi-agent review (Performance) |
| **24** | **Scroll driver unifié** | **Lenis = seul driver scroll**. GSAP ScrollTrigger sync via `lenis.on('scroll', ScrollTrigger.update)`. Framer Motion uniquement pour reveals/hovers non-scroll. | Multi-agent review (Performance) |
| **25** | **Sécurité headers** | **`proxy.ts`** Phase 0 (Next.js 16 a remplacé `middleware.ts` par `proxy.ts`) : **CSP nonce-based + strict-dynamic** (jamais `unsafe-eval` en prod), HSTS preload, X-CTO nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy minimal. Runtime nodejs (non configurable). **Bundler GSAP/Three.js localement** (pas CDN). | Multi-agent review (Security) + Next 16 docs |
| **26** | **Cookies cross-subdomain** | Cookies auth resto **strictement scopés** sur `restaurant.beindigital.fr` (pas de `Domain=.beindigital.fr`). Audit obligatoire en Phase 0.5. | Multi-agent review (Security) |
| **27** | **Form contact** | BotID Vercel + rate limit Convex (5 req/min/IP) + **honeypot field** + Zod stricte server-side (email max 254 chars, message max 5000 chars) + ne pas logger PII (juste timestamps + IP hashée) | Multi-agent review (Security) |
| **28** | **GDPR/CNIL** | Pages obligatoires : `/mentions-legales`, `/confidentialite`, `/cookies`. DPA Vercel + Convex archivés. Procédure breach 72h documentée. Registre traitements interne. | Multi-agent review (Security) |
| **29** | **POC perf gate** | **Phase 1 = Hero + 1 scène minimal → mesure Lighthouse mobile sur Pixel 6a / iPhone 12 réel AVANT d'enchaîner Phase 2.** Si fail → arbitrage WebGL allégé mobile (révision Décision 11). | Multi-agent review (Architecture + Performance) |
| **30** | Actes Home (révision) | **7 actes** au lieu de 8 : fusion Manifesto+Approach en 1 acte, Numbers/Trust déplacé entre Selected Work et Products | Default post-review |
| **31** | **Concept Hero retenu** | **A. Liquid Architecture** — volume liquide qui se solidifie en architecture 3D au scroll. Métaphore : "on transforme le chaos opérationnel en système clair". Shader curl noise + isosurface marching cubes. | User decision 2026-04-26 |
| **32** | **Stratégie monorepo bootstrap** | Approche **non-destructive** : `apps/agency` créé neuf sans toucher l'app existante à la racine. Phase 0.5 fera la migration `racine → apps/restaurant` (limite le blast radius). | Default safe |

---

## 3. Assumptions (validées au lock)

1. **Scale attendue** : trafic < 100k visites/mois au launch. Pic possible si Awwwards SOTD (~50k visites en 48h). → Vercel Pro suffit.
2. **Sécurité** : formulaire contact (BotID + rate limit + honeypot) + Convex pour leads. **Pas de login, pas de paiement** sur site agence.
3. **Reliability** : SLA standard Vercel (99.99%). DPA Convex + Vercel signés et archivés (clauses contractuelles types pour transferts hors UE).
4. **Maintenance** : ownership solo founder + IA. **Content en MDX** (case studies + products), Convex uniquement pour form contact.
5. **Accessibilité** : objectif **WCAG 2.2 AA** sur sections DOM. Sur scènes WebGL : alternative DOM cachée pour screen readers + respect `prefers-reduced-motion` (remplacement total par image SVG/WebP du hero, pas dégradation).
6. **Conformité GDPR/CNIL** : mention légale + politique conf. + bannière cookies CNIL conforme (Vercel Analytics anonymisé exempté, Cal.com lazy-loaded post-consent).
7. **Stack WebGL** : `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `gsap` + `ScrollTrigger`, `three-stdlib`, `leva` (dev), `r3f-perf` (dev), `maath`, `glsl-noise`. **Bundlés localement, pas via CDN** (CSP-friendly).

---

## 4. Final Design

### 4.1. Palette (variables CSS sémantiques)

| Variable | Valeur HSL | Rôle |
|----------|------------|------|
| `--background` | `0 0% 3.5%` (`#090909`) | fond principal (plus profond que resto pour distinction subtile) |
| `--surface-1` | `0 0% 6%` (`#0F0F0F`) | cartes case study |
| `--surface-2` | `0 0% 9%` (`#171717`) | cartes hover / élévation |
| `--surface-3` | `0 0% 12%` (`#1F1F1F`) | popovers, dropdowns |
| `--foreground` | `0 0% 96%` (`#F5F5F5`) | texte principal |
| `--muted-foreground` | `0 0% 62%` (`#9E9E9E`) | sous-titres, méta |
| `--border` | `0 0% 14%` (`#242424`) | séparateurs subtils |
| `--primary` | `162 56% 57%` (`#52CFAF`) | accent mint signature (~70% des accents) |
| `--primary-foreground` | `0 0% 5%` | texte sombre sur mint |
| `--accent-warm` | `14 100% 55%` (`#FF5722`) ou `24 50% 54%` (`#C97B4A`) | **accent secondaire signature** (~3% surface, états critiques uniquement : hover CTA primaire, focus ring, badge "new") |
| `--glow-primary` | `162 70% 50% / 0.35` | halo WebGL et CSS shadows |
| `--glow-soft` | `162 50% 60% / 0.12` | radials légers de fond |
| `--glow-warm` | `14 100% 55% / 0.20` | halo warm sur états hover critiques |
| `--ring` | `162 56% 57% / 0.5` | focus a11y standard |

**Choix accent warm à trancher Phase 0** : tester les 2 sur le hero — `#FF5722` (plus tranchant, "moderne") vs `#C97B4A` (plus chaleureux, "luxe artisanal").

### 4.2. Typographie

| Rôle | Font (premium) | Fallback (gratuit) | Variable CSS |
|------|----------------|---------------------|--------------|
| Display | **Migra** ou alt **Editorial New** | Fraunces | `--font-display` |
| Body / UI | **Söhne** ou alt **Mier B** | Inter Tight | `--font-body` |
| Mono / accent | **Söhne Mono** | JetBrains Mono | `--font-mono` |

**Note** : combo Migra+Söhne très utilisé 2022-2024 (Vercel, Linear, Arc, Raycast) — alternative `Editorial New + Mier B` ou `NaN Tresor + General Sans` à explorer en Phase 0 pour démarquer.

**Échelle** (clamp responsive) : 12 / 14 / 16 / 18 / 24 / 32 / 48 / 72 / 120 / 200 px.

### 4.3. ⚠️ Concept Hero — 4 alternatives à trancher

La sphère/ring/capsule en orbite est abandonnée (cliché 2024 absolu). Voici 4 alternatives identifiées avec la review UI-UX. **Choix à faire avant Phase 1.**

#### **Concept A — "Liquid Architecture"**
Au scroll : un volume liquide qui se solidifie progressivement en architecture/structure 3D géométrique nette. Métaphore claire : *"on transforme l'opérationnel chaotique en système clair"*. Très narratif, signature unique, raccord avec le pitch agence ("on construit des systèmes pour vos produits").
- **Force** : narratif + signature visuelle propriétaire + raccord pitch
- **Risque** : exécution shader liquid→solid complexe (curl noise + isosurface marching cubes)
- **Refs** : *Lusion Tools 2024*, *Robin Mastromarino*

#### **Concept B — "Editorial Hero" (typo-driven)**
Pas de scène 3D au-dessus du fold. Typo géante Migra qui se révèle char-par-char (split-type) + un seul élément visuel : une **fente de lumière mint verticale** qui scanne lentement le viewport (light streak). La 3D arrive seulement au scroll, dans l'acte 02.
- **Force** : LCP excellent (DOM pur), distinction par austérité (tous les concurrents font 3D au hero)
- **Risque** : peut paraître "trop sobre" pour un site WebGL maximaliste (paradoxe)
- **Refs** : *Robin Noguier (Honors 2025)*, *Halo Lab*, *Pentagram*

#### **Concept C — "Living Sigil"**
Un **glyphe / sigil 3D unique** (forme propriétaire designée pour Be in Digital — pas une primitive Three.js générique) qui réagit organiquement à la souris/scroll. Devient signature visuelle reconnaissable de la marque agence. Le sigil peut s'inspirer du futur logo (à créer).
- **Force** : signature de marque incarnée dans la 3D, mémorabilité maximale
- **Risque** : nécessite un asset 3D propriétaire (modélisation Blender + custom shader), dépend du logo qui n'existe pas encore
- **Refs** : *Resn signature works*, *Studio Studio*

#### **Concept D — "Living Portfolio"**
Direct hero = **6-9 cards de case studies vivantes** (vidéos MP4 muted autoplay en background, distorsion subtile RGB-split au hover). Pas de hero abstrait. Le **travail est le hero**. Plus commercial.
- **Force** : ultra-commercial, montre les projets dès la 1ère seconde, conversion forte
- **Risque** : nécessite **dès Phase 1** des assets vidéo de 6+ projets clients en qualité HD — bloque sur portfolio. Moins "expérience cinématographique" que les autres.
- **Refs** : *Studio Studio*, *Bakken & Bæck*

**Recommandation** : **Concept A "Liquid Architecture"** — meilleur ratio narratif/signature/risque. Concept C est tentant mais bloqué par le logo absent. Concept B est très fort mais "anti-WebGL maximaliste" (paradoxe stratégique). Concept D bloqué par disponibilité assets vidéo.

→ **Décision attendue pour finaliser** : A / B / C / D (ou hybride).

### 4.4. Structure Home — 7 actes narratifs (révisée)

| # | Acte | Scène / Effet | Intent |
|---|------|---------------|--------|
| 00 | **Loader** | Logo mint qui se construit en lignes vectorielles → reveal hero (1.2s) | Annoncer la signature |
| 01 | **Hero** | Concept A/B/C/D (à trancher §4.3) + titre Migra + tagline + CTA principal | Impact, capter |
| 02 | **Manifesto + Approach (fusionné)** | Texte plein écran (Migra 200px) qui se révèle au scrollX, puis bascule en pinning section avec 4 étapes process (Strategy → Design → Build → Ship) sur texture liquide mint qui morph | Affirmer posture + clarifier process |
| 03 | **Selected Work** | Grid 4 case studies (asymétrique). Hover RGB-split mint shader | Crédibilité commerciale |
| 04 | **Numbers / Trust** | Compteurs animés (`number-flow`). Métriques discrètes (déplacé ici pour ne pas casser le crescendo CTA) | Preuve sociale subtile |
| 05 | **Products** | Présentation des produits internes — **NB : si Concept hero = A "Liquid Architecture", reprendre le pattern liquid pour Products** (et abandonner l'orbit cliché). Sinon : grille typo géante + reveal vidéo au hover (façon Pentagram 2025). | Différenciateur venture studio |
| 06 | **CTA final** | Plein écran sombre. Phrase Migra géante + CTA mint massif + accent warm sur hover. Particules lentes en bg | Conversion |
| 07 | **Footer** | Wordmark "Be in Digital" XL en outline (filled au hover), liens, contact | Signature finale |

**Total scènes WebGL distinctes** : 4-5 selon Concept hero. Toutes orchestrées via **un canvas global persistant dans root layout** + drei `<View>` par section + Zustand `sceneStore`.

**Longueur scroll** : ~5-6 viewports desktop (≈ 3800px). Mobile : 8-9 viewports.

### 4.5. Pages internes

| Page | Structure clé |
|------|---------------|
| **`/work`** | Grille mosaïque asymétrique. Cards `<MockupFrame>` avec hover **distortion shader RGB-split mint**. Click → transition WebGL morph vers détail. **Content : MDX** (frontmatter avec slug, client, year, services, cover, gallery). |
| **`/work/[slug]`** | Hero pleine page (visuel cover MDX). Sections : *Context → Challenge → Approach → Outcome*. Vidéos MP4 muted autoplay + screenshots HD + témoignage. Footer prev/next. |
| **`/products`** | Présentation des produits internes (Be in Digital Restaurant en 1er + futurs). Pattern visuel à raccorder au Concept hero choisi. **Content : MDX**. |
| **`/products/[slug]`** | Hero produit en lévitation 3D. Features grid + screenshots + CTA externe vers sous-domaine. |
| **`/about`** | Manifesto étendu + founder + roles + valeurs. Content MDX. |
| **`/contact`** | Form Convex (BotID + rate limit + honeypot + Zod), Cal.com embed (lazy post-consent), LinkedIn. |
| **`/mentions-legales`** | Conformité légale. MDX. |
| **`/confidentialite`** | Politique de confidentialité GDPR. MDX. |
| **`/cookies`** | Politique cookies CNIL. MDX. |

### 4.6. Composants signature

#### Couche WebGL (architecture formalisée — Décision 19)
| Composant | Rôle |
|---|---|
| `<R3FRoot>` (root layout) | Canvas Three.js global persistant + Suspense boundary. `frameloop="demand"` par défaut. |
| `<SceneView slot="hero">` | drei `<View>` qui bind un DOM tracker à une scène 3D du registry. Une `<SceneView>` par section. |
| `sceneStore` (Zustand) | État global : scène active, scroll progress, viewport, capabilities device. |
| `SceneVisibilityManager` | Hook + Intersection Observer : pause `useFrame` complet quand section hors viewport (>200px). |
| `SceneRegistry` | Map `id → { mount, unmount, update(scrollProgress) }`. Contrat typé pour chaque scène. |

#### Couche scènes
| Scène | Acte / Page | Contrat |
|---|---|---|
| `HeroScene` | Acte 01 | Selon Concept A/B/C/D |
| `ManifestoApproachScene` | Acte 02 | Liquid morph mint, pinning ScrollTrigger |
| `WorkHoverShader` | Acte 03 + `/work` cards | RGB-split distortion sur MockupFrame |
| `ProductsScene` | Acte 05 + `/products` | Selon Concept hero (raccord visuel) |
| `ParticleField` | Acte 06 | OffscreenCanvas + Web Worker (perf) |
| `PageTransitionScene` | Inter-pages | Morph fullscreen + cleanup automatique |

#### Couche DOM
| Composant | Rôle |
|---|---|
| `<MagneticCursor>` | Cursor magnétique aux CTA (DOM/RAF, pas WebGL) |
| `<MockupFrame>` | Device frame + screenshot + hover binding vers `WorkHoverShader` |
| `<TextReveal>` | Texte char-by-char (`split-type`) |
| `<MarqueeStrip>` | Bandeau infini (logos clients) |
| `<NumberCounter>` | `number-flow` |
| `<NoiseOverlay>` | Grain CSS subtil global |
| `<CookieBanner>` | Conforme CNIL, lazy-loaded |

### 4.7. Stack technique & arborescence (monorepo Turborepo)

**Dépendances ajoutées (dans `apps/agency`)** :
```
three  @react-three/fiber  @react-three/drei  @react-three/postprocessing
gsap (ScrollTrigger inclus, gratuit)  maath  glsl-noise
next-mdx-remote  rehype-pretty-code  remark-gfm
zod  zustand (déjà présent)
# dev-only
leva  r3f-perf  basisu (CLI KTX2 pre-build)
```

**Arborescence cible (monorepo)** :
```
.
├── apps/
│   ├── agency/                       # Nouveau projet Vercel beindigital.fr
│   │   ├── app/
│   │   │   ├── layout.tsx            # <R3FRoot/> + Lenis + Cursor + CookieBanner
│   │   │   ├── page.tsx              # Home (7 actes)
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
│   │   ├── proxy.ts                                                    # Next 16 : remplace middleware.ts. CSP nonce + headers sécurité
│   │   ├── public/                                                     # KTX2 textures + assets
│   │   └── package.json
│   │
│   └── restaurant/                   # Repo actuel renommé, déployé sur restaurant.beindigital.fr
│       └── (existant — refonte récente conservée)
│
├── packages/
│   ├── ui/                            # Composants partagés agence ↔ resto (boutons, primitives)
│   ├── tokens/                        # Variables CSS sémantiques (mint + accent warm)
│   ├── config/                        # ESLint, Tailwind v4, TS configs partagées
│   └── webgl-utils/                   # SceneRegistry, Visibility, capabilities detection
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**Convex agence** : projet **séparé** du resto (deux deployments). Tables minimales : `contactSubmissions` uniquement. Case studies + products = MDX build-time.

### 4.8. Plan d'implémentation phasé (révisé post-multi-agent)

| # | Phase | Durée | Livrable | Skills/Agents |
|---|-------|-------|----------|---------------|
| **0** | **Bootstrap monorepo** | 2 sem | Turborepo init, packages partagés, design tokens, fonts, **proxy.ts** sécurité Next 16 (CSP nonce + headers), Convex agence | typescript-pro, security-engineer |
| **0.5** | **Migration sous-domaine resto** | 2 sem | `restaurant.beindigital.fr` opérationnel, 301 systématiques, cookies scopés strict, OG/sitemap/hreflang, Search Console reverify | nextjs-architecture-expert, security-auditor |
| **1** | **POC perf gate (Hero + 1 scène)** | 3 sem | Hero (Concept A/B/C/D choisi) + 1 scène + R3F architecture + SceneVisibilityManager + Lenis-GSAP sync. **Mesure obligatoire Lighthouse mobile sur Pixel 6a / iPhone 12 réels.** Si fail → arbitrage. | threejs-shaders, threejs-geometry, react-performance-optimization |
| **2** | **Home actes 02-07** | 4-5 sem | Tous les actes restants + transitions intra-page + accent warm intégré | threejs-postprocessing, threejs-animation |
| **3** | **`/work` index + détail MDX** | 3 sem | Pipeline MDX, MockupFrame, RGB-split hover, transitions WebGL inter-pages | threejs-textures, threejs-interaction |
| **4** | **`/products` index + 1 produit (BiD Resto)** | 2-3 sem | Page produit, lien vers sous-domaine | threejs-geometry, threejs-loaders |
| **5** | **`/about` + `/contact`** | 2 sem | Form Convex (BotID + honeypot + Zod), Cal embed lazy post-consent | convex, frontend-developer |
| **6** | **GDPR/CNIL pages + CookieBanner** | 1 sem | Mentions légales, conf., cookies, bannière conforme, registre traitements interne | security-engineer |
| **7** | **Mobile optims + perf budget tenu** | 3 sem | KTX2 pipeline (basisu CLI), LOD, OffscreenCanvas particules, audit Lighthouse complet | react-performance-optimization, vercel:performance-optimizer |
| **8** | **A11y WCAG 2.2 AA + SEO + OG** | 2 sem | Alt-DOM scènes WebGL, focus management, prefers-reduced-motion strict, OG dynamiques | seo-fundamentals |
| **9** | **Préparation submission Awwwards** | 1 sem | Vidéo teaser MP4, screenshots HD, copy submission FR+EN | content-marketer |

**Total révisé** : ~26-30 semaines (~6.5-7.5 mois).

---

## 5. Risks & Mitigation (révisés)

| Risque | Sévérité | Mitigation |
|--------|----------|-----------|
| Lighthouse mobile < 60 (WebGL massif) | 🔴 Critique | **POC perf gate Phase 1** sur Pixel 6a / iPhone 12 réels avant d'enchaîner. Hero DOM-first, KTX2, instancing, frustum culling, SceneVisibilityManager pause complète, OffscreenCanvas particules. |
| LCP capturé par canvas Three.js | 🔴 Critique | Hero DOM-first absolu, scène 3D en `dynamic({ ssr: false })` post-LCP via `requestIdleCallback`. Canvas jamais élément LCP candidat (vérification DevTools Coverage). |
| INP > 200ms (concurrence Framer/Lenis/GSAP RAF) | 🟠 Important | Lenis = seul driver scroll. ScrollTrigger sync via `lenis.on('scroll', ScrollTrigger.update)`. Framer Motion uniquement reveals/hovers non-scroll. |
| Throttling thermique iPhone après 2-3min | 🟠 Important | `frameloop="demand"`, Visibility API pause, frame rate cap, capability detection (`navigator.deviceMemory <= 2` → fallback DOM). |
| Concept hero "cliché 2024" → Honorable Mention au lieu de SOTD | 🔴 Critique | **Sphère abandonnée** (Decision 17). Concept A/B/C/D à trancher §4.3. |
| Solo+IA insuffisant pour shaders custom complexes (liquid morph isosurface) | 🟠 Important | Banque de shaders open-source (Shadertoy, glslSandbox), skills threejs-shaders, freelance ponctuel si besoin. |
| Memory leaks inter-routes (canvas global) | 🔴 Critique | SceneRegistry contrat typé avec `unmount()` obligatoire (`dispose()` géométries/textures/matériaux). Tests E2E avec memory profiling DevTools. |
| Drift entre repos agence/resto sur 6 mois | 🟠 Important | **Monorepo Turborepo** + packages partagés (Decision 18). Source unique pour tokens, UI, configs. |
| CSP trop permissive → XSS reflété | 🔴 Critique | CSP **nonce-based + strict-dynamic** Phase 0. Bundle local Three.js/GSAP. Jamais `unsafe-eval`. Audit headers via securityheaders.com. |
| Cookies cross-subdomain leak | 🔴 Critique | Cookies auth resto strict scope `restaurant.beindigital.fr`. Audit Phase 0.5 obligatoire. |
| Env vars cross-deployment (copier-coller `.env`) | 🟠 Important | Préfixage `AGENCY_*` vs `RESTO_*`. CI gitleaks pre-commit. `vercel env pull` plutôt que copy manuel. |
| GDPR non-conformité (form contact) | 🟠 Important | Pages `/mentions-legales`, `/confidentialite`, `/cookies` obligatoires (Phase 6). Bannière CNIL. DPA archivés. Procédure breach 72h documentée. |
| A11y WCAG sur scènes WebGL | 🟠 Important | Alt-DOM caché aria-live, focus management strict, `prefers-reduced-motion` = remplacement total par image SVG/WebP (pas dégradation). |
| SOTD non garanti malgré ambition | 🟡 Modéré | Iterations multiples, soumissions multiples, plan B = Honorable Mention / Mobile Excellence. |
| Drift de scope sur 6.5 mois | 🟠 Important | Ce doc = contrat. Toute évolution ajoute une décision au log. Review trimestrielle obligatoire. |

---

## 5.a Phase 1.4 POC perf gate — résultats (validés)

**Test effectué** : Lighthouse 13 sur `https://beindigital.fr` en prod, throttling-method `simulate` (devtools 4G slow + 4× CPU), sur le hero "Liquid Architecture" v1 avec Lenis + magnetic cursor + copy v2.

| Catégorie | Mobile | Desktop |
|-----------|--------|---------|
| Performance | **98**/100 | **100**/100 |
| Accessibility | **100**/100 | **100**/100 |
| Best Practices | 92/100 | 92/100 |
| SEO | **100**/100 | **100**/100 |

**Core Web Vitals** :
| Métrique | Mobile | Desktop | Cible | Marge |
|----------|--------|---------|-------|-------|
| LCP | 1.1 s | 0.4 s | < 2.5 s | -56% / -84% |
| FCP | 1.1 s | 0.2 s | minimum | excellent |
| Speed Index | 1.5 s | 0.3 s | minimum | excellent |
| TBT | 130 ms | 0 ms | minimum | excellent |
| CLS | 0.041 | 0 | < 0.1 | -59% |
| TTI | 1.4 s | n/a | minimum | excellent |

**Bundle total** : 219 KB, 17 requests.

**Verdict** :
- 🟢 **Decision #29 (POC perf gate)** validée largement (98 vs 60 cible mobile).
- 🟢 **Decision #11 (full WebGL mobile)** confirmée comme tenable.
- 🟢 La stratégie *hero DOM-first + R3F en `dynamic({ ssr: false })` post-LCP via `requestIdleCallback`* (Decision #23) paie : Three.js + drei + postprocessing + GSAP n'impactent pas le LCP.
- ⚠️ **Re-mesurer après chaque ajout de scène** en Phase 2 (Manifesto, Products orbit, particles CTA). Si une scène fait chuter le score sous 60 mobile, isoler et optimiser avant d'enchaîner.

Aucune opportunité d'optimisation détectée par Lighthouse à ce stade.

---

## 5.b Audit cookies cross-subdomain — résultat (Phase 0.5)

**Findings** (audit effectué post-migration `apps/restaurant`) :

| Source | Cookie | Domain | Risk |
|--------|--------|--------|------|
| `@convex-dev/auth` (config minimale dans `convex/auth.ts`) | session/auth | host-only par défaut (pas de `Domain` attr) | ✅ Aucun — scoping strict à `restaurant.beindigital.fr` |
| Code applicatif | aucun cookie posé manuellement (grep `setCookie`/`Set-Cookie` = 0 matches) | n/a | ✅ Aucun |
| Stripe Checkout | redirects vers `checkout.stripe.com` | external domain | ✅ Aucun |
| YouSign webhooks | inbound only, pas de cookie | n/a | ✅ Aucun |
| Vercel Analytics (si activé) | `_vercel_*` anonymisé | host-only | ✅ Aucun (CNIL exempté) |

**Conclusion** : aucun risque de leak cross-subdomain identifié. Les cookies auth resto resteront strictement scopés à `restaurant.beindigital.fr` quand le DNS sera live. Pas de configuration custom requise.

**À surveiller** :
- Si on ajoute `@convex-dev/auth` à l'agence aussi (pour un futur dashboard partenaire), bien isoler les deux deployments Convex (ce qui est déjà le cas par Decision Log #13).
- Toute lib qui poserait un cookie avec `Domain=.beindigital.fr` doit être bloquée à la review.

---

## 6. Open Questions (résolues en cours d'implémentation)

- **Concept hero (§4.3)** : A / B / C / D à trancher avant Phase 1 — **bloquant pour bootstrap visuel**
- **Accent warm précis** : `#FF5722` orange brûlé vs `#C97B4A` cuivré — à trancher Phase 0 sur preview
- **Choix licence typo** : Migra+Söhne payant (~500€) vs Editorial New+Mier B vs fallback gratuit Fraunces+Inter Tight
- **Logo agence** : à créer (peut être un wordmark typographique + sigil mint dérivé) — bloque Concept C si choisi
- **Trafic actuel** de `be-in-digital.fr` (à mesurer Phase 0.5 pour calibrer 301)
- **Tagline / promesse principale** de la home (à brainstormer Phase 1)
- **3-8 case studies** : assets à collecter / produire (screenshots HD, vidéos MP4)
- **Domaine `beindigital.fr` vs `be-in-digital.fr`** : configuration DNS à clarifier (acquisition `beindigital.fr` si pas encore possédé)

---

## 7. Implementation Handoff

Le doc design est **lockable et review-ready**. Pré-requis avant Phase 0 :

1. ✅ Multi-agent review intégrée (architect / UI-UX / performance / security)
2. ⏳ **Décision Concept hero (§4.3)** — bloquant
3. ⏳ User confirme "go build"
4. → **Phase 0 — Bootstrap monorepo Turborepo** démarre

---

**Auteur** : Session brainstorming + multi-agent review du 2026-04-26
**Branche** : `doums85/agency-homepage`
**Prochaines étapes** : (1) trancher Concept hero §4.3 + (2) confirmer go build → Phase 0 démarre.
