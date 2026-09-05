# Authentication Guide

> Better Auth on Convex for identity, and RBAC for everything a signed-in
> account is then allowed to do.

## Table of Contents

- [Overview](#overview)
- [How it is wired](#how-it-is-wired)
- [Environment](#environment)
- [Sign Up / Sign In](#sign-up--sign-in)
- [Routes](#routes)
- [Protected Routes](#protected-routes)
- [Admin Authentication](#admin-authentication)
- [Role-Based Access Control](#role-based-access-control)

## Overview

Identity is **Better Auth**, stored in the Convex Better Auth *component*, and
reached from the app through `@convex-dev/better-auth`. Authorization is a
separate system: a `userProfiles` row carries the role, and the RBAC helpers in
`@be-in-digital/core/auth/rbac` decide what that role may do.

What ships:

- Email and password sign-in, with **email verification required** by default
- Password reset, which revokes every other session
- Session management through the Better Auth Convex component
- Role-based access control (7 roles), enforced **inside Convex functions**

What does **not** ship, and must not be described as if it did:

- **Social / OAuth login.** No provider is configured anywhere. `createAuth`
  in `convex/auth.ts` registers exactly one plugin, `convex({ authConfig })`,
  and there is no `socialProviders` block. `OAuthProvider` exists as a *type*
  in `@be-in-digital/core` and has no implementation behind it.
- **Two-factor authentication.** `userProfiles.twoFactorEnabled` is a
  placeholder that every writer sets to `false`; nothing reads it and no
  screen can turn it on.
- **Magic links.** An email template is declared; nothing sends one.

`@be-in-digital/core/auth` also exports `createAuthConfig`, `authHooks` and a
React client (`useAuth`, `AuthProvider`, `usePermission`). **None of it is
used by any app in this repository** — the apps go through Better Auth's own
client instead, as below. Only the RBAC half of that package is load-bearing.

## How it is wired

Three files, in `apps/themes` (and its mirror `apps/reference`). A client site
is a clone of `apps/themes`, so this wiring is already in place — there is
nothing to install.

### 1. The Convex server — `convex/auth.ts`

```typescript
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

export const authComponent: ReturnType<typeof createClient<DataModel>> =
  createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification:
        process.env.AUTH_ALLOW_UNVERIFIED_EMAIL !== "true",
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        /* posts to the Next app's /api/email/send */
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        /* same seam */
      },
    },
    trustedOrigins: [process.env.SITE_URL!],
    plugins: [convex({ authConfig })],
  });
```

Two things worth knowing before you change this file:

- **Convex holds no SES credentials.** Every mail Better Auth wants to send is
  POSTed to the Next app's `/api/email/send` with a shared secret. That call
  throws on a missing variable or a non-2xx reply, on purpose: a silent failure
  here looks exactly like a delivered email.
- **`trustedOrigins` diverges between the two apps deliberately.**
  `apps/reference` trusts `localhost` because its workspaces fight over ports;
  a client site has no reason to, and widening it there widens it at the
  restaurant. Do not "align" them.

### 2. The browser client — `lib/auth-client.ts`

```typescript
import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [convexClient()],
});
```

### 3. The provider — `app/providers.tsx`

```tsx
"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children, initialToken }) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
```

## Environment

Set on the **Convex deployment** (`npx convex env set`), not in `.env.local`:

| Variable | Purpose |
|---|---|
| `SITE_URL` | Origin of the Next app; also where auth emails are posted |
| `BETTER_AUTH_SECRET` | Better Auth signing secret |
| `EMAIL_API_SECRET` | Shared secret for `/api/email/send`; falls back to `BETTER_AUTH_SECRET` |
| `AUTH_ALLOW_UNVERIFIED_EMAIL` | `"true"` relaxes email verification. Test deployments only — it fails closed, so anything else keeps verification on |
| `ADMIN_BOOTSTRAP_TOKEN` | Required by `claimFirstAdmin`. Unset means no one can claim the first `super_admin` seat at all |

## Sign Up / Sign In

Through `authClient`, not through a wrapper of ours:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await authClient.signIn.email({ email, password });
    setIsLoading(false);

    // An unverified account is refused here with EMAIL_NOT_VERIFIED, and a
    // fresh verification mail is sent on the attempt.
    if (result.error) return;
    router.push("/dashboard");
  };

  /* … */
}
```

Sign-up is `authClient.signUp.email({ email, password, name })`. Passwords are
12 characters minimum, enforced server-side by `minPasswordLength`.

## Routes

The real pages live in `app/(auth)`. A route group adds no URL segment, so
these are the URLs:

| Page | Path |
|---|---|
| Sign in | `/sign-in` |
| Sign up | `/sign-up` |
| Forgot password | `/forgot-password` |
| Reset password | `/reset-password` |
| First-admin bootstrap | `/setup` |
| Accept a team invitation | `/invite/[token]` |

`/sign-in` and `/sign-up` accept `?redirect=`, restricted to a path on the same
site — an absolute URL there would make either page an open redirect.

There is no `/auth/*` prefix, no `/onboarding`, and no 2FA page.

## Protected Routes

### Client-side — presentation only

```tsx
"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

function ProtectedPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) return <LoadingSpinner />;
  if (!session?.user) {
    router.replace("/sign-in");
    return null;
  }

  return <div>Protected content</div>;
}
```

This hides a screen; it does not protect anything. The route still returns a
200 HTML shell, which is why every private path is disallowed in
`lib/crawler-policy.ts`.

### Server-side — the real gate, inside Convex

Authorization is enforced in the Convex function, because that is the only
place a client cannot skip:

```typescript
import { requireStorePermission, requireStaff, getAuthUser }
  from "@be-in-digital/convex-functions/auth";

export const update = mutation({
  args: { storeId: v.id("stores"), /* … */ },
  handler: async (ctx, args) => {
    await requireStorePermission(ctx, args.storeId, "products:write");
    /* … */
  },
});
```

| Guard | Checks |
|---|---|
| `getAuthUser(ctx)` | Signed in **and** has a `userProfiles` row; returns role, storeIds, permissions |
| `requireStoreAccess(ctx, storeId)` | The above, plus the store is granted (super admins bypass) |
| `requireStorePermission(ctx, storeId, permission)` | The above, plus the role holds the permission, plus the per-member module grant allows it |
| `requireStaff(ctx)` | Any role but `customer` — for admin reads that span every store |

Refusals are `ConvexError` carrying a `code`
(`not_authenticated`, `no_profile`, `store_not_granted`, `permission_denied`,
`module_denied`, `staff_only`). Convex redacts a plain `Error` in production,
so a thrown string reaches the browser as "Server Error"; the `code` is what a
screen should switch on.

Actions have no `ctx.db`, so they reach the same guards through internal
queries — `ctx.runQuery(internal.authHelpers.checkPermission, { permission })`.

**Module grants narrow, never widen.** The team invite dialog stores a list of
modules per member; `requireStorePermission` applies it *after* the role check,
so unticking a module can take access away but can never add it.

## Admin Authentication

`AdminAuthSync` bridges the Better Auth session and the Convex profile into a
Zustand store; the admin components read the store.

```tsx
import { useAdminAuthStore } from "@be-in-digital/admin";

function AdminLayout({ children }) {
  const { user, role, isAuthenticated, isLoading } = useAdminAuthStore();

  if (isLoading) return <AdminSkeleton />;
  if (!isAuthenticated) return <AdminSignIn />;
  return <AdminShell user={user} role={role}>{children}</AdminShell>;
}
```

The role defaults to `customer` until the profile arrives, so a partially
loaded store denies rather than grants.

The first `super_admin` on a fresh deployment is claimed through
`claimFirstAdmin`, which requires `ADMIN_BOOTSTRAP_TOKEN`. Sign-up is open on
the storefront and Convex function names are discoverable from the client
bundle, so "nothing in the UI calls it" is not a protection.

## Role-Based Access Control

### Roles

Seven, from `Role` in `@be-in-digital/core/auth/rbac`. The values below are the
literals stored in `userProfiles.role`.

| Role | Description | Scope |
|---|---|---|
| `super_admin` | Platform administrator | Every establishment, every feature |
| `client_admin` | Restaurant owner | Everything, within their own establishment |
| `manager` | Store manager | Day-to-day running; no settings writes, no refunds |
| `kitchen` | Kitchen staff | Kitchen Display System and order status only |
| `waiter` | Floor staff | Orders, tables, and reading the menu |
| `delivery` | Courier | Deliveries and order status |
| `customer` | Diner | Their own orders |

There is no `owner`, `admin` or `staff` role.

### Check Permissions

```typescript
import { hasPermission } from "@be-in-digital/core/auth/rbac";
import { useAdminAuthStore } from "@be-in-digital/admin";

function DeleteProductButton({ product }) {
  const role = useAdminAuthStore((s) => s.role);

  if (!hasPermission(role, "products:delete")) return null;

  return <Button variant="destructive">Delete</Button>;
}
```

Import from `@be-in-digital/core/auth/rbac`, the subpath the apps actually use.
`@be-in-digital/core` re-exports the same symbols; `@be-in-digital/core/auth`
is **not** a resolvable subpath — it is absent from the package's `exports`
map, so that import fails at build time.

The function is `hasPermission(role, permission)`. There is no
`checkPermission` in `@be-in-digital/core` — the name exists only as an
internal Convex query in `convex/authHelpers.ts`, which is a different thing.

Companions: `hasAnyPermission`, `hasAllPermissions`, `getRolePermissions`,
`requirePermission` (a guard factory that throws `PermissionDeniedError`),
`parseRole`, `isValidRole`. `hasPermission` fails closed on an unknown role or
an unrecognised permission string, so a typo denies.

### Permission List

Generated from `ROLE_PERMISSIONS` in `packages/core/src/auth/rbac.ts`.
`super_admin` short-circuits to `true` for every permission, held or not.

| `analytics:read` † | Yes | Yes | Yes | — | — | — | — |
| `analytics:view_all` † | Yes | — | — | — | — | — | — |
| `content:delete` | Yes | Yes | — | — | — | — | — |
| `content:read` | Yes | Yes | Yes | — | — | — | — |
| `content:write` | Yes | Yes | Yes | — | — | — | — |
| `customers:read` | Yes | Yes | Yes | — | Yes | — | — |
| `customers:write` | Yes | Yes | — | — | — | — | — |
| `deliveries:read` † | Yes | Yes | Yes | — | — | Yes | — |
| `deliveries:write` † | Yes | Yes | Yes | — | — | Yes | — |
| `games:read` | Yes | Yes | Yes | — | — | — | Yes |
| `games:write` | Yes | Yes | Yes | — | — | — | — |
| `kitchen:manage` | Yes | — | — | — | — | — | — |
| `kitchen:read` | Yes | Yes | Yes | Yes | — | — | — |
| `kitchen:write` | Yes | Yes | Yes | Yes | — | — | — |
| `marketing:read` | Yes | Yes | Yes | — | — | — | — |
| `marketing:write` | Yes | Yes | Yes | — | — | — | — |
| `menus:read` † | Yes | Yes | Yes | — | Yes | — | Yes |
| `menus:write` | Yes | Yes | — | — | — | — | — |
| `orders:delete` | Yes | Yes | — | — | — | — | — |
| `orders:read` | Yes | Yes | Yes | Yes | Yes | Yes | — |
| `orders:update_status` | Yes | Yes | Yes | Yes | Yes | Yes | — |
| `orders:view_own` † | Yes | — | — | — | — | — | Yes |
| `orders:write` | Yes | Yes | Yes | — | Yes | — | — |
| `payments:read` | Yes | Yes | Yes | — | Yes | — | — |
| `payments:refund` | Yes | Yes | — | — | — | — | — |
| `payments:write` | Yes | Yes | — | — | — | — | — |
| `products:delete` | Yes | Yes | — | — | — | — | — |
| `products:read` | Yes | Yes | Yes | — | Yes | — | Yes |
| `products:write` | Yes | Yes | Yes | — | — | — | — |
| `settings:read` | Yes | Yes | Yes | — | — | — | — |
| `settings:write` | Yes | Yes | — | — | — | — | — |
| `stores:delete` | Yes | — | — | — | — | — | — |
| `stores:manage` † | Yes | — | — | — | — | — | — |
| `stores:read` | Yes | Yes | Yes | — | — | — | — |
| `stores:write` | Yes | Yes | — | — | — | — | — |
| `system:backup` | Yes | Yes | — | — | — | — | — |
| `system:migrate` | Yes | Yes | — | — | — | — | — |
| `system:read` | Yes | Yes | — | — | — | — | — |
| `system:restore` | Yes | Yes | — | — | — | — | — |
| `tables:read` † | Yes | Yes | Yes | — | Yes | — | — |
| `tables:write` † | Yes | Yes | Yes | — | Yes | — | — |
| `team:delete` † | Yes | Yes | — | — | — | — | — |
| `team:read` | Yes | Yes | Yes | — | — | — | — |
| `team:write` | Yes | Yes | — | — | — | — | — |
| `translations:read` † | Yes | Yes | Yes | — | — | — | — |
| `translations:write` | Yes | Yes | — | — | — | — | — |

† **Declared but not enforced anywhere.** These permissions exist in
`ROLE_PERMISSIONS` and are asserted by `packages/core/src/auth/__tests__/rbac.test.ts`,
but no guard, screen or Convex function checks them — granting or revoking one
today changes nothing. They are listed so the table matches the source, not
because they gate anything. `analytics:read` is the clearest case: there is no
analytics screen behind it.
