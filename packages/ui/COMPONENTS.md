# @beindigital-engine/ui - Component Library

Complete shadcn/ui-inspired component library built with TypeScript, Tailwind CSS, and class-variance-authority.

## Package Structure

```
src/
├── lib/
│   └── utils.ts                    # cn() utility for className merging
├── components/
│   ├── Layout (3)
│   │   ├── Container.tsx
│   │   ├── Section.tsx
│   │   └── PageHeader.tsx
│   ├── Navigation (3)
│   │   ├── Navbar.tsx
│   │   ├── Breadcrumb.tsx
│   │   └── Tabs.tsx
│   ├── Forms (8)
│   │   ├── Button.tsx
│   │   ├── Label.tsx
│   │   ├── Input.tsx
│   │   ├── Textarea.tsx
│   │   ├── Select.tsx
│   │   ├── Checkbox.tsx
│   │   ├── Switch.tsx
│   │   └── FormField.tsx
│   ├── Display (13)
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── Avatar.tsx
│   │   ├── Table.tsx
│   │   ├── Dialog.tsx
│   │   ├── Toast.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Spinner.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Alert.tsx
│   │   ├── Separator.tsx
│   │   ├── DropdownMenu.tsx
│   │   └── DataTable.tsx
│   ├── restaurant/ (8)
│   │   ├── ProductCard.tsx
│   │   ├── CartItem.tsx
│   │   ├── OrderStatusBadge.tsx
│   │   ├── QuantitySelector.tsx
│   │   ├── PriceDisplay.tsx
│   │   ├── AllergenBadge.tsx
│   │   ├── SpiceLevelIndicator.tsx
│   │   └── StoreStatusBadge.tsx
│   └── admin/ (5)
│       ├── AdminLayout.tsx
│       ├── StatCard.tsx
│       ├── ActionBar.tsx
│       ├── FilterBar.tsx
│       └── StatusTimeline.tsx
└── index.ts
```

## Total Components: 40+

### Base Components: 27
- **Layout:** 3 components
- **Navigation:** 3 components
- **Forms:** 8 components
- **Display:** 13 components

### Restaurant Components: 8
Specialized for e-commerce/restaurant use cases

### Admin Components: 5
Dashboard and admin panel components

## Usage

### Import from main entry
```typescript
import { Button, Input, Card } from "@beindigital-engine/ui"
```

### Import from subpaths
```typescript
import { ProductCard, CartItem } from "@beindigital-engine/ui/restaurant"
import { AdminLayout, StatCard } from "@beindigital-engine/ui/admin"
```

## Features

- ✅ TypeScript strict mode
- ✅ React 19 compatible
- ✅ Server Component ready (except interactive components)
- ✅ Accessible (ARIA labels, keyboard navigation)
- ✅ CVA for variant styling
- ✅ Tailwind CSS + tailwind-merge
- ✅ Lucide React icons
- ✅ Full type definitions
- ✅ Tree-shakeable exports

## Build Output

- `dist/index.js` - CommonJS bundle (74 KB)
- `dist/index.mjs` - ES Module bundle (63 KB)
- `dist/index.d.ts` - TypeScript definitions (17 KB)
- Source maps included

## Dependencies

- `class-variance-authority` - Variant styling
- `clsx` - Conditional classes
- `tailwind-merge` - Tailwind class merging
- `lucide-react` - Icon library

## Peer Dependencies

- `react` ^19.0.0
- `react-dom` ^19.0.0
- `react-hook-form` ^7.0.0 (optional)
- `@hookform/resolvers` ^3.0.0 (optional)
