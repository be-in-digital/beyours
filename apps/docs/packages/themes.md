# @be-in-digital/themes

> 6 predefined restaurant themes: Fast Food, Pizzeria, Chinese, Fine Dining, Cafe, Sushi.

## Table of Contents

- [Installation](#installation)
- [Available Themes](#available-themes)
- [Usage](#usage)
- [Customization](#customization)

## Installation

```bash
pnpm add @be-in-digital/themes
```

### Dependencies

- `@be-in-digital/ui` — Base component library

## Available Themes

| Theme | Type | Style |
|-------|------|-------|
| `fast-food` | Fast Food | Bold colors, quick-service UX |
| `pizzeria` | Pizzeria | Warm tones, Italian feel |
| `chinese` | Chinese | Red/gold, oriental aesthetics |
| `fine-dining` | Fine Dining | Elegant, minimal, premium |
| `cafe` | Cafe/Bakery | Cozy, warm, artisanal |
| `sushi` | Sushi/Japanese | Clean, zen, modern |

## Usage

```typescript
import { themes } from "@be-in-digital/themes";

// Get theme by key
const theme = themes["pizzeria"];

// Apply theme CSS variables
document.documentElement.style.setProperty("--primary", theme.colors.primary);
document.documentElement.style.setProperty("--accent", theme.colors.accent);
```

## Customization

Each theme provides:

- **Color palette** — Primary, secondary, accent, background
- **Typography** — Font families and sizes
- **Component variants** — Button styles, card styles, etc.
- **Layout preferences** — Grid layouts, spacing

Themes are designed to be a starting point. Override any value:

```typescript
const customTheme = {
  ...themes["pizzeria"],
  colors: {
    ...themes["pizzeria"].colors,
    primary: "#custom-color",
  },
};
```

> **Note**: Theme system is currently a placeholder and will be fully implemented in a future release.
