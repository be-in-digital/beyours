# Authentication Guide

> Implement user authentication with Better Auth + Convex.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Sign Up / Sign In](#sign-up--sign-in)
- [Protected Routes](#protected-routes)
- [Admin Authentication](#admin-authentication)
- [Role-Based Access Control](#role-based-access-control)

## Overview

BeYours uses **Better Auth** for authentication with Convex as the database adapter. This provides:

- Email/password authentication
- Social login (Google, Facebook)
- Session management
- Role-based access control (RBAC)

> [!IMPORTANT]
> **Two halves of `@be-in-digital/core`, only one of which runs.**
> The RBAC half (`Role`, `Permission`, `hasPermission`, the `require*` guards) is
> pure, tested and used everywhere. The session half is a **placeholder**:
> `useAuth`, `AuthProvider` and `getServerSession` — and therefore `requireAuth`,
> `getServerUser` and every `require*Guard` built on it — throw
> `"Better Auth non installé"` the moment they are called. They exist to fix the
> shape of the eventual API, not to be called today.
>
> So an app wires Better Auth **directly** (`better-auth/react` +
> `@convex-dev/better-auth`) and enforces permissions **in Convex**. That is what
> `apps/reference` does, and what is documented below.

## Setup

### 1. Install Dependencies

```bash
pnpm add @be-in-digital/core better-auth @convex-dev/better-auth
```

### 2. Create the auth client

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [convexClient()],
});
```

`@be-in-digital/core` also exports `createAuthConfig` (**not** `authConfig` — no
such export exists). It builds a `BetterAuthConfig` object and nothing more:

```typescript
import { createAuthConfig } from "@be-in-digital/core";

const config = createAuthConfig({
  baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  socialProviders: {
    google: { clientId: "...", clientSecret: "..." },
  },
});
```

It has no call site in the engine today: its `database` field is the literal
`{ type: "convex", url }`, a stand-in for the Convex adapter, and its `plugins`
array is empty. Treat it as the intended shape, not as working configuration.

### 3. Wrap Your App

There is no BeYours provider to wrap the tree in — `AuthProvider` from
`@be-in-digital/core` throws. Better Auth's React client needs no provider; the
Convex provider is the one your layout mounts:

```tsx
// app/layout.tsx
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ConvexBetterAuthProvider client={convex} authClient={authClient}>
          {children}
        </ConvexBetterAuthProvider>
      </body>
    </html>
  );
}
```

## Sign Up / Sign In

```tsx
"use client";

import { authClient } from "@/lib/auth-client";
import { Button, Input, FormField } from "@be-in-digital/ui";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await authClient.signIn.email({ email, password });
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <FormField label="Password">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </FormField>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
```

## Protected Routes

### Client-Side

```tsx
import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";

function ProtectedPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <LoadingSpinner />;
  if (!session) redirect("/sign-in");

  return <div>Protected content</div>;
}
```

### Server-Side

`requireAuth()` from `@be-in-digital/core` is one of the placeholders: it calls
`getServerSession()`, which throws. The gate that actually holds is in Convex —
every query and mutation that touches a store goes through it:

```typescript
import { requireStorePermission } from "@be-in-digital/convex-functions/auth";

export const internalLoadForRefund = internalQuery({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.id);
    if (!payment) throw new Error("Payment not found");
    await requireStorePermission(ctx, payment.storeId, "payments:refund");
    return payment;
  },
});
```

`requireStorePermission(ctx, storeId, permission)` checks three things in order:
the caller is authenticated, they have access to that store, and their role holds
the permission. Related helpers in the same module: `getAuthUser`,
`requireStoreAccess`, `requireStaff`, `isStaff`, `seesEveryStore`.

## Admin Authentication

```typescript
import { useAdminAuthStore } from "@be-in-digital/admin/stores";

function AdminLayout({ children }) {
  const { user, role, isAuthenticated } = useAdminAuthStore();

  if (!isAuthenticated) return <AdminSignIn />;
  return <AdminShell user={user} role={role}>{children}</AdminShell>;
}
```

The store is client state, synced from the Better Auth session and the Convex
user profile. Its `role` is typed as the `Role` enum from `@be-in-digital/core`,
so it can be handed straight to `hasPermission`. It is **not** persisted to
localStorage, and it is display state only — never the authorisation itself.

## Role-Based Access Control

### Roles

Seven, and they are the `Role` enum in `packages/core/src/auth/rbac.ts` — not
`owner` / `admin` / `staff`:

| `Role` member | Value | Scope |
|------|-------|-------|
| `Role.SUPER_ADMIN` | `super_admin` | Every restaurant and feature |
| `Role.CLIENT_ADMIN` | `client_admin` | Full access, their own restaurant only |
| `Role.MANAGER` | `manager` | Day-to-day running |
| `Role.KITCHEN` | `kitchen` | Kitchen Display System only |
| `Role.WAITER` | `waiter` | Orders and tables |
| `Role.DELIVERY` | `delivery` | Deliveries only |
| `Role.CUSTOMER` | `customer` | Their own orders |

### Check Permissions

The export is `hasPermission`, not `checkPermission`:

```typescript
import { hasPermission, Role } from "@be-in-digital/core";
import { useAdminAuthStore } from "@be-in-digital/admin/stores";

function DeleteProductButton({ product }) {
  const role = useAdminAuthStore((s) => s.role);

  if (!hasPermission(role, "products:delete")) {
    return null; // Don't render if no permission
  }

  return <Button variant="destructive">Delete</Button>;
}
```

Also exported: `hasAnyPermission(role, permissions)`,
`hasAllPermissions(role, permissions)`, `getRolePermissions(role)`,
`parseRole`, `isValidRole`, and the guard factories `requirePermission`,
`requireAnyPermission`, `requireAllPermissions`, which throw
`PermissionDeniedError` instead of returning a boolean.

A `Permission` is the template literal `` `${Resource}:${Action}` ``, and both
halves are exported enums — so a typo is a compile error rather than a silent
`false`.

Hiding a button is not authorisation. The server-side check
(`requireStorePermission`) is the one that decides; this only stops the UI
offering an action that will be refused.

### Permission List

Per role, as `ROLE_PERMISSIONS` in `packages/core/src/auth/rbac.ts` defines it.
`super_admin` is omitted from the table: it holds everything `client_admin` does
plus exactly four more — `stores:delete`, `stores:manage`, `kitchen:manage` and
`analytics:view_all`.

| Permission | client_admin | manager | kitchen | waiter | delivery | customer |
|-----------|--------------|---------|---------|--------|----------|----------|
| `products:read` | Yes | Yes | No | Yes | No | Yes |
| `products:write` | Yes | Yes | No | No | No | No |
| `products:delete` | Yes | No | No | No | No | No |
| `orders:read` | Yes | Yes | Yes | Yes | Yes | No |
| `orders:write` | Yes | Yes | No | Yes | No | No |
| `orders:update_status` | Yes | Yes | Yes | Yes | Yes | No |
| `orders:view_own` | No | No | No | No | No | Yes |
| `kitchen:read` | Yes | Yes | Yes | No | No | No |
| `kitchen:write` | Yes | Yes | Yes | No | No | No |
| `payments:read` | Yes | Yes | No | Yes | No | No |
| `payments:write` | Yes | No | No | No | No | No |
| `payments:refund` | Yes | No | No | No | No | No |
| `settings:read` | Yes | Yes | No | No | No | No |
| `settings:write` | Yes | No | No | No | No | No |
| `team:read` | Yes | Yes | No | No | No | No |
| `team:write` | Yes | No | No | No | No | No |
| `analytics:read` | Yes | Yes | No | No | No | No |
| `content:write` | Yes | Yes | No | No | No | No |
| `marketing:write` | Yes | Yes | No | No | No | No |
| `games:write` | Yes | Yes | No | No | No | No |
| `deliveries:write` | Yes | Yes | No | No | Yes | No |
| `tables:write` | Yes | Yes | No | Yes | No | No |
