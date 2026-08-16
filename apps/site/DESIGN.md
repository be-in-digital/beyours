# Design — Be in Digital marketing site

> ## ⚠️ CURRENT DIRECTION (2026-07 redesign — overrides everything below)
>
> The art direction has **pivoted** from a premium dark mint/teal to a **warm
> food-editorial** look, signed off by the client (warmer, food-first, shows the
> real product). The sections below describing the “dark futuristic / neon mint”
> look are **obsolete** — keep them as history only.
>
> **Actual palette (tokens in `app/globals.css`, light theme):**
> - Paper background `--background: #faf5ee` · ink text `--foreground: #221c15`
> - Light surfaces `--surface-1: #fffdf9` → `--surface-3: #ece0cf`
> - **Single accent = terracotta** `--primary: #c5542c` (scale
>   `--primary-50…900`), text on the accent `--primary-foreground: #fdf7ef`
> - Warm dark anchor (footer, CTA, 1 panel per page max) = **olive**
>   `--olive: #23271c`
> - Warm borders `--border: #e6d8c4` · brown-tinted shadows
>   `rgba(112,60,34,…)` (never a neon glow)
>
> **Type:** display = **Bricolage Grotesque** (`font-display`), body = Geist,
> mono = Geist Mono. The Instrument serif is gone.
>
> **Principles:** real food photography + real PRODUCT previews (the
> `storefront-preview.tsx` component is a working mini ordering site), no fake
> mockups made of gray divs, no abstract dashboard. Soft motion (framer-motion,
> reduced-motion respected). One accent locked (terracotta) across the whole
> site.
>
> **Banned:** mint/teal (`#52cfaf`, `rgba(82,207,175,*)`), `bg-black/*`,
> `bg-white/[0.0x]`, `#101014/#0a0a0a`, neon glows, visible em dashes.

## 1. Goal

Build a **premium**, **immersive** and **very modern** marketing site for **Be in Digital**, drawing on the reference site while adapting it to the brand.

The site has to convey immediately:

* innovation,
* performance,
* credibility,
* product mastery,
* restaurant specialization,
* a premium image.

---

## 2. Creative reference

Main reference: the Framer site the client shared.

### What we take from the reference

* the **dark futuristic / premium tech** world,
* an immersive mood built on **glow, halos, light streaks, depth**,
* a very visual hero with immediate impact,
* large, airy sections,
* product / dashboard cards with a showcase effect,
* cinematic compositions,
* a footer that really lands.

### What we do not copy as-is

* the dominant blue / purple colors,
* the generic “AI SaaS” wording,
* decorative sections with no link to the offer,
* effects that are too gratuitous when they hurt legibility.

---

## 3. Adapting it to Be in Digital branding

### Color direction

The site must keep the premium, immersive visual language of the reference, but be **recolored** to Be in Digital branding.

The color intent is:

* very dark background,
* mint / teal accent,
* light text,
* premium surfaces,
* controlled light halos,
* sharp contrast.

### Important rule

The design must **not** be defined from hex codes hardcoded in the components.

We want a system built on **semantic CSS variables**, in order to:

* make theming easier,
* keep global consistency,
* allow quick adjustments,
* avoid colors scattered through the code,
* be ready for a possible change of branding.

### Expected variables

The color system has to be designed around variables like:

* `--background`
* `--foreground`
* `--surface-1`
* `--surface-2`
* `--surface-3`
* `--card`
* `--card-foreground`
* `--primary`
* `--primary-foreground`
* `--secondary`
* `--secondary-foreground`
* `--muted`
* `--muted-foreground`
* `--border`
* `--input`
* `--ring`
* `--glow-primary`
* `--glow-soft`
* `--hero-radial`
* `--section-radial`

### Brand color codes

Even though the implementation has to rely on CSS variables, we keep the **source brand colors** here as a design reference.

#### Source colors

* Primary / Mint: `#52CFAF`
* Dark / Black: `#0A0A0A`
* White: `#FFFFFF`

#### Extended reference palette

* Primary 50: `#EEFAF7`
* Primary 100: `#DCF5EF`
* Primary 200: `#C2EEE3`
* Primary 300: `#A0E5D3`
* Primary 400: `#7DDBC3`
* Primary 500: `#52CFAF`
* Primary 600: `#46B095`
* Primary 700: `#39917A`
* Primary 800: `#2D7260`
* Primary 900: `#215346`

#### Reference neutrals

* Neutral 900: `#0A0A0A`
* Neutral 800: `#1A1A1A`
* Neutral 700: `#2A2A2A`
* Neutral 600: `#4A4A4A`
* Neutral 500: `#6B6B6B`
* Neutral 400: `#9A9A9A`
* Neutral 300: `#CFCFCF`
* Neutral 200: `#E8E8E8`
* Neutral 100: `#F5F5F5`
* Neutral 50: `#FAFAFA`

#### Recommended mapping onto the CSS variables

* `--background`: very dark main background derived from `#0A0A0A`
* `--foreground`: main text derived from `#FFFFFF`
* `--primary`: main accent derived from `#52CFAF`
* `--primary-foreground`: dark text on the mint accent
* `--muted-foreground`: light gray derived from the neutral palette
* `--border`: subtle border derived from the dark neutrals
* `--glow-primary`: mint halo derived from `#52CFAF`

#### Usage rule

The hex values above are only a **branding reference**.
The site code then has to go through **semantic CSS variables**, not hex values scattered across the components.

### Translating the reference visually

The reference site rests on a blue / purple neon world over a dark background.

For Be in Digital, we need to:

* replace the dominant purple glows with mint / teal glows,
* keep a near-black background,
* keep premium dark surfaces,
* use the brand accent to lead the eye,
* limit the number of secondary colors.

### Branding rule

The site has to read as:

* premium,
* tech,
* elegant,
* controlled,
* restaurant-first,
* business-oriented.

It must not read as:

* a generic template,
* a crypto site,
* a gaming site,
* an “AI gadget” site,
* a site that is too cold or too corporate.

---

## 4. Art direction

### Visual intent

Build an interface that feels like a next-generation digital product, with:

* depth,
* elegant contrast,
* subtle glow,
* glass surfaces,
* premium dark cards,
* controlled light halos,
* perspective effects.

### Creative keywords

* dark luxury,
* food-tech premium,
* immersive SaaS,
* neon mint,
* futuristic but clean,
* sharp,
* elegant,
* cinematic UI.

### Visual rules

* very dark main background,
* sections that breathe,
* not too much visual noise,
* subtle, controlled glow,
* light effects used to lead the eye,
* strong typographic hierarchy,
* product visuals always given prominence.

---

## 5. Visual architecture of the homepage

### 5.1 Navbar

* Be in Digital logo,
* main links,
* primary CTA: **Réserver une démo** or **Prendre rendez-vous**,
* dark style with slight transparency and a hairline border.

### 5.2 Hero

* badge,
* strong headline about restaurant digital transformation,
* benefit-driven subhead,
* primary CTA,
* secondary CTA,
* large product mockup, or a dashboard + mobile + storefront composition,
* dark background with light streams and a centered halo.

### 5.3 Problem section

Illustrate:

* dependence on the platforms,
* weak digital image,
* scattered tools,
* no customer loyalty,
* time lost,
* how hard it is to centralize operations.

### 5.4 Solution / platform section

Present Be in Digital as the restaurant's digital control center:

* admin dashboard,
* storefront / online ordering,
* menu management,
* order management,
* marketing / loyalty,
* mobile experience.

### 5.5 Features section

Premium grid layout with dark cards:

* premium restaurant website,
* direct online ordering,
* menu management,
* admin dashboard,
* order centralization,
* loyalty / gamification,
* mobile experience,
* digital support.

### 5.6 Product ecosystem section

Show the Be in Digital building blocks:

* storefront,
* dashboard,
* loyalty,
* analytics,
* digital menu,
* digital branding.

### 5.7 Benefits section

Turn the features into concrete gains:

* more control,
* better image,
* more direct orders,
* time saved,
* better customer experience,
* centralized tools.

### 5.8 Trust section

Put forward:

* restaurant specialization,
* a bespoke approach,
* human support,
* premium design,
* business vision,
* a modern stack.

### 5.9 Final CTA

An immersive section, simple, legible and very clear, with one prominent primary button.

### 5.10 Footer

A visually strong, immersive footer, recolored to the mint / dark branding, with useful links and contact details.

---

## 6. Component system

Main components:

* `Navbar`
* `HeroSection`
* `SectionBadge`
* `SectionHeader`
* `FeatureCard`
* `BenefitCard`
* `ProblemCard`
* `ProductShowcase`
* `MockupFrame`
* `GlowBackground`
* `CTASection`
* `Footer`

### Shared rules

* generous border radius,
* premium spacing,
* layered dark background,
* very subtle borders,
* diffuse shadows,
* tightly controlled mint glow,
* consistenc
