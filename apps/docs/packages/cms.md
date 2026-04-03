# @be-in-digital/cms

> Custom CMS with page/block registry, field definitions, media management, and content validation.

## Table of Contents

- [Installation](#installation)
- [Registry System](#registry-system)
- [Block Definitions](#block-definitions)
- [Media Management](#media-management)
- [Validation](#validation)

## Installation

```bash
pnpm add @be-in-digital/cms
```

## Registry System

The CMS uses a registry pattern to define pages and blocks.

### Initialize Registry

```typescript
import { setCmsRegistry, getCmsRegistry } from "@be-in-digital/cms";

// Register your page and block definitions
setCmsRegistry({
  pages: [
    {
      slug: "home",
      name: "Home Page",
      blocks: ["hero", "featured-products", "testimonials"],
    },
    {
      slug: "about",
      name: "About Us",
      blocks: ["hero", "text-content", "team"],
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
    "featured-products": {
      name: "Featured Products",
      fields: {
        heading: { type: "text", required: true },
        productIds: { type: "reference", multiple: true },
      },
    },
  },
});
```

### Get Page Definition

```typescript
import { getPageDefinition } from "@be-in-digital/cms";

const homePage = getPageDefinition("home");
// { slug: "home", name: "Home Page", blocks: [...] }
```

## Block Definitions

Blocks are the building units of CMS pages. Each block has typed fields.

### Field Types

| Type | Description |
|------|-------------|
| `text` | Single-line text |
| `richtext` | Rich text (HTML) |
| `image` | Image upload |
| `link` | URL with label |
| `reference` | Reference to another document |
| `number` | Numeric value |
| `boolean` | Toggle |
| `select` | Dropdown selection |
| `color` | Color picker |

## Media Management

### Validate Uploads

```typescript
import { validateMediaUpload } from "@be-in-digital/cms";

const validation = validateMediaUpload(file);
if (!validation.valid) {
  console.error(validation.error);
  // "File too large (max 10MB)" or "Unsupported file type"
}
```

### SVG Sanitization

```typescript
import { sanitizeSvg } from "@be-in-digital/cms";

// Remove malicious scripts from SVG content
const safeSvg = sanitizeSvg(rawSvgString);
```

## Validation

### Validate Block Content

```typescript
import { validateBlockValues } from "@be-in-digital/cms";

const result = validateBlockValues("hero", {
  title: "Welcome",
  // missing required 'image' field
});

if (!result.valid) {
  console.error(result.errors);
  // [{ field: "image", message: "Required field" }]
}
```
