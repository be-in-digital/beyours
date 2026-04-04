# @be-in-digital/admin

> Complete admin dashboard with 20+ page components, layout, stores, hooks, and utility functions.

## Table of Contents

- [Installation](#installation)
- [Pages](#pages)
- [Stores](#stores)
- [Hooks](#hooks)
- [Utilities](#utilities)

## Installation

```bash
pnpm add @be-in-digital/admin
```

## Pages

Pre-built, full-featured admin pages ready to use.

| Page | Import | Description |
|------|--------|-------------|
| `DashboardPage` | `@be-in-digital/admin/pages` | KPIs, charts, recent orders |
| `OrdersPage` | `@be-in-digital/admin/pages` | Order list with filters and status |
| `ProductsPage` | `@be-in-digital/admin/pages` | Product catalog management |
| `KitchenPage` | `@be-in-digital/admin/pages` | Kitchen Display System |
| `GamesPage` | `@be-in-digital/admin/pages` | Gamification management |
| `LanguagesPage` | `@be-in-digital/admin/pages` | i18n with GPT translation |
| `PaymentsPage` | `@be-in-digital/admin/pages` | Payment integrations |
| `EmailDashboardPage` | `@be-in-digital/admin/pages` | Email marketing dashboard |

### Usage

```tsx
// app/(admin)/dashboard/page.tsx
import { DashboardPage } from "@be-in-digital/admin/pages";

export default function Dashboard() {
  return <DashboardPage />;
}
```

```tsx
// app/(admin)/orders/page.tsx
import { OrdersPage } from "@be-in-digital/admin/pages";

export default function Orders() {
  return <OrdersPage />;
}
```

```tsx
// app/(admin)/kitchen/page.tsx
import { KitchenPage } from "@be-in-digital/admin/pages";

export default function Kitchen() {
  return <KitchenPage />;
}
```

## Stores

### useAdminAuthStore

Admin authentication state (Zustand).

```typescript
import { useAdminAuthStore } from "@be-in-digital/admin/stores";

function AdminHeader() {
  const { user, role, signOut } = useAdminAuthStore();

  return (
    <header>
      <span>{user.name} ({role})</span>
      <Button onClick={signOut}>Sign Out</Button>
    </header>
  );
}
```

## Hooks

### useAdminStoreId

Get the current admin store context.

```typescript
import { useAdminStoreId } from "@be-in-digital/admin/hooks";

function ProductList() {
  const storeId = useAdminStoreId();
  const products = useQuery(api.products.listByStore, { storeId });
  // ...
}
```

### useDebounce

Debounce values for search inputs.

```typescript
import { useDebounce } from "@be-in-digital/admin/hooks";

function SearchProducts() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const results = useQuery(api.products.search, {
    query: debouncedQuery,
  });

  return <SearchInput value={query} onChange={setQuery} />;
}
```

## Utilities

### formatPrice

```typescript
import { formatPrice } from "@be-in-digital/admin/lib";

formatPrice(1299);    // "12,99 EUR"
formatPrice(0);       // "0,00 EUR"
formatPrice(100000);  // "1 000,00 EUR"
```

### formatDate

```typescript
import { formatDate } from "@be-in-digital/admin/lib";

formatDate(new Date());               // "1 avr. 2026"
formatDate(new Date(), "en", "long"); // "April 1, 2026"
```

### eurosToCents / centsToEuros

```typescript
import { eurosToCents } from "@be-in-digital/admin/lib";

eurosToCents(12.99);  // 1299
```

### slugify

```typescript
import { slugify } from "@be-in-digital/admin/lib";

slugify("Margherita Pizza");  // "margherita-pizza"
slugify("Crème Brûlée");     // "creme-brulee"
```

## Layout Components

### AppSidebar

Admin sidebar with navigation, dynamic logo, and user footer.

```tsx
import { AppSidebar, SidebarUserMenu } from "@be-in-digital/admin";

<AppSidebar
  userFooter={<SidebarUserMenu />}
  logoUrl="/logo.png"          // Dynamic logo from CMS (optional)
  brandName="Mon Restaurant"   // Brand name, defaults to "BeInDigital"
/>
```

When `logoUrl` is provided, the sidebar shows the logo image. Otherwise, it shows a default icon with the brand name.

### StoreSelector

Compact store dropdown for the sidebar/header. **Auto-selects when only one store exists** and hides the dropdown.

```tsx
import { StoreSelector } from "@be-in-digital/admin";

<AdminHeader storeSelector={<StoreSelector />} />
```

### StoreGuard

Protects dashboard routes by requiring a selected store. Auto-selects when only one store exists.

```tsx
import { StoreGuard } from "@be-in-digital/admin";

<StoreGuard>{children}</StoreGuard>
```

Bypass routes (no guard): `/dashboard/stores`, `/dashboard/settings`, `/dashboard/team`.

## Store Management

### Store Creation (Draft to Open)

When a store is created, it starts in **"draft"** status. A toast notification explains:

> *"L'etablissement est en brouillon. Configurez ses parametres puis passez-le en 'Ouvert' pour l'activer."*

The **StoreDetailPage** shows an amber warning banner for draft stores, guiding the user to complete configuration.

### Store Detail Page

Includes a **back arrow** button to return to the stores list, and tabs for:

- **General**: Name, slug, address, status (draft/open/closed)
- **Hours**: Store-specific or global hours
- **Settings**: Service overrides (dine-in, delivery, etc.)
- **Integrations**: Uber Eats, Deliveroo configuration
