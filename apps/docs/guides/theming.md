# Theming Guide

> **⚠️ This guide describes a feature that was never implemented.**
> The `@be-in-digital/themes` package contained nothing but `export {}` and has been removed.
> None of the six themes below exist in the code, and the import example
> further down does not work. Theming today goes through the design
> system in `packages/ui` and the CMS branding settings.
> This guide needs to be rewritten from the actual behavior before it is published.

## Available Themes

| Theme | Style | Best For |
|-------|-------|----------|
| `fast-food` | Bold, energetic | Burger joints, fried chicken |
| `pizzeria` | Warm, rustic | Pizza restaurants, Italian |
| `chinese` | Red/gold, oriental | Chinese, Asian fusion |
| `fine-dining` | Elegant, minimal | Upscale restaurants |
| `cafe` | Cozy, artisanal | Cafes, bakeries, brunch |
| `sushi` | Clean, zen | Sushi bars, Japanese |

## Usage

```typescript
import { themes } from "@be-in-digital/themes";

// Apply a theme
const theme = themes["pizzeria"];
```

## Customization

Override theme values in your `globals.css`:

```css
:root {
  /* Override theme colors */
  --primary: 15 80% 50%;     /* Warm orange */
  --background: 30 20% 98%;  /* Cream */
  --accent: 15 70% 45%;      /* Terracotta */
  --radius: 0.75rem;         /* Rounded corners */
}

.dark {
  --primary: 15 80% 60%;
  --background: 15 10% 10%;
}
```

## Font Pairing

Each theme suggests font pairings:

| Theme | Heading Font | Body Font |
|-------|-------------|-----------|
| `fast-food` | Bebas Neue | Inter |
| `pizzeria` | Playfair Display | Lato |
| `chinese` | Noto Serif SC | Noto Sans |
| `fine-dining` | Cormorant Garamond | Montserrat |
| `cafe` | Josefin Sans | Open Sans |
| `sushi` | Zen Maru Gothic | Noto Sans JP |

> **Note**: The theme system is currently a placeholder. Full theme implementation with complete color palettes, typography, and component variants is planned for a future release.
