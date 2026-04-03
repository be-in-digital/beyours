# @be-in-digital/ui

> 45+ accessible, themeable React components built on Radix UI and Tailwind CSS.

## Table of Contents

- [Installation](#installation)
- [Setup](#setup)
- [Components](#components)
- [Usage](#usage)
- [Theming](#theming)
- [Best Practices](#best-practices)

## Installation

```bash
pnpm add @be-in-digital/ui
```

### Peer Dependencies

```bash
pnpm add react@^19 react-dom@^19 react-hook-form@^7 @hookform/resolvers@^3
```

## Setup

### 1. Tailwind Configuration

Add the package to your Tailwind content paths:

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@be-in-digital/ui/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;
```

### 2. Import Components

```tsx
import { Button, Card, Input, Badge } from "@be-in-digital/ui";
```

## Components

### Layout

| Component | Description |
|-----------|-------------|
| `Container` | Responsive container with max-width |
| `Section` | Semantic section with consistent spacing |
| `PageHeader` | Page title with optional breadcrumb and actions |

```tsx
import { Container, Section, PageHeader } from "@be-in-digital/ui";

<Container>
  <PageHeader
    title="Products"
    description="Manage your product catalog"
    actions={<Button>Add Product</Button>}
  />
  <Section>
    {/* Content */}
  </Section>
</Container>
```

### Form Components

| Component | Description |
|-----------|-------------|
| `Button` | Primary action button with variants |
| `Input` | Text input field |
| `SearchInput` | Search input with icon and clear button |
| `Textarea` | Multi-line text input |
| `Select` | Dropdown select (Radix UI) |
| `Checkbox` | Checkbox with label |
| `Switch` | Toggle switch |
| `Slider` | Range slider |
| `FormField` | Form field with label, error, description |

#### Button

```tsx
import { Button } from "@be-in-digital/ui";

// Variants
<Button variant="default">Primary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'destructive' \| 'outline' \| 'secondary' \| 'ghost' \| 'link'` | `'default'` | Visual style |
| `size` | `'default' \| 'sm' \| 'lg' \| 'icon'` | `'default'` | Button size |
| `disabled` | `boolean` | `false` | Disable button |

#### Input

```tsx
import { Input } from "@be-in-digital/ui";

<Input placeholder="Email" type="email" />
<Input type="password" />
```

#### FormField

```tsx
import { FormField, Input } from "@be-in-digital/ui";

<FormField label="Email" error="Invalid email" description="We'll never share your email">
  <Input type="email" />
</FormField>
```

### Display Components

| Component | Description |
|-----------|-------------|
| `Badge` | Status badge with color variants |
| `Card` | Content card with header, body, footer |
| `Avatar` | User avatar with fallback |
| `StatusIndicator` | Colored status dot |
| `DataTable` | Sortable, filterable data table |
| `EmptyState` | Placeholder for empty content |
| `LoadingSpinner` | Loading indicator |

#### Badge

```tsx
import { Badge } from "@be-in-digital/ui";

<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Error</Badge>
```

#### Card

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@be-in-digital/ui";

<Card>
  <CardHeader>
    <CardTitle>Revenue</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold">$12,450</p>
  </CardContent>
</Card>
```

### Overlay Components

| Component | Description |
|-----------|-------------|
| `Dialog` | Modal dialog |
| `Sheet` | Slide-in panel |
| `DropdownMenu` | Context menu |
| `Tooltip` | Hover tooltip |
| `AlertDialog` | Confirmation dialog |
| `Toast` | Notification toast |
| `Popover` | Floating content |

#### Dialog

```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@be-in-digital/ui";

<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Product</DialogTitle>
    </DialogHeader>
    {/* Form content */}
  </DialogContent>
</Dialog>
```

### Navigation

| Component | Description |
|-----------|-------------|
| `Tabs` | Tab navigation |
| `Breadcrumb` | Breadcrumb navigation |
| `Pagination` | Page navigation |

## Theming

Components use CSS variables for theming. Override these in your `globals.css`:

```css
:root {
  --primary: 222 47% 11%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --accent: 210 40% 96%;
  --destructive: 0 84% 60%;
  --radius: 0.5rem;
}

.dark {
  --primary: 210 40% 98%;
  --primary-foreground: 222 47% 11%;
}
```

## Best Practices

1. **Always use `variant` props** instead of custom Tailwind for component styling
2. **Wrap forms** with `FormField` for consistent error handling
3. **Use `AlertDialog`** for destructive actions (delete, cancel)
4. **Add `Toast`** for async feedback (save, submit)
5. **Use `EmptyState`** when lists are empty instead of hiding content
