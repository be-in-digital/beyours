# Theming Guide

> **⚠️ Ce guide décrit une fonctionnalité qui n'a jamais été implémentée.**
> Le paquet `@be-in-digital/themes` ne contenait que `export {}` et a été supprimé.
> Aucun des six thèmes ci-dessous n'existe dans le code, et l'exemple d'import
> plus bas ne fonctionne pas. Le theming réel passe aujourd'hui par le design
> system de `packages/ui` et les réglages de branding du CMS.
> Ce guide est à réécrire à partir du comportement réel avant d'être publié.

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
