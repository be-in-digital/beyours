# CMS Content Management Guide

> Build and manage dynamic pages with the custom block-based CMS.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Defining Pages](#defining-pages)
- [Block System](#block-system)
- [Media Management](#media-management)
- [Rendering Content](#rendering-content)

## Overview

The CMS package provides a flexible, block-based content management system. Restaurant owners can create and edit pages like "About Us", "Contact", or promotional landing pages without code changes.

## Setup

```bash
pnpm add @be-in-digital/cms
```

### Initialize the Registry

```typescript
// lib/cms.ts
import { setCmsRegistry } from "@be-in-digital/cms";

setCmsRegistry({
  pages: [
    {
      slug: "home",
      name: "Home Page",
      blocks: ["hero", "featured-products", "testimonials", "location-map"],
    },
    {
      slug: "about",
      name: "About Us",
      blocks: ["hero", "text-content", "team", "gallery"],
    },
    {
      slug: "contact",
      name: "Contact",
      blocks: ["contact-form", "location-map", "opening-hours"],
    },
  ],
  blocks: {
    hero: {
      name: "Hero Banner",
      fields: {
        title: { type: "text", required: true },
        subtitle: { type: "text" },
        image: { type: "image", required: true },
        cta: { type: "link" },
      },
    },
    "text-content": {
      name: "Text Content",
      fields: {
        heading: { type: "text" },
        body: { type: "richtext", required: true },
      },
    },
    "featured-products": {
      name: "Featured Products",
      fields: {
        heading: { type: "text", required: true },
        productIds: { type: "reference", multiple: true },
        columns: { type: "select", options: ["2", "3", "4"], default: "3" },
      },
    },
  },
});
```

## Defining Pages

```typescript
import { getPageDefinition, getCmsRegistry } from "@be-in-digital/cms";

// Get a specific page
const homePage = getPageDefinition("home");

// Get all pages
const registry = getCmsRegistry();
console.log(registry.pages); // [{ slug: "home", ... }, ...]
```

## Block System

### Field Types

| Type | Description | Example |
|------|-------------|---------|
| `text` | Single-line text | Title, label |
| `richtext` | Rich text (HTML) | Article body |
| `image` | Image upload | Hero image |
| `link` | URL with label | CTA button |
| `reference` | Document reference | Product picker |
| `number` | Numeric value | Column count |
| `boolean` | Toggle | Show/hide |
| `select` | Dropdown | Layout option |
| `color` | Color picker | Background color |

### Validation

```typescript
import { validateBlockValues } from "@be-in-digital/cms";

const result = validateBlockValues("hero", {
  title: "Welcome to La Bella",
  // image is missing (required)
});

if (!result.valid) {
  console.error(result.errors);
  // [{ field: "image", message: "Required field" }]
}
```

## Media Management

### Upload Validation

```typescript
import { validateMediaUpload } from "@be-in-digital/cms";

const validation = validateMediaUpload(file);
if (!validation.valid) {
  alert(validation.error);
  return;
}

// Proceed with upload to S3
const { url } = await s3.upload(file, { folder: "cms", filename: file.name });
```

### SVG Sanitization

```typescript
import { sanitizeSvg } from "@be-in-digital/cms";

// Remove potentially malicious scripts from SVG
const safeSvg = sanitizeSvg(rawSvgContent);
```

## Storefront Layout: Branding Block

The `storefront-layout` CMS page includes a special **branding** block for restaurant identity. This block provides the logo, favicon, and brand name used across the storefront and admin dashboard.

### Block Definition

```typescript
// cms/pages/storefront-layout.ts
{
  key: "branding",
  label: "Identité visuelle",
  fields: {
    logo: {
      type: "image",
      label: "Logo du restaurant",
      description: "PNG ou SVG, 200x60px recommandé",
    },
    favicon: {
      type: "image",
      label: "Favicon",
      description: "PNG 32x32 ou 64x64",
    },
    brandName: {
      type: "text",
      label: "Nom de la marque",
      required: true,
      maxLength: 50,
    },
  },
}
```

### Where Branding Appears

| Location | What is shown |
|----------|---------------|
| **Storefront header** | Logo image, or brand name text as fallback |
| **Admin sidebar** | Logo thumbnail + brand name |
| **Browser tab** | Dynamic favicon from CMS |
| **Mobile menu** | Logo with white overlay for dark backgrounds |

### Reading Branding Data

```tsx
import { useCmsPage } from "@/lib/cms/useCmsPage";

function MyComponent() {
  const cms = useCmsPage("storefront-layout");
  const logoUrl = cms.block("branding").field("logo").mediaUrl;
  const faviconUrl = cms.block("branding").field("favicon").mediaUrl;
  const brandName = cms.block("branding").field("brandName").text ?? "BeYours";

  return logoUrl
    ? <img src={logoUrl} alt={brandName} className="h-8 w-auto" />
    : <span>{brandName}</span>;
}
```

### Dynamic Favicon

The `DynamicFavicon` client component injects the CMS favicon into the document head at runtime:

```tsx
import { DynamicFavicon } from "@/components/dynamic-favicon";

// Include in your shell/layout
<DynamicFavicon />
```

## Rendering Content

```tsx
// app/(storefront)/[slug]/page.tsx
import { getPageDefinition } from "@be-in-digital/cms";
import { CmsBlockRenderer } from "@/components/cms/BlockRenderer";

export default async function CmsPage({ params }: { params: { slug: string } }) {
  const page = getPageDefinition(params.slug);
  if (!page) return notFound();

  const content = await getPageContent(params.slug); // From Convex

  return (
    <div>
      {content.blocks.map((block, i) => (
        <CmsBlockRenderer key={i} type={block.type} data={block.data} />
      ))}
    </div>
  );
}
```
