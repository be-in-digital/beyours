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

## Setup

### 1. Install Dependencies

```bash
pnpm add @be-in-digital/core
```

### 2. Configure Auth

```typescript
// lib/auth.ts
import { authConfig } from "@be-in-digital/core";

export const auth = authConfig({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  providers: ["email", "google"],
  redirects: {
    afterSignIn: "/dashboard",
    afterSignOut: "/",
  },
});
```

### 3. Wrap Your App

```tsx
// app/layout.tsx
import { AuthProvider } from "@be-in-digital/core";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

## Sign Up / Sign In

```tsx
"use client";

import { useAuth } from "@be-in-digital/core";
import { Button, Input, FormField } from "@be-in-digital/ui";

export function SignInForm() {
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn({ email, password });
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
import { useAuth } from "@be-in-digital/core";
import { redirect } from "next/navigation";

function ProtectedPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) redirect("/sign-in");

  return <div>Protected content</div>;
}
```

### Server-Side

```typescript
import { requireAuth } from "@be-in-digital/core";

export default async function DashboardPage() {
  const user = await requireAuth(); // Redirects if not authenticated
  return <div>Welcome, {user.name}</div>;
}
```

## Admin Authentication

```typescript
import { useAdminAuthStore } from "@be-in-digital/admin/stores";

function AdminLayout({ children }) {
  const { user, role, isAuthenticated } = useAdminAuthStore();

  if (!isAuthenticated) return <AdminSignIn />;
  return <AdminShell user={user} role={role}>{children}</AdminShell>;
}
```

## Role-Based Access Control

### Roles

| Role | Description | Scope |
|------|-------------|-------|
| `owner` | Restaurant owner | Full access |
| `admin` | Store administrator | All except user management |
| `manager` | Store manager | Operations, no settings |
| `staff` | Kitchen/service staff | View orders, kitchen only |

### Check Permissions

```typescript
import { checkPermission } from "@be-in-digital/core";

function DeleteProductButton({ product }) {
  const { role } = useAdminAuthStore();

  if (!checkPermission(role, "products:write")) {
    return null; // Don't render if no permission
  }

  return <Button variant="destructive">Delete</Button>;
}
```

### Permission List

| Permission | Owner | Admin | Manager | Staff |
|-----------|-------|-------|---------|-------|
| `products:read` | Yes | Yes | Yes | Yes |
| `products:write` | Yes | Yes | Yes | No |
| `orders:read` | Yes | Yes | Yes | Yes |
| `orders:write` | Yes | Yes | Yes | No |
| `orders:refund` | Yes | Yes | No | No |
| `kitchen:read` | Yes | Yes | Yes | Yes |
| `kitchen:write` | Yes | Yes | Yes | Yes |
| `settings:read` | Yes | Yes | No | No |
| `settings:write` | Yes | Yes | No | No |
| `users:manage` | Yes | No | No | No |
| `analytics:read` | Yes | Yes | Yes | No |
