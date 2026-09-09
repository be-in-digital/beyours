# Auth Module - @be-in-digital/core

This module provides a complete authentication solution based on **Better Auth** plus an **RBAC (Role-Based Access Control)** system for BeYours Engine.

## 📦 Installing dependencies

The auth module is designed to work with Better Auth. Install the required dependencies:

```bash
pnpm add better-auth @better-auth/convex @better-auth/two-factor
```

## 🏗️ Architecture

The module is made up of 4 main files:

### 1. `rbac.ts` - Permission system (100% functional)
Handles the 7 roles and their granular permissions.

**Available roles:**
- `super_admin` - Full access
- `client_admin` - Everything on their own restaurant
- `manager` - Day-to-day operations
- `kitchen` - KDS only
- `waiter` - Orders + tables
- `delivery` - Deliveries only
- `customer` - Their own orders

**Usage example:**
```ts
import { Role, hasPermission } from '@be-in-digital/core'

// Check a permission
hasPermission(Role.MANAGER, 'products:write') // true
hasPermission(Role.CUSTOMER, 'products:delete') // false

// Check middleware
const checkDelete = requirePermission('products:delete')
checkDelete(userRole) // throws if the permission is missing
```

### 2. `config.ts` - Better Auth configuration
Base configuration for Better Auth with Convex.

**After installing better-auth:**
```ts
import { betterAuth } from 'better-auth'
import { convexAdapter } from '@better-auth/convex'
import { twoFactorPlugin } from '@better-auth/two-factor'

export const auth = betterAuth({
  baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
  secret: process.env.AUTH_SECRET!,
  database: convexAdapter({
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    // ... other providers
  },
  plugins: [
    twoFactorPlugin({
      methods: ['totp', 'email'],
      totpIssuer: 'BeYours',
    }),
  ],
})
```

### 3. `client.ts` - React hooks
Hooks and utilities for the React frontend.

**After installing better-auth/react:**
```tsx
import { createAuthClient } from 'better-auth/react'
import { usePermission, Role } from '@be-in-digital/core'

// Create the client
const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
})

// Use it in a component
function ProductManager() {
  const { allowed, loading } = usePermission('products:write')

  if (!allowed) return <AccessDenied />

  return <ProductForm />
}

// Conditional component (to implement in your app)
function CanAccess({ permission, children }: CanAccessProps) {
  const { allowed, loading } = usePermission(permission)
  if (loading) return null
  return allowed ? <>{children}</> : null
}
```

### 4. `server.ts` - Server utilities
Middlewares for Server Components and API Routes.

**Example in a Server Component:**
```ts
import { requireAuth, requirePermission } from '@be-in-digital/core'

export default async function DashboardPage() {
  const session = await requireAuth()
  return <div>Bonjour {session.user.name}</div>
}
```

**Example in an API Route:**
```ts
import { withAuthRoute } from '@be-in-digital/core'

export const DELETE = withAuthRoute(
  async (req, session) => {
    // session is guaranteed non-null with the right permission
    return Response.json({ success: true })
  },
  { requirePermission: 'products:delete' }
)
```

## 🧪 Tests

The RBAC module is 100% tested, with 47 tests covering every scenario.

```bash
# Run the tests
pnpm --filter @be-in-digital/core test

# Tests in watch mode
pnpm --filter @be-in-digital/core test:watch
```

## 📝 Environment variables

```bash
# Better Auth
AUTH_SECRET=your-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
```

## 🚀 Integration steps

### 1. Install Better Auth
```bash
pnpm add better-auth @better-auth/convex @better-auth/two-factor
```

### 2. Configure Better Auth

Not from this package. `createAuthConfig` used to live here and was deleted: it
had no call site, and what it declared contradicted the auth that runs
(`MIN_PASSWORD_LENGTH = 8` against the live `minPasswordLength: 12`).

The real configuration is `apps/*/convex/auth.ts`, through
`@convex-dev/better-auth` — the component owns the `user`, `session`, `account`,
`verification` and `jwks` tables, which is why none of them is declared in
`packages/convex-schema`. Read that file rather than a snippet here; a second
copy of an auth configuration is the defect this section used to be.

### 3. Create the React client
Create `apps/reference/lib/auth-client.ts`:
```ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
})

// Export the hooks
export { useAuth, usePermission, useRole } from '@be-in-digital/core'
```

### 4. Add the provider
In `apps/reference/app/layout.tsx`:
```tsx
import { SessionProvider } from 'better-auth/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

### 5. Protect the pages
```tsx
import { requireAuth, requirePermission } from '@be-in-digital/core'

export default async function ProductsPage() {
  await requirePermission('products:read')
  // Protected page
}
```

## 📊 Permission matrix

| Role | Products | Orders | Kitchen | Team | Settings | Payments |
|------|----------|--------|---------|------|----------|----------|
| super_admin | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| client_admin | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ Read + Refund |
| manager | ✅ Read + Write | ✅ CRUD | ✅ Read + Write | ✅ Read | ✅ Read | ✅ Read |
| kitchen | ❌ | ✅ Read + Update Status | ✅ CRUD | ❌ | ❌ | ❌ |
| waiter | ✅ Read | ✅ CRUD | ❌ | ❌ | ❌ | ✅ Read |
| delivery | ❌ | ✅ Read + Update Status | ❌ | ❌ | ❌ | ❌ |
| customer | ✅ Read | ✅ View Own | ❌ | ❌ | ❌ | ❌ |

## 🔒 Security

- **TypeScript strict mode**: no `any` types
- **Zod validation**: every input validated
- **Permission checks**: always check on the server AND the client
- **Session management**: 7-day expiry, refresh after 1 day
- **2FA support**: TOTP and email
- **Rate limiting**: to be implemented in the hooks

## 📚 Full documentation

See `CLAUDE.md` at the project root for the complete architecture.

---

**Important note**: RBAC is 100% functional and tested WITHOUT Better Auth. The client.ts and server.ts functions are wrappers that will work once Better Auth is installed.
