# @be-in-digital/core

> Authentication, internationalization, payment processing, and AWS services — the foundation layer.

## Table of Contents

- [Installation](#installation)
- [Authentication](#authentication)
- [Internationalization (i18n)](#internationalization-i18n)
- [Payments](#payments)
- [AWS Services](#aws-services)
- [RBAC (Role-Based Access Control)](#rbac)

## Installation

```bash
pnpm add @be-in-digital/core
```

## Authentication

Built on **Better Auth** + Convex.

### Setup

```typescript
import { authConfig, useAuth, AuthProvider } from "@be-in-digital/core";
```

### AuthProvider

Wrap your app with `AuthProvider`:

```tsx
// app/layout.tsx
import { AuthProvider } from "@be-in-digital/core";

export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
```

### useAuth Hook

```typescript
import { useAuth } from "@be-in-digital/core";

function MyComponent() {
  const { user, isAuthenticated, signIn, signOut, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <SignInForm />;

  return <p>Welcome, {user.name}</p>;
}
```

### Protected Routes

```typescript
import { requireAuth } from "@be-in-digital/core";

// In a Server Component or API route
const user = await requireAuth();
```

## Internationalization (i18n)

Dynamic, unlimited languages with GPT-3.5-turbo auto-translation.

### Configuration

```typescript
import { i18nConfig, useTranslation, TranslationProvider } from "@be-in-digital/core";
```

### useTranslation Hook

```typescript
import { useTranslation } from "@be-in-digital/core";

function ProductCard({ product }) {
  const { t, locale, setLocale, availableLocales } = useTranslation();

  return (
    <div>
      <h2>{t(product.name)}</h2>
      <p>{t(product.description)}</p>
    </div>
  );
}
```

### Auto-Translation

```typescript
import { translateWithGPT, batchTranslate } from "@be-in-digital/core";

// Single translation
const translated = await translateWithGPT(
  "Margherita Pizza",
  "en",      // source
  "fr",      // target
  "product name"  // context hint
);
// → "Pizza Margherita"

// Batch translation
await batchTranslate(products, "en", "es");
// Cost: ~$0.001 per product
```

### Language Storage

Languages are stored via cookies (primary) with localStorage fallback:

```typescript
import { getLocale, setLocale } from "@be-in-digital/core";

const currentLocale = getLocale(); // "fr"
setLocale("en");
```

## Payments

Multi-provider payment processing.

### Supported Providers

| Provider | Module | Use Case |
|----------|--------|----------|
| Stripe | `stripe` | Online payments, subscriptions |
| SumUp | `sumup` | In-person card terminals |
| PayPal | `paypal` | PayPal checkout |
| Square | `square` | POS integration |

### Stripe Integration

```typescript
import { createStripePayment, handleStripeWebhook } from "@be-in-digital/core";

// Create payment intent
const paymentIntent = await createStripePayment({
  amount: 2499, // in cents
  currency: "eur",
  metadata: { orderId: "order_123" },
});

// Handle webhook
export async function POST(req: Request) {
  return handleStripeWebhook(req, {
    onPaymentSuccess: async (event) => {
      // Update order status
    },
    onPaymentFailed: async (event) => {
      // Handle failure
    },
  });
}
```

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUMUP_API_KEY=...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
SQUARE_ACCESS_TOKEN=...
```

## AWS Services

### S3 Storage

```typescript
import { uploadToS3, deleteFromS3, getSignedUrl } from "@be-in-digital/core";

// Upload a file
const url = await uploadToS3(file, "products/pizza.jpg", "products");

// Get a signed URL (private files)
const signedUrl = await getSignedUrl("products/pizza.jpg");

// Delete
await deleteFromS3("products/pizza.jpg");
```

**S3 Folders:**

| Folder | Content |
|--------|---------|
| `products/` | Product images |
| `branding/` | Logos, brand assets |
| `stores/` | Store photos |
| `cms/` | CMS media uploads |

### SES Email

```typescript
import { sendEmail, sendTemplatedEmail } from "@be-in-digital/core";

// Simple email
await sendEmail({
  to: "customer@example.com",
  subject: "Order Confirmed",
  htmlBody: "<h1>Your order is confirmed!</h1>",
});

// Templated email
await sendTemplatedEmail({
  to: "customer@example.com",
  templateName: "order-confirmation",
  templateData: { orderNumber: "ORD-123", total: "24.99" },
});
```

## RBAC

Role-based access control for admin operations.

```typescript
import { checkPermission, UserRole } from "@be-in-digital/core";

// Roles: owner, admin, manager, staff
const canManageProducts = checkPermission(user.role, "products:write");
const canViewOrders = checkPermission(user.role, "orders:read");
```

### Permission Matrix

| Permission | Owner | Admin | Manager | Staff |
|-----------|-------|-------|---------|-------|
| `products:write` | Yes | Yes | Yes | No |
| `orders:read` | Yes | Yes | Yes | Yes |
| `orders:refund` | Yes | Yes | No | No |
| `settings:write` | Yes | Yes | No | No |
| `users:manage` | Yes | No | No | No |

## Environment Validation

Zod-based validation for all environment variables with a two-tier architecture.

### Setup

```bash
# Copy the template
cp apps/restaurant-theme/.env.example apps/restaurant-theme/.env.local
# Fill in the values
```

### Schemas

```typescript
import { packageEnvSchema, siteEnvSchema } from "@be-in-digital/core/env";
import type { PackageEnv, SiteEnv } from "@be-in-digital/core/env";
```

- **packageEnvSchema**: Platform-level vars (AWS, OpenAI, Uber Eats, Deliveroo)
- **siteEnvSchema**: Per-restaurant vars (Convex, Auth, Stripe, SES, Maps, etc.)

### Getters (lazy-loaded, memoized)

```typescript
import { getPackageEnv, getSiteEnv } from "@be-in-digital/core/env";

const { AWS_REGION, OPENAI_API_KEY } = getPackageEnv();
const { NEXT_PUBLIC_CONVEX_URL, STRIPE_SECRET_KEY } = getSiteEnv();
```

### Startup Validation

The app validates all env vars at startup via `instrumentation.ts`:

```typescript
import { validateAllEnv, formatEnvReport } from "@be-in-digital/core/env";

const { ok, missing } = validateAllEnv();
if (!ok) {
  console.error(formatEnvReport(missing));
  // Production: throws error
  // Development: logs warning, continues
}
```

The report groups missing variables by tier (Package-level vs Site-level) and shows a hint to copy `.env.example`.
