# @be-yours/cms

> Custom CMS with page/block registry, field definitions, media management, and content validation.

## Table of Contents

- [Installation](#installation)
- [Registry System](#registry-system)
- [Block Definitions](#block-definitions)
- [Media Management](#media-management)
- [Validation](#validation)

## Installation

```bash
pnpm add @be-yours/cms
```

## Registry System

The CMS uses a registry pattern to define pages and blocks.

### Initialize Registry

```typescript
import { setCmsRegistry, getCmsRegistry } from "@be-yours/cms";

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
import { getPageDefinition } from "@be-yours/cms";

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

`validateMediaUpload` takes the three facts about a file, not the `File`
object — so it runs unchanged in a Convex isolate, where there is no `File`.

```typescript
import { validateMediaUpload } from "@be-yours/cms";

const validation = validateMediaUpload("photo.jpg", "image/jpeg", 2_000_000);
if (!validation.valid) {
  console.error(validation.error);
  // { code: "file_too_large", message: "…" } | invalid_mime | invalid_filename
}
```

### SVG Sanitization

`sanitizeSvg` ships from the `@be-yours/cms/sanitize` subpath, **not** from
the package barrel. It parses markup through DOMPurify, which needs a DOM, and
the barrel is imported by Convex isolate modules that have none — re-exporting
it made the whole backend fail to push. The reason is written out at the
sanitize section of `packages/cms/src/index.ts`.

```typescript
import { sanitizeSvg } from "@be-yours/cms/sanitize";

const result = sanitizeSvg(rawSvgString);
result.sanitized;       // the cleaned SVG
result.removedElements; // ["<script>", "onclick", …]
```

It returns a `SanitizeResult`, not a string, and throws above 1 MB of input.

For the Convex callers that cannot pull in a parser, the barrel exports a
DOM-free refusal check instead — regex-based, dependency-free, and enough to
reject an upload before it is ever stored:

```typescript
import { containsActiveContent, inspectSvgForActiveContent } from "@be-yours/cms";

if (containsActiveContent(rawSvgString)) {
  // refuse the upload
}

const report = inspectSvgForActiveContent(rawSvgString);
// { active: true, reasons: ["élément actif (script, animation ou objet embarqué)", …] }
```

## Validation

### Validate Block Content

```typescript
import { validateBlockValues } from "@be-yours/cms";

const result = validateBlockValues("hero", {
  title: "Welcome",
  // missing required 'image' field
});

if (!result.valid) {
  console.error(result.errors);
  // [{ field: "image", message: "Required field" }]
}
```
